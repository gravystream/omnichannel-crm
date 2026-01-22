/**
 * Conversation Engine - The Heart of the System
 *
 * Manages the entire conversation lifecycle across all channels.
 * Ensures zero context loss as conversations flow between channels.
 */

import { EventEmitter } from 'events';
import {
  Conversation,
  ConversationState,
  Message,
  Customer,
  Channel,
  MessageDirection,
  SenderType,
  NormalizedMessage,
  AIAnnotations,
  Severity,
  Intent,
  Sentiment,
  SLATier,
  HandoffBrief,
} from '../models';
import { EventBus, EventType } from './EventBus';
import { CustomerService } from '../services/CustomerService';
import { MessageRepository } from '../repositories/MessageRepository';
import { ConversationRepository } from '../repositories/ConversationRepository';
import { SLAService } from '../services/SLAService';
import { AIOrchestrator } from './AIOrchestrator';
import { Logger } from '../utils/Logger';

export interface ConversationEngineConfig {
  autoClassify: boolean;
  autoRoute: boolean;
  chatTimeoutMinutes: number;
  emailContinuationEnabled: boolean;
  maxMessagesPerConversation: number;
}

export interface CreateConversationInput {
  customerId: string;
  channel: Channel;
  initialMessage?: {
    content: string;
    contentType: 'text' | 'html' | 'markdown';
    attachments?: Array<{ url: string; filename: string; contentType: string }>;
  };
  subject?: string;
  metadata?: Record<string, any>;
}

export interface AddMessageInput {
  conversationId: string;
  channel: Channel;
  direction: MessageDirection;
  senderType: SenderType;
  senderId?: string;
  content: string;
  contentType: 'text' | 'html' | 'markdown' | 'voice_transcript';
  contentHtml?: string;
  attachments?: Array<{ url: string; filename: string; contentType: string; sizeBytes?: number }>;
  channelMessageId?: string;
  channelMetadata?: Record<string, any>;
  parentMessageId?: string;
  threadId?: string;
}

export class ConversationEngine extends EventEmitter {
  private config: ConversationEngineConfig;
  private eventBus: EventBus;
  private customerService: CustomerService;
  private messageRepo: MessageRepository;
  private conversationRepo: ConversationRepository;
  private slaService: SLAService;
  private aiOrchestrator: AIOrchestrator;
  private logger: Logger;

