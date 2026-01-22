/**
 * First-Contact AI Orchestrator (GATEKEEPER)
 *
 * This AI is NOT a chatbot. It is a classifier, traffic controller, and buffer.
 * It protects human capacity by filtering noise and routing intelligently.
 *
 * ABSOLUTE FAILSAFES:
 * - NEVER block escalation
 * - NEVER fabricate fixes or ETAs
 * - NEVER argue
 * - NEVER override humans
 * - ALWAYS log decisions
 */

import {
  Message,
  Conversation,
  AIClassificationResult,
  Intent,
  Severity,
  Sentiment,
  ExtractedEntities,
  KnowledgeBaseArticle,
  AIAnnotations,
} from '../models';
import { Logger } from '../utils/Logger';
import { EventBus } from './EventBus';
import { KnowledgeBaseService } from '../services/KnowledgeBaseService';

export interface AIConfig {
  provider: 'openai' | 'anthropic' | 'local';
  apiKey?: string;
  modelName: string;
  maxTokens: number;
  temperature: number;
  confidenceThreshold: number;
  maxDeflectionAttempts: number;
  enableKnowledgeDeflection: boolean;
}

interface ClassificationPromptContext {
  content: string;
  conversationHistory?: string[];
  customerTier?: string;
  previousIntent?: Intent;
}

interface DeflectionAttempt {
  conversationId: string;
  attemptCount: number;
  lastAttemptAt: Date;
  successful: boolean;
}

export class AIOrchestrator {
  private config: AIConfig;
  private logger: Logger;
  private eventBus: EventBus;
  private kbService: KnowledgeBaseService;
  private modelVersion: string = 'v1.0.0';

  // Track deflection attempts to prevent loops
  private deflectionAttempts: Map<string, DeflectionAttempt> = new Map();

  // Decision log for audit
  private decisionLog: Array<{
    timestamp: Date;
    conversationId: string;
    messageId: string;
    decision: string;
    confidence: number;
    reasoning: string;
    humanOverride?: boolean;
  }> = [];

  constructor(
    config: AIConfig,
    logger: Logger,
    eventBus: EventBus,
    kbService: KnowledgeBaseService
  ) {
    this.config = config;
    this.logger = logger;
    this.eventBus = eventBus;
    this.kbService = kbService;
  }

  // ============================================================================
  // MAIN CLASSIFICATION (MANDATORY FOR EVERY MESSAGE)
  // ============================================================================

  async classifyMessage(content: string, conversation: Conversation): Promise<AIClassificationResult> {
    const startTime = Date.now();

    this.logger.info('Classifying message', {
      conversationId: conversation.id,
      contentLength: content.length,
    });

    try {
      // Build context for classification
      const context: ClassificationPromptContext = {
        content,
        customerTier: conversation.slaTier,
        previousIntent: conversation.intent,
      };

      // 1. Intent Classification (MANDATORY)
      const intentResult = await this.classifyIntent(context);

      // 2. Severity Assessment
      const severityResult = await this.assessSeverity(context, intentResult.intent);

      // 3. Sentiment Analysis
      const sentimentResult = await this.analyzeSentiment(content);

      // 4. Entity Extraction
      const entities = await this.extractEntities(content);

      // 5. Determine suggested action
      const suggestedAction = this.determineSuggestedAction(
        intentResult,
        severityResult,
        sentimentResult,
        conversation
      );

      // 6. Get KB suggestions if applicable
      let suggestedKbArticles: string[] = [];
      let suggestedResponse: string | undefined;

      if (
        suggestedAction === 'deflect' &&
        this.config.enableKnowledgeDeflection &&
        intentResult.intent === Intent.HOW_TO_GUIDANCE
      ) {
        const kbResults = await this.findRelevantKnowledgeArticles(content);
        suggestedKbArticles = kbResults.map((a) => a.id);

        if (kbResults.length > 0) {
          suggestedResponse = await this.generateDeflectionResponse(content, kbResults[0]);
        }
      }

      // 7. Determine required skills
      const suggestedSkills = this.determineSuggestedSkills(intentResult.intent, entities);

      // 8. Should escalate?
      const escalationRecommended = this.shouldRecommendEscalation(
        intentResult,
        severityResult,
        sentimentResult,
        conversation
      );

      const processingTime = Date.now() - startTime;

      const result: AIClassificationResult = {
        intent: intentResult.intent,
        intentConfidence: intentResult.confidence,
        severity: severityResult.severity,
        severityConfidence: severityResult.confidence,
        sentiment: sentimentResult.sentiment,
        sentimentScore: sentimentResult.score,
        entities,
        suspectedRootCause: this.determineSuspectedRootCause(intentResult.intent, entities),
        suggestedAction,
        suggestedResponse,
        suggestedKbArticles,
        suggestedSkills,
        escalationRecommended,
        modelVersion: this.modelVersion,
        processingTimeMs: processingTime,
        reasoning: this.buildReasoningString(intentResult, severityResult, escalationRecommended),
      };

      // Log decision for audit
      this.logDecision(
        conversation.id,
        'message-classification',
        `${result.intent}:${result.severity}`,
        result.intentConfidence,
        result.reasoning || ''
      );

      this.logger.info('Classification complete', {
        conversationId: conversation.id,
        intent: result.intent,
        severity: result.severity,
        action: result.suggestedAction,
        processingTime,
      });

      return result;
    } catch (error) {
      this.logger.error('Classification failed', {
        conversationId: conversation.id,
        error,
      });

      // FAILSAFE: On error, default to escalation
      return this.getFailsafeClassification(content, Date.now() - startTime);
    }
  }

