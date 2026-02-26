"use strict";
var Anthropic = require("@anthropic-ai/sdk");

class AIResponseHandler {
    constructor(pool, eventBus, logger) {
        this.pool = pool;
        this.eventBus = eventBus;
        this.logger = logger || console;
        this.anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Self-subscriber disabled - server.js handles AI calls directly
        // this.eventBus.subscribe('message.received', async (event) => {
        // try {
        // var message = event.payload || event;
        // var conversationId = message.conversationId || message.conversation_id;
        // if (!conversationId) {
        // this.logger.error('AI Handler: No conversationId in event');
        // return;
        // }
        // var convRes = await this.pool.query(
        // 'SELECT ai_enabled FROM conversations WHERE id = $1',
        // [conversationId]
        // );
        // if (convRes.rows.length === 0) return;
        // if (convRes.rows[0].ai_enabled === false) {
        // this.logger.info('AI Handler: AI disabled for conversation ' + conversationId);
        // return;
        // }
        // var messageId = message.messageId || message.message_id || message.id;
        // this.logger.info('AI Handler: Processing message', { conversationId: conversationId, messageId: messageId });
        // await this.processMessage(conversationId, messageId, message.content || message.message);
        // } catch (error) {
        // this.logger.error('AI Handler error: ' + error.message);
        // }
        // });
    }