  // Active chat sessions for timeout tracking
  private activeChatSessions: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    config: ConversationEngineConfig,
    eventBus: EventBus,
    customerService: CustomerService,
    messageRepo: MessageRepository,
    conversationRepo: ConversationRepository,
    slaService: SLAService,
    aiOrchestrator: AIOrchestrator,
    logger: Logger
  ) {
    super();
    this.config = config;
    this.eventBus = eventBus;
    this.customerService = customerService;
    this.messageRepo = messageRepo;
    this.conversationRepo = conversationRepo;
    this.slaService = slaService;
    this.aiOrchestrator = aiOrchestrator;
    this.logger = logger;

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Listen for chat timeouts
    this.on('chat:timeout', this.handleChatTimeout.bind(this));
  }

  // ============================================================================
  // CONVERSATION CREATION
  // ============================================================================

  async createConversation(input: CreateConversationInput): Promise<Conversation> {
    const { customerId, channel, initialMessage, subject, metadata } = input;

    this.logger.info('Creating conversation', { customerId, channel });

    // Get customer for SLA tier
    const customer = await this.customerService.getById(customerId);
    if (!customer) {
      throw new Error(`Customer not found: ${customerId}`);
    }

    // Calculate SLA deadlines
    const slaTimes = await this.slaService.calculateDeadlines(customer.slaTier, channel);

    // Create conversation
    const conversation: Partial<Conversation> = {
      customerId,
      state: ConversationState.OPEN,
      channelsUsed: [channel],
      currentChannel: channel,
      initialChannel: channel,
      slaTier: customer.slaTier,
      firstResponseDueAt: slaTimes.firstResponseDueAt,
      resolutionDueAt: slaTimes.resolutionDueAt,
      slaBreached: false,
      subject,
      tags: [],
      metadata: metadata || {},
      messageCount: 0,
      internalNoteCount: 0,
    };

    const created = await this.conversationRepo.create(conversation);

    // Emit event
    await this.eventBus.publish('conversation.created', {
      conversationId: created.id,
      customerId,
      channel,
      slaTier: customer.slaTier,
    });

    this.logger.info('Conversation created', { conversationId: created.id });

    // Add initial message if provided
    if (initialMessage) {
      await this.addMessage({
        conversationId: created.id,
        channel,
        direction: MessageDirection.INBOUND,
        senderType: SenderType.CUSTOMER,
        content: initialMessage.content,
        contentType: initialMessage.contentType,
        attachments: initialMessage.attachments,
      });
    }

    // Start chat timeout tracking for live chat
    if (channel === Channel.WEB_CHAT) {
      this.startChatTimeout(created.id);
    }

    return created;
  }

  // ============================================================================
  // MESSAGE HANDLING
  // ============================================================================

  async addMessage(input: AddMessageInput): Promise<Message> {
    const {
      conversationId,
      channel,
      direction,
      senderType,
      senderId,
      content,
      contentType,
      contentHtml,
      attachments,
      channelMessageId,
      channelMetadata,
      parentMessageId,
      threadId,
    } = input;

    this.logger.info('Adding message', { conversationId, channel, direction, senderType });

    // Get conversation
    const conversation = await this.conversationRepo.getById(conversationId);
    if (!conversation) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }

    // Create message
    const message: Partial<Message> = {
      conversationId,
      channel,
      direction,
      senderType,
      senderId,
      contentType,
      content,
      contentHtml,
      channelMessageId,
      channelMetadata: channelMetadata || {},
      parentMessageId,
      threadId,
      aiProcessed: false,
      aiAnnotations: {},
      status: direction === MessageDirection.OUTBOUND ? 'pending' : 'delivered',
      attachments: [],
    };

    const created = await this.messageRepo.create(message, attachments);

    // Update conversation
    const updates: Partial<Conversation> = {
      lastMessageAt: new Date(),
      messageCount: conversation.messageCount + 1,
    };

    // Track channel usage
    if (!conversation.channelsUsed.includes(channel)) {
      updates.channelsUsed = [...conversation.channelsUsed, channel];
    }
    updates.currentChannel = channel;

    // Update timing based on direction
    if (direction === MessageDirection.INBOUND && senderType === SenderType.CUSTOMER) {
      updates.lastCustomerMessageAt = new Date();

      // Reset chat timeout for web chat
      if (channel === Channel.WEB_CHAT) {
        this.resetChatTimeout(conversationId);
      }

      // Update state if conversation was awaiting customer
      if (conversation.state === ConversationState.AWAITING_CUSTOMER) {
        updates.state = ConversationState.AWAITING_AGENT;
        updates.previousState = conversation.state;
      }
    } else if (direction === MessageDirection.OUTBOUND && senderType === SenderType.AGENT) {
      updates.lastAgentMessageAt = new Date();

      // Track first response
      if (!conversation.firstResponseAt) {
        updates.firstResponseAt = new Date();
      }

      // Update state if conversation was open or awaiting agent
      if (
        conversation.state === ConversationState.OPEN ||
        conversation.state === ConversationState.AWAITING_AGENT
      ) {
        updates.state = ConversationState.AWAITING_CUSTOMER;
        updates.previousState = conversation.state;
      }
    }

    await this.conversationRepo.update(conversationId, updates);

    // Emit event
    await this.eventBus.publish('message.received', {
      messageId: created.id,
      conversationId,
      channel,
      direction,
      senderType,
      customerId: conversation.customerId,
    });

    // Process with AI if enabled and it's an inbound customer message
    if (
      this.config.autoClassify &&
      direction === MessageDirection.INBOUND &&
      senderType === SenderType.CUSTOMER
    ) {
      this.processWithAI(created, conversation).catch((err) => {
        this.logger.error('AI processing failed', { messageId: created.id, error: err.message });
      });
    }

    return created;
  }

  // ============================================================================
  // AI PROCESSING
  // ============================================================================

  private async processWithAI(message: Message, conversation: Conversation): Promise<void> {
    this.logger.info('Processing message with AI', { messageId: message.id });

    try {
      // Classify the message
      const classification = await this.aiOrchestrator.classifyMessage(
        message.content,
        conversation
      );

      // Update message with AI annotations
      const annotations: AIAnnotations = {
        intent: classification.intent,
        intentConfidence: classification.intentConfidence,
        severity: classification.severity,
        severityConfidence: classification.severityConfidence,
        sentiment: classification.sentiment,
        sentimentScore: classification.sentimentScore,
        entities: classification.entities,
        suspectedRootCause: classification.suspectedRootCause,
        suggestedAction: classification.suggestedAction,
        suggestedResponse: classification.suggestedResponse,
        suggestedKbArticles: classification.suggestedKbArticles,
        suggestedSkills: classification.suggestedSkills,
        escalationRecommended: classification.escalationRecommended,
        modelVersion: classification.modelVersion,
        processingTimeMs: classification.processingTimeMs,
      };

      await this.messageRepo.updateAIAnnotations(message.id, annotations);

      // Update conversation classification
      const conversationUpdates: Partial<Conversation> = {
        intent: classification.intent,
        severity: classification.severity,
        sentiment: classification.sentiment,
        requiredSkills: classification.suggestedSkills,
      };

      await this.conversationRepo.update(conversation.id, conversationUpdates);

      // Emit classification event
      await this.eventBus.publish('message.classified', {
        messageId: message.id,
        conversationId: conversation.id,
        intent: classification.intent,
        severity: classification.severity,
        suggestedAction: classification.suggestedAction,
        escalationRecommended: classification.escalationRecommended,
      });

      this.logger.info('AI classification complete', {
        messageId: message.id,
        intent: classification.intent,
        severity: classification.severity,
      });
    } catch (error) {
      this.logger.error('AI processing error', { messageId: message.id, error });
      // Don't throw - AI failure shouldn't break the message flow
    }
  }

  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================

  async changeState(
    conversationId: string,
    newState: ConversationState,
    reason?: string
  ): Promise<Conversation> {
    const conversation = await this.conversationRepo.getById(conversationId);
    if (!conversation) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }

    const previousState = conversation.state;

    // Validate state transition
    if (!this.isValidStateTransition(previousState, newState)) {
      throw new Error(`Invalid state transition: ${previousState} -> ${newState}`);
    }

    const updates: Partial<Conversation> = {
      state: newState,
      previousState,
    };

    // Handle state-specific updates
    if (newState === ConversationState.RESOLVED) {
      updates.resolvedAt = new Date();
      this.cancelChatTimeout(conversationId);
    } else if (newState === ConversationState.REOPENED) {
      updates.reopenedAt = new Date();
      // Recalculate SLA
      const customer = await this.customerService.getById(conversation.customerId);
      const slaTimes = await this.slaService.calculateDeadlines(
        customer!.slaTier,
        conversation.currentChannel || conversation.initialChannel
      );
      updates.resolutionDueAt = slaTimes.resolutionDueAt;
      updates.slaBreached = false;
    }

    const updated = await this.conversationRepo.update(conversationId, updates);

    // Emit event
    await this.eventBus.publish('conversation.state_changed', {
      conversationId,
      previousState,
      newState,
      reason,
      customerId: conversation.customerId,
    });

    this.logger.info('Conversation state changed', {
      conversationId,
      previousState,
      newState,
    });

    return updated;
  }

  private isValidStateTransition(from: ConversationState, to: ConversationState): boolean {
    const validTransitions: Record<ConversationState, ConversationState[]> = {
      [ConversationState.OPEN]: [
        ConversationState.AWAITING_CUSTOMER,
        ConversationState.AWAITING_AGENT,
        ConversationState.ESCALATED,
        ConversationState.RESOLVED,
      ],
      [ConversationState.AWAITING_CUSTOMER]: [
        ConversationState.AWAITING_AGENT,
        ConversationState.ESCALATED,
        ConversationState.RESOLVED,
      ],
      [ConversationState.AWAITING_AGENT]: [
        ConversationState.AWAITING_CUSTOMER,
        ConversationState.ESCALATED,
        ConversationState.RESOLVED,
      ],
      [ConversationState.ESCALATED]: [
        ConversationState.AWAITING_CUSTOMER,
        ConversationState.AWAITING_AGENT,
        ConversationState.RESOLVED,
      ],
      [ConversationState.RESOLVED]: [ConversationState.REOPENED],
      [ConversationState.REOPENED]: [
        ConversationState.AWAITING_CUSTOMER,
        ConversationState.AWAITING_AGENT,
        ConversationState.ESCALATED,
        ConversationState.RESOLVED,
      ],
    };

    return validTransitions[from]?.includes(to) ?? false;
  }

  // ============================================================================
  // ASSIGNMENT
  // ============================================================================

  async assign(
    conversationId: string,
    agentId: string,
    teamId?: string,
    reason?: string
  ): Promise<Conversation> {
    const conversation = await this.conversationRepo.getById(conversationId);
    if (!conversation) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }

    const updates: Partial<Conversation> = {
      assignedAgentId: agentId,
      assignedTeamId: teamId,
    };

    // Update state if needed
    if (
      conversation.state === ConversationState.OPEN ||
      conversation.state === ConversationState.REOPENED
    ) {
      updates.state = ConversationState.AWAITING_AGENT;
      updates.previousState = conversation.state;
    }

    const updated = await this.conversationRepo.update(conversationId, updates);

    // Emit event
    await this.eventBus.publish('conversation.assigned', {
      conversationId,
      agentId,
      teamId,
      reason,
      customerId: conversation.customerId,
    });

    this.logger.info('Conversation assigned', { conversationId, agentId, teamId });

    return updated;
  }

  async unassign(conversationId: string, reason?: string): Promise<Conversation> {
    const conversation = await this.conversationRepo.getById(conversationId);
    if (!conversation) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }

    const updates: Partial<Conversation> = {
      assignedAgentId: undefined,
    };

    const updated = await this.conversationRepo.update(conversationId, updates);

    // Emit event
    await this.eventBus.publish('conversation.assigned', {
      conversationId,
      agentId: null,
      teamId: conversation.assignedTeamId,
      reason,
      customerId: conversation.customerId,
    });

    return updated;
  }

  // ============================================================================
  // ESCALATION
  // ============================================================================

  async escalate(
    conversationId: string,
    reason: string,
    targetTeamId?: string
  ): Promise<Conversation> {
    const conversation = await this.conversationRepo.getById(conversationId);
    if (!conversation) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }

    const updates: Partial<Conversation> = {
      state: ConversationState.ESCALATED,
      previousState: conversation.state,
    };

    if (targetTeamId) {
      updates.assignedTeamId = targetTeamId;
      updates.assignedAgentId = undefined;
    }

    const updated = await this.conversationRepo.update(conversationId, updates);

    // Emit event
    await this.eventBus.publish('conversation.escalated', {
      conversationId,
      reason,
      previousState: conversation.state,
      targetTeamId,
      customerId: conversation.customerId,
      severity: conversation.severity,
    });

    this.logger.info('Conversation escalated', { conversationId, reason, targetTeamId });

    return updated;
  }

  // ============================================================================
  // HANDOFF BRIEF GENERATION
  // ============================================================================

  async generateHandoffBrief(conversationId: string): Promise<HandoffBrief> {
    const conversation = await this.conversationRepo.getById(conversationId);
    if (!conversation) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }

    const customer = await this.customerService.getById(conversation.customerId);
    const messages = await this.messageRepo.getByConversation(conversationId, 10);

    // Get customer interaction stats
    const stats = await this.customerService.getInteractionStats(conversation.customerId);

    // Generate summary using AI
    const summary = await this.aiOrchestrator.generateSummary(messages);

    // Calculate urgency
    let urgencyScore = 0;
    if (conversation.severity === Severity.P0) urgencyScore += 100;
    else if (conversation.severity === Severity.P1) urgencyScore += 50;

    if (conversation.sentiment === Sentiment.ANGRY) urgencyScore += 30;
    else if (conversation.sentiment === Sentiment.NEGATIVE) urgencyScore += 15;

    if (conversation.firstResponseDueAt) {
      const minutesUntilBreach =
        (conversation.firstResponseDueAt.getTime() - Date.now()) / (1000 * 60);
      if (minutesUntilBreach < 0) urgencyScore += 50;
      else if (minutesUntilBreach < 15) urgencyScore += 25;
    }

    // Extract entities from latest message
    const latestMessage = messages[0];
    const entities = latestMessage?.aiAnnotations?.entities || {};

    const handoffBrief: HandoffBrief = {
      conversationId,
      customerId: conversation.customerId,
      customerName: customer?.profile.name,
      slaTier: conversation.slaTier,
      summary,
      intent: conversation.intent || Intent.UNKNOWN,
      severity: conversation.severity || Severity.P2,
      sentiment: conversation.sentiment || Sentiment.NEUTRAL,
      keyEntities: entities,
      suspectedRootCause: latestMessage?.aiAnnotations?.suspectedRootCause,
      messageCount: conversation.messageCount,
      channelsUsed: conversation.channelsUsed,
      previousInteractions: stats.totalConversations,
      aiAttemptedDeflection: messages.some((m) => m.senderType === SenderType.AI),
      suggestedSkills: conversation.requiredSkills,
      urgencyScore,
      firstResponseDueAt: conversation.firstResponseDueAt,
      minutesUntilBreach: conversation.firstResponseDueAt
        ? Math.floor((conversation.firstResponseDueAt.getTime() - Date.now()) / (1000 * 60))
        : undefined,
    };

    return handoffBrief;
  }

  // ============================================================================
  // CHAT TIMEOUT HANDLING
  // ============================================================================

  /**
   * HARD RULE: A live chat that times out must continue via email or messaging
   * under the same Conversation ID.
   */
  private startChatTimeout(conversationId: string): void {
    const timeoutMs = this.config.chatTimeoutMinutes * 60 * 1000;

    const timeout = setTimeout(() => {
      this.emit('chat:timeout', conversationId);
    }, timeoutMs);

    this.activeChatSessions.set(conversationId, timeout);
  }

  private resetChatTimeout(conversationId: string): void {
    this.cancelChatTimeout(conversationId);
    this.startChatTimeout(conversationId);
  }

  private cancelChatTimeout(conversationId: string): void {
    const timeout = this.activeChatSessions.get(conversationId);
    if (timeout) {
      clearTimeout(timeout);
      this.activeChatSessions.delete(conversationId);
    }
  }

  private async handleChatTimeout(conversationId: string): Promise<void> {
    this.logger.info('Chat timeout triggered', { conversationId });

    const conversation = await this.conversationRepo.getById(conversationId);
    if (!conversation) return;

    // Don't timeout if already resolved
    if (conversation.state === ConversationState.RESOLVED) return;

    // Get customer email
    const customer = await this.customerService.getById(conversation.customerId);
    const customerEmail = customer?.identityGraph.emails[0];

    if (customerEmail && this.config.emailContinuationEnabled) {
      // Add system message about continuation
      await this.addMessage({
        conversationId,
        channel: Channel.INTERNAL,
        direction: MessageDirection.INTERNAL,
        senderType: SenderType.SYSTEM,
        content: `Chat session timed out. Conversation will continue via email to ${customerEmail}.`,
        contentType: 'text',
      });

      // Send email notification to customer
      await this.eventBus.publish('automation.triggered', {
        type: 'chat_continuation_email',
        conversationId,
        customerId: conversation.customerId,
        customerEmail,
      });
    }

    // Update state
    await this.changeState(conversationId, ConversationState.AWAITING_CUSTOMER, 'chat_timeout');

    this.activeChatSessions.delete(conversationId);
  }

  // ============================================================================
  // CONVERSATION RETRIEVAL
  // ============================================================================

  async getById(conversationId: string): Promise<Conversation | null> {
    return this.conversationRepo.getById(conversationId);
  }

  async getByCustomer(customerId: string): Promise<Conversation[]> {
    return this.conversationRepo.getByCustomer(customerId);
  }

  async getOpenByCustomer(customerId: string): Promise<Conversation | null> {
    const conversations = await this.conversationRepo.getByCustomer(customerId);
    return (
      conversations.find(
        (c) =>
          c.state !== ConversationState.RESOLVED ||
          (c.state === ConversationState.RESOLVED &&
            c.resolvedAt &&
            Date.now() - c.resolvedAt.getTime() < 24 * 60 * 60 * 1000) // Within 24 hours
      ) || null
    );
  }

  async findOrCreateForMessage(
    normalizedMessage: NormalizedMessage,
    customerId: string
  ): Promise<Conversation> {
    // Try to find existing open conversation
    const existing = await this.getOpenByCustomer(customerId);

    // Check if message has conversation hints
    if (normalizedMessage.conversationHints.emailThreadId) {
      const byThread = await this.conversationRepo.findByEmailThread(
        normalizedMessage.conversationHints.emailThreadId
      );
      if (byThread) return byThread;
    }

    if (existing) {
      // Check if this is a continuation on a different channel
      if (existing.currentChannel !== normalizedMessage.channel) {
        this.logger.info('Conversation continuing on new channel', {
          conversationId: existing.id,
          previousChannel: existing.currentChannel,
          newChannel: normalizedMessage.channel,
        });
      }
      return existing;
    }

    // Create new conversation
    return this.createConversation({
      customerId,
      channel: normalizedMessage.channel,
      subject: normalizedMessage.conversationHints.emailSubject,
      initialMessage: {
        content: normalizedMessage.content,
        contentType: normalizedMessage.contentType,
        attachments: normalizedMessage.attachments,
      },
    });
  }

  // ============================================================================
  // RESOLUTION LINKING
  // ============================================================================

  async linkResolution(conversationId: string, resolutionId: string): Promise<Conversation> {
    const updated = await this.conversationRepo.update(conversationId, { resolutionId });
    return updated;
  }
}

export default ConversationEngine;