  // ============================================================================
  // INTENT CLASSIFICATION
  // ============================================================================

  private async classifyIntent(
    context: ClassificationPromptContext
  ): Promise<{ intent: Intent; confidence: number }> {
    const prompt = this.buildIntentClassificationPrompt(context);

    try {
      const response = await this.callLLM(prompt);
      return this.parseIntentResponse(response);
    } catch (error) {
      this.logger.error('Intent classification failed', { error });
      return { intent: Intent.UNKNOWN, confidence: 0 };
    }
  }

  private buildIntentClassificationPrompt(context: ClassificationPromptContext): string {
    return `Classify the following customer message into exactly ONE of these categories:

1. HOW_TO_GUIDANCE - Questions about how to use features, processes, or get information
2. ACCOUNT_ACCESS_ISSUE - Login problems, password reset, account locked, permissions
3. TRANSACTION_SYSTEM_FAILURE - Payment failed, order not processing, system errors affecting transactions
4. BUG_TECHNICAL_DEFECT - Software bugs, unexpected behavior, technical issues
5. URGENT_HIGH_RISK - Security concerns, fraud, legal issues, critical business impact
6. NOISE_LOW_INTENT - Spam, random messages, tests, or messages with no clear intent

Customer Message: "${context.content}"
${context.customerTier ? `Customer Tier: ${context.customerTier}` : ''}
${context.previousIntent ? `Previous Intent: ${context.previousIntent}` : ''}

Respond in JSON format:
{
  "intent": "CATEGORY_NAME",
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation"
}`;
  }

  private parseIntentResponse(response: string): { intent: Intent; confidence: number } {
    try {
      const parsed = JSON.parse(response);

      const intentMap: Record<string, Intent> = {
        HOW_TO_GUIDANCE: Intent.HOW_TO_GUIDANCE,
        ACCOUNT_ACCESS_ISSUE: Intent.ACCOUNT_ACCESS_ISSUE,
        TRANSACTION_SYSTEM_FAILURE: Intent.TRANSACTION_SYSTEM_FAILURE,
        BUG_TECHNICAL_DEFECT: Intent.BUG_TECHNICAL_DEFECT,
        URGENT_HIGH_RISK: Intent.URGENT_HIGH_RISK,
        NOISE_LOW_INTENT: Intent.NOISE_LOW_INTENT,
      };

      return {
        intent: intentMap[parsed.intent] || Intent.UNKNOWN,
        confidence: Math.min(1, Math.max(0, parsed.confidence)),
      };
    } catch {
      return { intent: Intent.UNKNOWN, confidence: 0 };
    }
  }

  // ============================================================================
  // SEVERITY ASSESSMENT
  // ============================================================================

  private async assessSeverity(
    context: ClassificationPromptContext,
    intent: Intent
  ): Promise<{ severity: Severity; confidence: number }> {
    // Some intents have automatic severity
    if (intent === Intent.URGENT_HIGH_RISK) {
      return { severity: Severity.P0, confidence: 0.95 };
    }

    if (intent === Intent.TRANSACTION_SYSTEM_FAILURE) {
      return { severity: Severity.P1, confidence: 0.85 };
    }

    if (intent === Intent.NOISE_LOW_INTENT) {
      return { severity: Severity.P3, confidence: 0.9 };
    }

    // For other intents, analyze content
    const urgencyIndicators = this.findUrgencyIndicators(context.content);

    if (urgencyIndicators.critical) {
      return { severity: Severity.P0, confidence: 0.85 };
    }

    if (urgencyIndicators.high) {
      return { severity: Severity.P1, confidence: 0.75 };
    }

    if (urgencyIndicators.normal) {
      return { severity: Severity.P2, confidence: 0.8 };
    }

    return { severity: Severity.P2, confidence: 0.7 };
  }