    async processMessage(conversationId, messageId, content) {
        try {
            // Get conversation history for context
            var historyRes = await this.pool.query(
                "SELECT content, sender_type, created_at FROM messages WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT 15",
                [conversationId]
            );
            var history = historyRes.rows.reverse();
            // If content is empty, fetch by messageId first, then fallback to history
            if (!content || content === '') {
                if (messageId) {
                    try {
                        var msgLookup = await this.pool.query('SELECT content FROM messages WHERE id = $1', [messageId]);
                        if (msgLookup.rows.length > 0) {
                            content = msgLookup.rows[0].content || '';
                            this.logger.info('AI Handler: Content fetched by messageId ' + messageId + ': ' + (content ? content.substring(0, 50) : 'null'));
                        }
                    } catch(e) { this.logger.error('Content lookup by messageId failed: ' + e.message); }
                }
                if (!content || content === '') {
                    var lastCustomerMsg = history.filter(function(m) { return m.sender_type === 'customer'; }).pop();
                    if (lastCustomerMsg) {
                        content = lastCustomerMsg.content;
                        this.logger.info('AI Handler: Content recovered from history: ' + (content ? content.substring(0, 50) : 'null'));
                    }
                }
            }
            // === RATING DETECTION ===
            var convStatusRes = await this.pool.query(
                "SELECT status FROM conversations WHERE id = $1", [conversationId]
            );
            var convStatus = convStatusRes.rows[0] && convStatusRes.rows[0].status;
            if (convStatus === 'resolved') {
                var ratingResult = this.detectRating(content);
                if (ratingResult) {
                    this.logger.info('Rating detected: ' + ratingResult + ' for conversation ' + conversationId);
                    await this.pool.query(
                        'INSERT INTO ratings (conversation_id, rating) VALUES ($1, $2) ON CONFLICT (conversation_id) DO UPDATE SET rating = $2, updated_at = NOW()',
                        [conversationId, ratingResult]
                    );
                    var thankYouMsg = 'Thank you for your rating of ' + ratingResult + '/5! We really appreciate your feedback. Your satisfaction is our priority at GravyStream. If you need any further assistance, don\'t hesitate to reach out. Have a wonderful day!';
                    await this.pool.query(
                        "INSERT INTO messages (conversation_id, content, sender_type, sender_id, channel) VALUES ($1, $2, 'system', 'ai-starr', COALESCE((SELECT channel FROM conversations WHERE id = $1), 'email'))",
                        [conversationId, thankYouMsg]
                    );
                    await this.pool.query(
                        "UPDATE conversations SET status = 'closed', updated_at = NOW() WHERE id = $1",
                        [conversationId]
                    );
                    if (global.io) {
                        global.io.to('conversation:' + conversationId).emit('conversation:message', {
                            conversationId: conversationId, content: thankYouMsg, sender_type: 'system', sender_id: 'ai-starr'
                        });
                    }
                    this.logger.info('Rating saved and conversation ' + conversationId + ' closed');
                    return;
                }
            }
            // === END RATING DETECTION ===

            // Search knowledge base
            var kbArticles = await this.searchKnowledgeBase(content);
            this.logger.info('KB articles found: ' + kbArticles.length);

            // Detect if this is a complaint or escalation needed
            var needsEscalation = this.detectEscalation(content, history);

            // Build system prompt with Starr personality
            var systemPrompt = this.buildSystemPrompt(kbArticles, needsEscalation, history);

            // Build messages array from history
            var messages = [];
            for (var i = 0; i < history.length; i++) {
                var msg = history[i];
                var role = (msg.sender_type === 'customer') ? 'user' : 'assistant';
                if (msg.content && msg.content.trim()) {
                    messages.push({ role: role, content: msg.content });
                }
            }
            // Ensure messages alternate properly and start with user
            messages = this.sanitizeMessages(messages);

            if (messages.length === 0) {
                messages.push({ role: 'user', content: content || 'Hello' });
            }

            // Call Anthropic API
            var response = await this.anthropic.messages.create({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 1024,
                system: systemPrompt,
                messages: messages
            });

            var aiResponse = response.content[0].text;

            // If escalation is needed and customer hasn't provided details yet, the AI prompt handles it
            // If escalation is confirmed (details collected), mark conversation for handoff
            // DISABLED_DOUBLE_FIX:             if (needsEscalation === 'handoff') {
            // DISABLED_DOUBLE_FIX:                 await this.escalateToHuman(conversationId);
            // DISABLED_DOUBLE_FIX:             }

            // Save AI response to database
            var insertRes = await this.pool.query(
                "INSERT INTO messages (conversation_id, content, sender_type, created_at) VALUES ($1, $2, 'agent', NOW()) RETURNING id",
                [conversationId, aiResponse]
            );
            var newMessageId = insertRes.rows[0].id;

            // Publish message.sent event
            this.eventBus.publish('message.sent', {
                    id: newMessageId,
                    conversationId: conversationId,
                    conversation_id: conversationId,
                    content: aiResponse,
                    sender_type: 'agent',
            });

            this.logger.info('AI Response sent successfully', { conversationId: conversationId });

            // Trigger escalation AFTER response is saved (so handoff message is delivered first)
            if (needsEscalation === 'handoff') {
                this.logger.info('[ESCALATION] Triggering escalateToHuman AFTER AI response saved');
                await this.escalateToHuman(conversationId);
            }
        } catch (error) {
            this.logger.error("Anthropic API error: " + error.message);
            // Send fallback message
            var fallback = "I apologize for the inconvenience. Let me connect you with a team member who can assist you right away. Please hold on.";
            var fallbackRes = await this.pool.query(
                "INSERT INTO messages (conversation_id, content, sender_type, created_at) VALUES ($1, $2, 'agent', NOW()) RETURNING id",
                [conversationId, fallback]
            );
            this.eventBus.publish('message.sent', {
                    id: fallbackRes.rows[0].id,
                    conversationId: conversationId,
                    conversation_id: conversationId,
                    content: fallback,
                    sender_type: 'agent',
            });
        }
    }

