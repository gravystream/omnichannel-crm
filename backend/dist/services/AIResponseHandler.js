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
        this.eventBus.subscribe('message.received', async (event) => {
            try {
                var message = event.payload || event;
                var conversationId = message.conversationId || message.conversation_id;
                if (!conversationId) {
                    this.logger.error('AI Handler: No conversationId in event');
                    return;
                }
                var convRes = await this.pool.query(
                    'SELECT ai_enabled FROM conversations WHERE id = $1',
                    [conversationId]
                );
                if (convRes.rows.length === 0) return;
                if (convRes.rows[0].ai_enabled === false) {
                    this.logger.info('AI Handler: AI disabled for conversation ' + conversationId);
                    return;
                }
                var messageId = message.messageId || message.message_id || message.id;
                this.logger.info('AI Handler: Processing message', { conversationId: conversationId, messageId: messageId });
                await this.processMessage(conversationId, messageId, message.content || message.message);
            } catch (error) {
                this.logger.error('AI Handler error: ' + error.message);
            }
        });
    }

    async processMessage(conversationId, messageId, content) {
        try {
            // Get conversation history for context
            var historyRes = await this.pool.query(
                "SELECT content, sender_type, created_at FROM messages WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT 15",
                [conversationId]
            );
            var history = historyRes.rows.reverse();

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
            if (needsEscalation === 'handoff') {
                await this.escalateToHuman(conversationId);
            }

            // Save AI response to database
            var insertRes = await this.pool.query(
                "INSERT INTO messages (conversation_id, content, sender_type, content_type, created_at) VALUES ($1, $2, 'agent', 'text', NOW()) RETURNING id",
                [conversationId, aiResponse]
            );
            var newMessageId = insertRes.rows[0].id;

            // Publish message.sent event
            this.eventBus.publish('message.sent', {
                payload: {
                    id: newMessageId,
                    conversationId: conversationId,
                    conversation_id: conversationId,
                    content: aiResponse,
                    sender_type: 'agent',
                    content_type: 'text'
                }
            });

            this.logger.info('AI Response sent successfully', { conversationId: conversationId });
        } catch (error) {
            this.logger.error("Anthropic API error: " + error.message);
            // Send fallback message
            var fallback = "I apologize for the inconvenience. Let me connect you with a team member who can assist you right away. Please hold on.";
            var fallbackRes = await this.pool.query(
                "INSERT INTO messages (conversation_id, content, sender_type, content_type, created_at) VALUES ($1, $2, 'agent', 'text', NOW()) RETURNING id",
                [conversationId, fallback]
            );
            this.eventBus.publish('message.sent', {
                payload: {
                    id: fallbackRes.rows[0].id,
                    conversationId: conversationId,
                    conversation_id: conversationId,
                    content: fallback,
                    sender_type: 'agent',
                    content_type: 'text'
                }
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
2. Politely collect the following information if not already provided:
   - Full name
   - Email address
   - Order number OR transaction reference (for transaction failures)
3. Once you have these details, let them know you are connecting them to a human agent who can resolve their issue
4. Say something like: "Thank you for providing those details. Let me connect you with a specialist who can help resolve this for you right away."
`;
        } else if (escalationStatus === 'handoff') {
            escalationInstructions = `

IMPORTANT - HANDOFF MODE:
The customer has provided their details for a complaint. Let them know a human agent will take over shortly. Be warm and reassuring. Tell them their issue is important and someone will be with them very soon.
`;
        }

        var systemPrompt = `You are Starr, an AI Support Agent for Gravy. Gravy is Nigeria's all-in-one lifestyle super app (Wallet, Mart, Foods, Logistics, Travel).

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

ESCALATION RULES - When to connect to a human agent:
1. Failed transactions or payment issues (money debited but service not received)
2. Account security issues (unauthorized access, suspicious activity)
3. Refund requests
4. Complaints about delivery (wrong items, missing items, damaged goods)
5. When the customer explicitly asks to speak to a human agent
6. When the customer is angry/frustrated after 2 or more exchanges and you cannot resolve their issue
7. Technical issues you cannot troubleshoot (app crashes, login failures after basic troubleshooting)
8. Disputes about charges or billing

INFORMATION TO COLLECT BEFORE ESCALATION:
When a complaint requires escalation, you MUST collect these details before handing off:
- Full name
- Email address
- Order number or Transaction reference (for payment/transaction issues)

Ask for these details naturally and politely. For example:
"I understand this is frustrating. So I can get this resolved quickly for you, could you please share your full name, email address, and the order number or transaction reference?"

WHAT YOU CAN HANDLE WITHOUT ESCALATION:
- General questions about Gravy services (Wallet, Mart, Foods, Logistics, Travel)
- How-to questions (how to use features, how to sign up, etc.)
- Information about promotions, pricing, or availability
- Basic troubleshooting (clear cache, update app, check internet connection)
- FAQs and general inquiries

RESPONSE GUIDELINES:
- Keep responses short and clear (2-4 sentences when possible)
- Use bullet points only when listing multiple items
- Always be empathetic when the customer has an issue
- Never blame the customer
- If you don't know something, say so honestly and offer to connect them with someone who can help
- Do not make up information that is not in the knowledge base
` + knowledgeContext + escalationInstructions;

        return systemPrompt;
    }

    detectEscalation(content, history) {
        if (!content) return false;
        var lowerContent = content.toLowerCase();

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
            'app crash', 'cant login', "can't login", 'cannot login', 'app not working',
            'wrong charge', 'overcharged', 'double charged', 'billing issue',
            'very angry', 'disgusted', 'terrible', 'worst service', 'scam',
            'fraud', 'fraudulent', 'report', 'complain', 'complaint'
        ];

        var isComplaint = false;
        for (var i = 0; i < complaintKeywords.length; i++) {
            if (lowerContent.includes(complaintKeywords[i])) {
                isComplaint = true;
                break;
            }
        }

        if (!isComplaint) return false;

        // Check if customer already provided details in conversation history
        var hasName = false;
        var hasEmail = false;
        var hasReference = false;

        var allText = '';
        for (var j = 0; j < history.length; j++) {
            if (history[j].sender_type === 'customer' && history[j].content) {
                allText += ' ' + history[j].content;
            }
        }
        allText += ' ' + content;

        // Check for email pattern
        if (/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(allText)) {
            hasEmail = true;
        }

        // Check for order/transaction reference patterns (alphanumeric codes)
        if (/\b(order|ref|reference|txn|transaction|trx|#)\s*[:\-#]?\s*[A-Za-z0-9]{5,}/i.test(allText) ||
            /\b[A-Z]{2,4}[-]?\d{6,}/i.test(allText)) {
            hasReference = true;
        }

        // Check if name was provided (simple heuristic - look for "my name is" or "i am" patterns)
        if (/my name is\s+\w+/i.test(allText) || /i am\s+[A-Z][a-z]+/i.test(allText) ||
            /name:\s*\w+/i.test(allText) || /full name:\s*\w+/i.test(allText)) {
            hasName = true;
        }

        // If complaint detected and details collected, ready for handoff
        if (isComplaint && hasEmail && (hasReference || hasName)) {
            return 'handoff';
        }

        // Complaint detected but still need to collect info
        if (isComplaint) {
            return 'collecting';
        }

        return false;
    }

    async escalateToHuman(conversationId) {
        try {
            // Disable AI for this conversation so human agent takes over
            await this.pool.query(
                'UPDATE conversations SET ai_enabled = false, status = $1 WHERE id = $2',
                ['waiting', conversationId]
            );
            this.logger.info('Conversation escalated to human agent', { conversationId: conversationId });

            // Publish escalation event
            this.eventBus.publish('conversation.escalated', {
                payload: {
                    conversationId: conversationId,
                    reason: 'Customer complaint - details collected'
                }
            });
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

module.exports = AIResponseHandler;