  private findUrgencyIndicators(content: string): {
    critical: boolean;
    high: boolean;
    normal: boolean;
  } {
    const lowerContent = content.toLowerCase();

    const criticalKeywords = [
      'fraud',
      'security breach',
      'hacked',
      'stolen',
      'unauthorized',
      'legal',
      'lawsuit',
      'data leak',
      'compliance',
      'urgent',
      'emergency',
      'critical',
      'immediately',
      'asap',
    ];

    const highKeywords = [
      'cannot access',
      "can't login",
      'payment failed',
      'not working',
      'broken',
      'down',
      'outage',
      'error',
      'blocked',
      'locked out',
      'deadline',
    ];

    return {
      critical: criticalKeywords.some((kw) => lowerContent.includes(kw)),
      high: highKeywords.some((kw) => lowerContent.includes(kw)),
      normal: true,
    };
  }

  // ============================================================================
  // SENTIMENT ANALYSIS
  // ============================================================================

  private async analyzeSentiment(
    content: string
  ): Promise<{ sentiment: Sentiment; score: number }> {
    const lowerContent = content.toLowerCase();

    // Quick heuristic analysis
    const angryIndicators = [
      'furious',
      'outraged',
      'unacceptable',
      'ridiculous',
      'worst',
      'terrible',
      'awful',
      '!!!',
      'sue',
      'lawyer',
      'incompetent',
    ];

    const negativeIndicators = [
      'frustrated',
      'disappointed',
      'annoyed',
      'unhappy',
      'problem',
      'issue',
      'fail',
      'bad',
      'poor',
      "doesn't work",
      "can't",
      'unable',
    ];

    const positiveIndicators = [
      'thank',
      'great',
      'excellent',
      'awesome',
      'love',
      'perfect',
      'wonderful',
      'appreciate',
      'helpful',
      'amazing',
    ];

    const angryCount = angryIndicators.filter((i) => lowerContent.includes(i)).length;
    const negativeCount = negativeIndicators.filter((i) => lowerContent.includes(i)).length;
    const positiveCount = positiveIndicators.filter((i) => lowerContent.includes(i)).length;

    if (angryCount >= 2 || (angryCount >= 1 && content.includes('!!!'))) {
      return { sentiment: Sentiment.ANGRY, score: -0.9 };
    }

    if (angryCount >= 1 || negativeCount >= 3) {
      return { sentiment: Sentiment.NEGATIVE, score: -0.6 };
    }

    if (positiveCount >= 2) {
      return { sentiment: Sentiment.POSITIVE, score: 0.7 };
    }

    if (negativeCount >= 1) {
      return { sentiment: Sentiment.NEGATIVE, score: -0.3 };
    }

    return { sentiment: Sentiment.NEUTRAL, score: 0 };
  }

  // ============================================================================
  // ENTITY EXTRACTION
  // ============================================================================

  private async extractEntities(content: string): Promise<ExtractedEntities> {
    const entities: ExtractedEntities = {};

    // Transaction IDs (various formats)
    const transactionPatterns = [
      /TXN[-_]?\d{6,}/gi,
      /ORDER[-_]?\d{6,}/gi,
      /INV[-_]?\d{6,}/gi,
      /#\d{6,}/g,
    ];

    entities.transactionIds = [];
    for (const pattern of transactionPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        entities.transactionIds.push(...matches);
      }
    }

    // Error codes
    const errorPattern = /(?:error|code|err)[\s:]*([A-Z0-9_-]{3,})/gi;
    const errorMatches = [...content.matchAll(errorPattern)];
    entities.errorCodes = errorMatches.map((m) => m[1]);