    buildSystemPrompt(kbArticles, escalationStatus, history) {
        var knowledgeContext = '';
        if (kbArticles.length > 0) {
            knowledgeContext = '\n\n--- KNOWLEDGE BASE ---\nUse the following information to answer questions accurately:\n';
            for (var i = 0; i < kbArticles.length; i++) {
                knowledgeContext += '\n[' + kbArticles[i].title + ']\n' + kbArticles[i].content + '\n';
            }
            knowledgeContext += '--- END KNOWLEDGE BASE ---\n';
        }
        var escalationInstructions = '';
        if (escalationStatus === 'collecting') {
            escalationInstructions = `

IMPORTANT - COMPLAINT DETECTED:
The customer appears to have a complaint or issue that needs attention. You must:
1. Acknowledge their frustration with empathy and patience
2. Use this template: "I understand you're experiencing {issue}. Let me help you resolve this right away."
3. Politely collect the following REQUIRED information before handing off:
   - Full Name (REQUIRED)
   - Email Address (REQUIRED)
   - Phone Number
   - Issue Category (REQUIRED - e.g. payment, delivery, account, refund)
   - Order/Reference Number (for payment/transaction/delivery issues)
4. Ask for these details naturally and politely. For example:
"I understand this is frustrating. So I can get this resolved quickly for you, could you please share your full name, email address, and the order number or transaction reference?"
5. Once you have these details, let them know you are connecting them to a human agent who can resolve their issue.
6. Say: "Thank you for providing those details. Let me connect you with a specialist who can help resolve this for you right away."
`;
        } else if (escalationStatus === 'handoff') {
            escalationInstructions = `

IMPORTANT - HANDOFF MODE:
The customer has provided their details for a complaint. Let them know a human agent will take over shortly. Be warm and reassuring. Tell them their issue is important and someone will be with them very soon.
Use this template: "Great news! I've forwarded your case to our support team. Is there anything else I can help you with while you wait?"
`;
        }
        var systemPrompt = `You are Starr, an AI Support Agent for Gravy. Gravy is Nigeria's all-in-one lifestyle super app (Wallet, Mart, Foods, Logistics).

YOUR PERSONALITY:
- Your name is Starr
- You are calm, attentive, and extremely patient
- You always take time to fully understand the customer's question or complaint before responding
- You speak in simple, clear language that anyone can understand (even a 15-year-old)
- You are friendly and warm but professional
- You never rush the customer
- You use short sentences and avoid technical jargon
- You summarize information in the simplest way possible

GREETING:
- When a customer first says hello or starts a conversation, introduce yourself: "Hi! Welcome to Gravy Support. My name is Starr, your AI Agent. I'll be helping you today. How can I assist you?"
- Keep greetings warm but brief

=== CRITICAL GUARDRAILS - DO NOT VIOLATE ===

SERVICES GRAVY OFFERS (ONLY discuss these):
- Gravy Wallet: Payments, transfers, bill payments, split bill, pay-by-friend
- Gravy Mart: E-commerce marketplace, product orders, refunds
- Gravy Eat/Foods: Food delivery, restaurant orders
- Gravy Logistics: Cross-border transactions, remittance, foreign currency

SERVICES GRAVY DOES NOT OFFER:
- Travel booking, airplane tickets, hotel reservations, car rentals
- Insurance products
- Cryptocurrency trading or investment advice
- Loan services or credit facilities
- Any service NOT listed in the knowledge base

STRICT RULES - NEVER BREAK THESE:
1. NEVER discuss, explain, or provide information about services Gravy does not offer. If asked about travel, flights, hotels, insurance, loans, crypto trading, or ANY service not in your training materials, respond ONLY with: "I appreciate your interest, but Gravy does not currently offer that service. Is there anything else I can help you with regarding our Wallet, Mart, Food delivery, or Cross-border payment services?"
2. NEVER promise refunds or compensation without authorization
3. NEVER share internal processes, employee names, or system details
4. NEVER give legal, medical, or financial advice
5. NEVER make promises about timelines you cannot guarantee
6. NEVER fabricate or guess information - only use what is in the knowledge base
7. NEVER share information about other customers
8. ALWAYS escalate fraud reports, account compromise, and safety concerns immediately
9. ALWAYS collect customer details (Full Name, Email, Issue Category, Order/Reference Number) before escalating
10. If you do not know the answer and it is not in the knowledge base, say: "I don't have that information right now, but let me connect you with a specialist who can help."

ESCALATION RULES - Connect to a human agent when:
1. Customer explicitly requests a human agent (says "talk to someone", "real person", "human agent")
2. Refund amount exceeds threshold or any refund request involving money
3. Complaint or negative sentiment detected (angry, frustrated, threatening)
4. Technical issue unresolved after 3 message exchanges
5. Legal or compliance questions
6. VIP or enterprise customer identified
7. Failed transactions where money was debited but service not received
8. Account security issues (unauthorized access, suspicious activity)
9. Disputes about charges or billing

WHAT YOU CAN HANDLE WITHOUT ESCALATION:
- General questions about Gravy services (Wallet, Mart, Foods, Logistics)
- How-to questions (how to use features, how to sign up, etc.)
- Information about promotions, pricing, or availability
- Basic troubleshooting (clear cache, update app, check internet connection)
- FAQs and general inquiries
- KYC/verification process questions
- Platform availability questions

RESPONSE GUIDELINES:
- Keep responses short and clear (2-4 sentences when possible)
- Use bullet points only when listing multiple items
- Always be empathetic when the customer has an issue
- Never blame the customer
- If you don't know something, say so honestly and offer to connect them with someone who can help
- Do not make up information that is not in the knowledge base
- When a topic is outside Gravy services, politely decline and redirect to what Gravy does offer
` + knowledgeContext + escalationInstructions;
        return systemPrompt;
    }