    // Account IDs
    const accountPattern = /(?:account|acct|user)[\s#:]*([A-Z0-9-]{6,})/gi;
    const accountMatches = [...content.matchAll(accountPattern)];
    entities.accountIds = accountMatches.map((m) => m[1]);

    // Emails
    const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    entities.emails = content.match(emailPattern) || [];

    // Phone numbers
    const phonePattern = /(?:\+?1[-.]?)?\(?[0-9]{3}\)?[-.]?[0-9]{3}[-.]?[0-9]{4}/g;
    entities.phoneNumbers = content.match(phonePattern) || [];

    // URLs
    const urlPattern = /https?:\/\/[^\s]+/g;
    entities.urls = content.match(urlPattern) || [];

    // Amounts
    const amountPattern = /\$[\d,]+\.?\d*/g;
    const amountMatches = content.match(amountPattern) || [];
    entities.amounts = amountMatches.map((a) => ({
      value: parseFloat(a.replace(/[$,]/g, '')),
      currency: 'USD',
    }));

    return entities;
  }

  // ============================================================================
  // KNOWLEDGE DEFLECTION
  // ============================================================================

  private async findRelevantKnowledgeArticles(query: string): Promise<KnowledgeBaseArticle[]> {
    try {
      const articles = await this.kbService.search(query, {
        visibility: 'customer',
        limit: 3,
      });
      return articles.filter((a) => !a.excludeFromAi);
    } catch (error) {
      this.logger.error('KB search failed', { error });
      return [];
    }
  }

  private async generateDeflectionResponse(
    query: string,
    article: KnowledgeBaseArticle
  ): Promise<string> {
    // Generate a helpful response based on the KB article
    // This is NOT a chatbot response - it's a factual, step-by-step answer

    const prompt = `Based on the following knowledge base article, provide a concise, step-by-step answer to the customer's question. Be helpful but brief. Always offer escalation at the end.

Customer Question: "${query}"

Knowledge Base Article:
Title: ${article.title}
Content: ${article.content}

Rules:
- Provide clear, numbered steps if applicable
- Keep the response under 200 words
- Reference the article title
- End with: "If this doesn't resolve your issue, I can connect you with a support agent."

Response:`;

    try {
      const response = await this.callLLM(prompt);
      return response;
    } catch (error) {
      // Fallback to article summary
      return `Based on our help article "${article.title}": ${article.summary || article.content.slice(0, 200)}...\n\nIf this doesn't resolve your issue, I can connect you with a support agent.`;
    }
  }

  // ============================================================================
  // ACTION DETERMINATION
  // ============================================================================

  private determineSuggestedAction(
    intentResult: { intent: Intent; confidence: number },
    severityResult: { severity: Severity; confidence: number },
    sentimentResult: { sentiment: Sentiment; score: number },
    conversation: Conversation
  ): 'deflect' | 'route' | 'escalate' | 'resolve' {
    // FAILSAFE: Low confidence always escalates
    if (intentResult.confidence < this.config.confidenceThreshold) {
      return 'escalate';
    }

    // Critical severity always escalates
    if (severityResult.severity === Severity.P0) {
      return 'escalate';
    }

    // Angry customers go to humans
    if (sentimentResult.sentiment === Sentiment.ANGRY) {
      return 'escalate';
    }

    // Noise can be auto-resolved
    if (intentResult.intent === Intent.NOISE_LOW_INTENT && intentResult.confidence > 0.85) {
      return 'resolve';
    }

    // How-to questions can potentially be deflected
    if (intentResult.intent === Intent.HOW_TO_GUIDANCE && this.config.enableKnowledgeDeflection) {
      const attempts = this.deflectionAttempts.get(conversation.id);
      if (!attempts || attempts.attemptCount < this.config.maxDeflectionAttempts) {
        return 'deflect';
      }
    }

    // Everything else routes to human
    return 'route';
  }

  // ============================================================================
  // ESCALATION RECOMMENDATION
  // ============================================================================

  private shouldRecommendEscalation(
    intentResult: { intent: Intent; confidence: number },
    severityResult: { severity: Severity; confidence: number },
    sentimentResult: { sentiment: Sentiment; score: number },
    conversation: Conversation
  ): boolean {
    // ABSOLUTE: Never block escalation - this just recommends

    // Technical issues + P0/P1 = recommend escalation to engineering
    if (
      intentResult.intent === Intent.BUG_TECHNICAL_DEFECT &&
      (severityResult.severity === Severity.P0 || severityResult.severity === Severity.P1)
    ) {
      return true;
    }

    // System failures always escalate
    if (intentResult.intent === Intent.TRANSACTION_SYSTEM_FAILURE) {
      return true;
    }

    // Urgent/high-risk always escalates
    if (intentResult.intent === Intent.URGENT_HIGH_RISK) {
      return true;
    }

    // Angry + negative progress
    if (
      sentimentResult.sentiment === Sentiment.ANGRY &&
      conversation.messageCount > 3
    ) {
      return true;
    }

    // Low confidence
    if (intentResult.confidence < this.config.confidenceThreshold) {
      return true;
    }

    return false;
  }

  // ============================================================================
  // SKILL DETERMINATION
  // ============================================================================

  private determineSuggestedSkills(intent: Intent, entities: ExtractedEntities): string[] {
    const skills: string[] = [];

    switch (intent) {
      case Intent.ACCOUNT_ACCESS_ISSUE:
        skills.push('authentication', 'account-management');
        break;
      case Intent.TRANSACTION_SYSTEM_FAILURE:
        skills.push('payments', 'transactions');
        if (entities.amounts && entities.amounts.length > 0) {
          skills.push('billing');
        }
        break;
      case Intent.BUG_TECHNICAL_DEFECT:
        skills.push('technical', 'debugging');
        break;
      case Intent.URGENT_HIGH_RISK:
        skills.push('escalation', 'senior-support');
        break;
      case Intent.HOW_TO_GUIDANCE:
        skills.push('general-support', 'product-knowledge');
        break;
    }

    return [...new Set(skills)];
  }

  // ============================================================================
  // ROOT CAUSE SUSPICION
  // ============================================================================

  private determineSuspectedRootCause(
    intent: Intent,
    entities: ExtractedEntities
  ): string | undefined {
    if (intent === Intent.ACCOUNT_ACCESS_ISSUE) {
      return 'Possible authentication or account configuration issue';
    }

    if (intent === Intent.TRANSACTION_SYSTEM_FAILURE) {
      if (entities.errorCodes && entities.errorCodes.length > 0) {
        return `Transaction failure with error codes: ${entities.errorCodes.join(', ')}`;
      }
      return 'Transaction processing failure - needs investigation';
    }

    if (intent === Intent.BUG_TECHNICAL_DEFECT) {
      if (entities.errorCodes && entities.errorCodes.length > 0) {
        return `Software defect indicated by error: ${entities.errorCodes[0]}`;
      }
      return 'Potential software defect - needs reproduction';
    }

    return undefined;
  }

  // ============================================================================
  // SUMMARY GENERATION
  // ============================================================================

  async generateSummary(messages: Message[]): Promise<string> {
    if (messages.length === 0) {
      return 'No messages in conversation.';
    }

    const messageText = messages
      .slice(0, 10)
      .map((m) => `${m.senderType}: ${m.content}`)
      .join('\n');

    const prompt = `Summarize this customer support conversation in 2-3 sentences. Focus on the main issue and current status.

Conversation:
${messageText}

Summary:`;

    try {
      return await this.callLLM(prompt);
    } catch (error) {
      // Fallback to basic summary
      const firstCustomerMessage = messages.find((m) => m.senderType === 'customer');
      return firstCustomerMessage
        ? `Customer inquiry about: ${firstCustomerMessage.content.slice(0, 100)}...`
        : 'Conversation summary unavailable.';
    }
  }

  // ============================================================================
  // FAILSAFE CLASSIFICATION
  // ============================================================================

  private getFailsafeClassification(content: string, processingTime: number): AIClassificationResult {
    // When AI fails, provide safe defaults that don't block humans
    return {
      intent: Intent.UNKNOWN,
      intentConfidence: 0,
      severity: Severity.P2, // Default to normal, not low
      severityConfidence: 0,
      sentiment: Sentiment.NEUTRAL,
      sentimentScore: 0,
      entities: {},
      suggestedAction: 'route', // Always route to human on failure
      suggestedKbArticles: [],
      suggestedSkills: ['general-support'],
      escalationRecommended: true, // Recommend human review
      modelVersion: this.modelVersion,
      processingTimeMs: processingTime,
      reasoning: 'AI classification failed - routing to human for review',
    };
  }

  // ============================================================================
  // HUMAN OVERRIDE HANDLING
  // ============================================================================