    detectRating(content) {
        if (!content) return null;
        var trimmed = content.trim();
        // Check if message is just a number 1-5
        if (/^[1-5]$/.test(trimmed)) return parseInt(trimmed);
        // Check for patterns like "I rate 4" or "my rating is 3" or "4 stars" or "rating: 5"
        var match = trimmed.match(/(?:rate|rating|score)[:\s]*([1-5])|([1-5])\s*(?:stars?|out of|\/)\s*5/i);
        if (match) return parseInt(match[1] || match[2]);
        return null;
    }
    detectEscalation(content, history) {
        this.logger.info('[ESCALATION] detectEscalation called with content: ' + (content ? content.substring(0, 80) : 'NULL'));
        this.logger.info('[ESCALATION] history length: ' + (history ? history.length : 0));
        
        if (!content) return false;

        // Build full conversation text from ALL customer messages + current
        var allCustomerText = '';
        if (history && history.length > 0) {
            for (var j = 0; j < history.length; j++) {
                if (history[j].sender_type === 'customer' && history[j].content) {
                    allCustomerText += ' ' + history[j].content;
                }
            }
        }
        allCustomerText += ' ' + content;
        var lowerAllText = allCustomerText.toLowerCase();

        // Keywords that indicate complaints needing escalation
        var complaintKeywords = [
            'failed transaction', 'money deducted', 'money debited', 'not received',
            'charged but', 'debit but', 'took my money', 'stole', 'stolen',
            'refund', 'give me back', 'return my money', 'money back',
            'wrong order', 'wrong item', 'missing item', 'damaged', 'broken',
            'not delivered', 'never arrived', 'still waiting for delivery',
            'hacked', 'unauthorized', 'someone accessed', 'suspicious',
            'speak to human', 'talk to agent', 'real person', 'human agent',
            'speak to someone', 'talk to someone', 'real agent',
            'app crash', 'cant login', "can\'t login", 'cannot login', 'app not working',
            'wrong charge', 'overcharged', 'double charged', 'billing issue',
            'very angry', 'disgusted', 'terrible', 'worst service', 'scam',
            'fraud', 'fraudulent', 'report', 'complain', 'complaint',
            'legal', 'lawyer', 'sue', 'court', 'regulatory', 'compliance',
            'vip', 'enterprise', 'corporate', 'business account',
            'unresolved', 'not fixed', 'still broken', 'same problem',
            'disappointed', 'unacceptable', 'ridiculous', 'horrible',
            'want my money', 'where is my money', 'money missing',
            'account locked', 'account blocked', 'cannot access'
        ];

        var isComplaint = false;
        for (var i = 0; i < complaintKeywords.length; i++) {
            if (lowerAllText.includes(complaintKeywords[i])) {
                isComplaint = true;
                this.logger.info('[ESCALATION] Complaint keyword matched: ' + complaintKeywords[i]);
                break;
            }
        }

        if (!isComplaint) {
            this.logger.info('[ESCALATION] No complaint keywords found, returning false');
            return false;
        }

        // Check for customer details in ALL text
        var hasName = false;
        var hasEmail = false;
        var hasReference = false;

        // Check for email pattern
        if (/[a-zA-Z0-9._&+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/.test(allCustomerText)) {
            hasEmail = true;
        }

        // Check for order/transaction reference patterns
        if (/\b(order|ref|reference|txn|transaction|trx|#)\s*[:*\-#]?\s*[A-Za-z0-9]{5,}/i.test(allCustomerText) ||
            /\b[A-Z]{2,4}[\-]?\d{4,}/i.test(allCustomerText)) {
            hasReference = true;
        }

        // Check if name was provided
        if (/my name is\s+\w+/i.test(allCustomerText) || /i am\s+[A-Z][a-z]+/i.test(allCustomerText) ||
            /name:\s*\w+/i.test(allCustomerText) || /full name:\s*\w+/i.test(allCustomerText)) {
            hasName = true;
        }

        this.logger.info('[ESCALATION] Check results: isComplaint=' + isComplaint + ' hasEmail=' + hasEmail + ' hasRef=' + hasReference + ' hasName=' + hasName);

        // Check if customer explicitly requests human agent - escalate immediately regardless of details
        var humanRequestPhrases = ['speak to human', 'talk to agent', 'real person', 'human agent', 'speak to someone', 'talk to someone', 'real agent', 'speak to a person', 'talk to a human', 'want a human', 'need a human', 'get me a manager', 'speak to manager', 'talk to manager', 'supervisor', 'speak to a real', 'talk to a real', 'need to speak', 'want to speak', 'deal with a bot'];
        var requestsHuman = humanRequestPhrases.some(function(phrase) { return allCustomerText.includes(phrase); });
        if (isComplaint && requestsHuman) {
            this.logger.info('[ESCALATION] ==> HANDOFF triggered (customer explicitly requested human agent)!');
            return 'handoff';
        }
        // If complaint detected and details collected, ready for handoff
        if (isComplaint && hasEmail && (hasReference || hasName)) {
            this.logger.info('[ESCALATION] ==> HANDOFF triggered!');
            return 'handoff';
        }

        // Complaint detected but still need to collect info
        this.logger.info('[ESCALATION] ==> COLLECTING (need more details)');
        return 'collecting';
    }

    async escalateToHuman(conversationId) {
        try {
            this.logger.info('Escalation triggered for conversation: ' + conversationId);
            // Guard: skip if already escalated and assigned
            var alreadyEscalated = await this.pool.query(
                "SELECT assigned_agent_id, status FROM conversations WHERE id = $1",
                [conversationId]
            );
            if (alreadyEscalated.rows.length > 0 && alreadyEscalated.rows[0].assigned_agent_id !== null && alreadyEscalated.rows[0].status === 'escalated') {
                this.logger.info('[ESCALATION] Conversation ' + conversationId + ' already escalated - skipping duplicate');
                return;
            }
            
            // 1. Update conversation status to escalated and priority to high
            await this.pool.query(
                "UPDATE conversations SET status = 'escalated', priority = 'high', updated_at = NOW() WHERE id = $1",
                [conversationId]
            );
            this.logger.info('Conversation status set to escalated: ' + conversationId);

            // 2. Find available agent (round-robin)
            var agentResult = await this.pool.query(
                "SELECT id, name, email FROM agents WHERE status = 'available' AND current_chats < max_chats AND role != 'owner' ORDER BY last_assigned_at ASC NULLS FIRST LIMIT 1"
            );
            var assignedAgentId = null;
            var assignedAgentName = 'Unassigned';
            if (agentResult.rows.length > 0) {
                assignedAgentId = agentResult.rows[0].id;
                assignedAgentName = agentResult.rows[0].name || agentResult.rows[0].email;
                // Assign agent to conversation
                await this.pool.query(
                    "UPDATE conversations SET assigned_agent_id = $1, updated_at = NOW() WHERE id = $2",
                    [assignedAgentId, conversationId]
                );
                // Update agent last_assigned_at for round-robin
                await this.pool.query(
                    "UPDATE agents SET last_assigned_at = NOW() WHERE id = $1",
                    [assignedAgentId]
                );
                this.logger.info('Agent assigned: ' + assignedAgentName + ' (' + assignedAgentId + ') to conversation ' + conversationId);
            } else {
                this.logger.warn('No available agents for escalation, conversation ' + conversationId + ' left unassigned');
            }

            // 3. Create resolution record
            var resId = require('crypto').randomUUID();
            await this.pool.query(
                "INSERT INTO resolutions (id, conversation_id, issue_type, owning_team, owner_id, status, priority, title, description, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())",
                [resId, conversationId, 'complaint', 'support', assignedAgentId, 'investigating', 'high', 'Customer Escalation', 'Auto-escalated by AI - customer complaint detected']
            );
            this.logger.info('Resolution created: ' + resId + ' for conversation ' + conversationId);

            // 4. Publish escalation event
            this.eventBus.publish('conversation.escalated', {
                conversationId: conversationId,
                assignedAgentId: assignedAgentId,
                assignedAgentName: assignedAgentName,
                resolutionId: resId,
                reason: 'Customer complaint - details collected',
                timestamp: new Date()
            });
            this.logger.info('Escalation complete for conversation ' + conversationId);
        } catch (error) {
            this.logger.error('Escalation error: ' + error.message);
        }
    }

    async searchKnowledgeBase(content) {
        try {
            if (!content) return [];
            var words = content.split(" ").filter(function(w) {
                return w.length > 2 && !['the','and','for','are','but','not','you','all','can','had','her','was','one','our','out','has','his','how','its','let','may','who','did','get','has','him','his','how','its','she','too','use','what','when','where','which','will','with','this','that','have','from','they','been','said','each','make','like','just','over','such','take','than','them','then','than','into','some','could','other','about','these','would','first','being','their','after','which','those','still','between','should','before','during','without'].includes(w.toLowerCase());
            });
            if (words.length === 0) return [];
            var conditions = [];
            var params = [];
            for (var i = 0; i < Math.min(words.length, 5); i++) {
                params.push('%' + words[i].toLowerCase() + '%');
                conditions.push("(LOWER(title) LIKE $" + (i + 1) + " OR LOWER(content) LIKE $" + (i + 1) + ")");
            }
            var query = "SELECT title, content FROM knowledge_base WHERE status = 'published' AND (" + conditions.join(" OR ") + ") LIMIT 5";
            this.logger.info('KB search words: ' + words.join(', ') + ' | SQL params: ' + JSON.stringify(params));
            var result = await this.pool.query(query, params);
            this.logger.info('KB matched: ' + result.rows.length + ' articles');
            return result.rows;
        } catch (error) {
            this.logger.error('KB search error: ' + error.message);
            return [];
        }
    }

    sanitizeMessages(messages) {
        if (messages.length === 0) return messages;
        var sanitized = [];
        var lastRole = null;
        for (var i = 0; i < messages.length; i++) {
            if (messages[i].role !== lastRole) {
                sanitized.push(messages[i]);
                lastRole = messages[i].role;
            }
        }
        // Ensure first message is from user
        if (sanitized.length > 0 && sanitized[0].role !== 'user') {
            sanitized.shift();
        }
        // Ensure last message is from user
        if (sanitized.length > 0 && sanitized[sanitized.length - 1].role !== 'user') {
            sanitized.pop();
        }
        return sanitized;
    }
}

module.exports = { AIResponseHandler: AIResponseHandler };