  async recordHumanCorrection(
    messageId: string,
    conversationId: string,
    corrections: Partial<AIAnnotations>,
    correctedById: string,
    notes?: string
  ): Promise<void> {
    this.logger.info('Recording human correction', {
      messageId,
      conversationId,
      corrections,
      correctedById,
    });

    // Log the override
    this.logDecision(
      conversationId,
      `human-override:${messageId}`,
      JSON.stringify(corrections),
      1.0,
      notes || 'Human correction applied',
      true
    );

    // Emit for learning loop
    await this.eventBus.publish('ai.human_correction', {
      messageId,
      conversationId,
      corrections,
      correctedById,
      timestamp: new Date(),
    });
  }

  // ============================================================================
  // DECISION LOGGING (FOR AUDIT)
  // ============================================================================

  private logDecision(
    conversationId: string,
    decision: string,
    value: string,
    confidence: number,
    reasoning: string,
    humanOverride: boolean = false
  ): void {
    this.decisionLog.push({
      timestamp: new Date(),
      conversationId,
      messageId: decision,
      decision: value,
      confidence,
      reasoning,
      humanOverride,
    });

    // Trim log if too large
    if (this.decisionLog.length > 10000) {
      this.decisionLog = this.decisionLog.slice(-5000);
    }
  }

  // ============================================================================
  // REASONING STRING
  // ============================================================================

  private buildReasoningString(
    intentResult: { intent: Intent; confidence: number },
    severityResult: { severity: Severity; confidence: number },
    escalationRecommended: boolean
  ): string {
    const parts: string[] = [];

    parts.push(`Intent: ${intentResult.intent} (${(intentResult.confidence * 100).toFixed(0)}%)`);
    parts.push(
      `Severity: ${severityResult.severity} (${(severityResult.confidence * 100).toFixed(0)}%)`
    );

    if (escalationRecommended) {
      parts.push('Escalation recommended');
    }

    if (intentResult.confidence < this.config.confidenceThreshold) {
      parts.push('Low confidence - human review needed');
    }

    return parts.join('. ');
  }

  // ============================================================================
  // LLM CALL (ABSTRACTED)
  // ============================================================================

  private async callLLM(prompt: string): Promise<string> {
    // This would integrate with actual LLM provider
    // For now, return a mock response structure

    switch (this.config.provider) {
      case 'openai':
        return this.callOpenAI(prompt);
      case 'anthropic':
        return this.callAnthropic(prompt);
      case 'local':
        return this.callLocalLLM(prompt);
      default:
        throw new Error(`Unknown AI provider: ${this.config.provider}`);
    }
  }

  private async callOpenAI(prompt: string): Promise<string> {
    // OpenAI API integration
    // const response = await fetch('https://api.openai.com/v1/chat/completions', {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     'Authorization': `Bearer ${this.config.apiKey}`,
    //   },
    //   body: JSON.stringify({
    //     model: this.config.modelName,
    //     messages: [{ role: 'user', content: prompt }],
    //     max_tokens: this.config.maxTokens,
    //     temperature: this.config.temperature,
    //   }),
    // });
    // const data = await response.json();
    // return data.choices[0].message.content;

    // Mock implementation
    return this.mockLLMResponse(prompt);
  }

  private async callAnthropic(prompt: string): Promise<string> {
    // Anthropic API integration
    // Similar to OpenAI implementation
    return this.mockLLMResponse(prompt);
  }

  private async callLocalLLM(prompt: string): Promise<string> {
    // Local LLM integration (e.g., Ollama)
    return this.mockLLMResponse(prompt);
  }

  private mockLLMResponse(prompt: string): string {
    // Simple mock for development
    if (prompt.includes('Classify the following customer message')) {
      return JSON.stringify({
        intent: 'HOW_TO_GUIDANCE',
        confidence: 0.85,
        reasoning: 'Customer is asking for help with a process',
      });
    }

    if (prompt.includes('Summarize')) {
      return 'Customer contacted support regarding their issue. The conversation is ongoing.';
    }

    return 'Mock LLM response';
  }

  // ============================================================================
  // DEFLECTION TRACKING
  // ============================================================================

  trackDeflectionAttempt(conversationId: string, successful: boolean): void {
    const existing = this.deflectionAttempts.get(conversationId);

    if (existing) {
      existing.attemptCount++;
      existing.lastAttemptAt = new Date();
      existing.successful = successful;
    } else {
      this.deflectionAttempts.set(conversationId, {
        conversationId,
        attemptCount: 1,
        lastAttemptAt: new Date(),
        successful,
      });
    }
  }

  getDeflectionAttempts(conversationId: string): DeflectionAttempt | undefined {
    return this.deflectionAttempts.get(conversationId);
  }
}

export default AIOrchestrator;
