/**
 * Web Chat Adapter
 *
 * Handles real-time web chat via WebSocket with HTTP fallback.
 * Manages chat sessions, typing indicators, and presence.
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import { BaseChannelAdapter, AdapterConfig, OutboundMessage, DeliveryResult } from './BaseChannelAdapter';
import { Channel, NormalizedMessage, MessageDirection } from '../models';
import { Logger } from '../utils/Logger';
import { EventBus } from '../core/EventBus';
import { getPool } from '../utils/database';

export interface WebChatConfig extends AdapterConfig {
  widgetOrigins: string[];
  sessionTimeoutMinutes: number;
  typingTimeoutSeconds: number;
  maxMessageLength: number;
  rateLimitPerMinute: number;
}

interface ChatSession {
  sessionId: string;
  socketId: string;
  customerId?: string;
  customerIdentity: {
    email?: string;
    name?: string;
    deviceFingerprint?: string;
  };
  conversationId?: string;
  connectedAt: Date;
  lastActivityAt: Date;
  isTyping: boolean;
  messageCount: number;
}

export class WebChatAdapter extends BaseChannelAdapter {
  private io: SocketIOServer | null = null;
  private sessions: Map<string, ChatSession> = new Map();
  private socketToSession: Map<string, string> = new Map();
  private rateLimiters: Map<string, { count: number; resetAt: Date }> = new Map();

  constructor(config: WebChatConfig, logger: Logger, eventBus: EventBus) {
    super(config, logger, eventBus);
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  async initialize(): Promise<void> {
    this.logActivity('Initializing WebChat adapter');
    // Socket.IO server is attached by the main application
    // This just sets up the configuration
  }

  /**
   * Attach Socket.IO server after HTTP server is created
   */
  attachSocketServer(io: SocketIOServer): void {
    this.io = io;

    // Configure CORS
    io.engine.on('initial_headers', (headers: any, request: any) => {
      const origin = request.headers.origin;
      if (this.isAllowedOrigin(origin)) {
        headers['Access-Control-Allow-Origin'] = origin;
        headers['Access-Control-Allow-Credentials'] = 'true';
      }
    });

    // Set up connection handling
    io.on('connection', this.handleConnection.bind(this));

    this.logActivity('Socket.IO server attached');

    // Start session cleanup interval
    setInterval(() => this.cleanupSessions(), 60000);
  }

  private isAllowedOrigin(origin: string): boolean {
    const config = this.config as WebChatConfig;
    return config.widgetOrigins.some((allowed) => {
      if (allowed === '*') return true;
      return origin === allowed || origin.endsWith(allowed);
    });
  }

  // ============================================================================
  // CONNECTION HANDLING
  // ============================================================================

  private handleConnection(socket: Socket): void {
    this.logActivity('New connection', { socketId: socket.id });

    // Handle session initialization
    socket.on('chat:init', (data) => this.handleChatInit(socket, data));

    // Handle messages
    socket.on('chat:message', (data) => this.handleIncomingMessage(socket, data));

    // Handle typing indicators
    socket.on('chat:typing', (data) => this.handleTyping(socket, data));

    // Handle disconnection
    socket.on('disconnect', () => this.handleDisconnect(socket));

    // Handle reconnection
    socket.on('chat:reconnect', (data) => this.handleReconnect(socket, data));
  }

  private async handleChatInit(
    socket: Socket,
    data: {
      sessionId?: string;
      email?: string;
      name?: string;
      deviceFingerprint?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<void> {
    try {
      const sessionId = data.sessionId || this.generateSessionId();

      const session: ChatSession = {
        sessionId,
        socketId: socket.id,
        customerIdentity: {
          email: data.email,
          name: data.name,
          deviceFingerprint: data.deviceFingerprint,
        },
        connectedAt: new Date(),
        lastActivityAt: new Date(),
        isTyping: false,
        messageCount: 0,
      };

      this.sessions.set(sessionId, session);
      this.socketToSession.set(socket.id, sessionId);

      // Join room for this session
      socket.join(`session:${sessionId}`);

      // Send confirmation
      socket.emit('chat:initialized', {
        sessionId,
        timestamp: new Date(),
      });

      this.logActivity('Session initialized', { sessionId });
    } catch (error) {
      this.logError('Chat init failed', error as Error);
      socket.emit('chat:error', { message: 'Failed to initialize chat' });
    }
  }

  private async handleIncomingMessage(
    socket: Socket,
    data: {
      content: string;
      contentType?: 'text' | 'html';
      attachments?: Array<{
        url: string;
        filename: string;
      contentType: string;
    }>;
    }
  ): Promise<void> {
    // Check if content exists
    if (!data.content) {
      socket.emit('chat:error', { message: 'Message content is required' });
      return;
    }
    const sessionId = this.socketToSession.get(socket.id);
    if (!sessionId) {
      socket.emit('chat:error', { message: 'Session not initialized' });
      return;
    }

    const session = this.sessions.get(sessionId);
    if (!session) {
      socket.emit('chat:error', { message: 'Session not found' });
      return;
    }

    // Rate limiting
    if (!this.checkRateLimit(sessionId)) {
      socket.emit('chat:error', { message: 'Rate limit exceeded' });
      return;
    }

    // Validate message
    const config = this.config as WebChatConfig;
    if (data.content.length > config.maxMessageLength) {
      socket.emit('chat:error', { message: 'Message too long' });
      return;
    }

    try {
      // Create normalized message
      const normalizedMessage = this.createNormalizedMessage({
        direction: MessageDirection.INBOUND,
        senderIdentity: {
          email: session.customerIdentity.email,
          name: session.customerIdentity.name,
          deviceFingerprint: session.customerIdentity.deviceFingerprint,
        },
        content: data.content,
        contentType: data.contentType || 'text',
        attachments: data.attachments,
        conversationHints: {
          sessionId,
        },
        channelMetadata: {
          socketId: socket.id,
          sessionId,
        },
      });

      // Update session
      session.lastActivityAt = new Date();
      session.messageCount++;
      session.isTyping = false;

      // Store message in database and emit events
      await this.processIncomingMessage(session, normalizedMessage, data.content);

      // Acknowledge receipt
      socket.emit('chat:message:ack', {
        messageId: normalizedMessage.id,
        timestamp: normalizedMessage.timestamp,
      });

      this.logActivity('Message received', {
        sessionId,
        messageId: normalizedMessage.id,
      });
    } catch (error) {
      this.logError('Message handling failed', error as Error, { sessionId });
      socket.emit('chat:error', { message: 'Failed to send message' });
    }
  }

  private handleTyping(socket: Socket, data: { isTyping: boolean }): void {
    const sessionId = this.socketToSession.get(socket.id);
    if (!sessionId) return;

    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.isTyping = data.isTyping;
    session.lastActivityAt = new Date();

    // Broadcast to agents watching this conversation
    if (session.conversationId) {
      this.io?.to(`conversation:${session.conversationId}`).emit('customer:typing', {
        conversationId: session.conversationId,
        isTyping: data.isTyping,
      });
    }
  }

  private handleDisconnect(socket: Socket): void {
    const sessionId = this.socketToSession.get(socket.id);
    if (!sessionId) return;

    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivityAt = new Date();

      // Notify agents
      if (session.conversationId) {
        this.io?.to(`conversation:${session.conversationId}`).emit('customer:offline', {
          conversationId: session.conversationId,
        });
      }
    }

    this.socketToSession.delete(socket.id);
    this.logActivity('Disconnected', { socketId: socket.id, sessionId });
  }

  private async handleReconnect(socket: Socket, data: { sessionId: string }): Promise<void> {
    const session = this.sessions.get(data.sessionId);

    if (session) {
      // Update socket mapping
      this.socketToSession.delete(session.socketId);
      session.socketId = socket.id;
      this.socketToSession.set(socket.id, data.sessionId);
      session.lastActivityAt = new Date();

      // Rejoin room
      socket.join(`session:${data.sessionId}`);

      // Send reconnection confirmation with history hint
      socket.emit('chat:reconnected', {
        sessionId: data.sessionId,
        conversationId: session.conversationId,
        messageCount: session.messageCount,
      });

      this.logActivity('Reconnected', { sessionId: data.sessionId });
    } else {
      // Session expired, need new init
      socket.emit('chat:session_expired');
    }
  }

  // ============================================================================
  // OUTBOUND MESSAGES
  // ============================================================================

  async sendMessage(message: OutboundMessage): Promise<DeliveryResult> {
    // Find session by recipientId (which could be sessionId or customerId)
    let session: ChatSession | undefined;

    for (const [, s] of this.sessions) {
      if (s.sessionId === message.recipientId || s.customerId === message.recipientId) {
        session = s;
        break;
      }
    }

    if (!session) {
      return {
        success: false,
        error: 'Customer not connected',
      };
    }

    const socket = this.io?.sockets.sockets.get(session.socketId);
    if (!socket?.connected) {
      return {
        success: false,
        error: 'Socket disconnected',
      };
    }

    const messageId = this.generateMessageId();

    socket.emit('chat:message', {
      messageId,
      content: message.content,
      contentType: message.contentType,
      attachments: message.attachments,
      timestamp: new Date(),
    });

    this.logActivity('Message sent', {
      sessionId: session.sessionId,
      messageId,
    });

    return {
      success: true,
      channelMessageId: messageId,
      deliveredAt: new Date(),
    };
  }

  /**
   * Send typing indicator to customer
   */
  sendTypingIndicator(sessionId: string, isTyping: boolean): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const socket = this.io?.sockets.sockets.get(session.socketId);
    socket?.emit('agent:typing', { isTyping });
  }

  /**
   * Link session to conversation and customer
   */
  linkSession(sessionId: string, conversationId: string, customerId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.conversationId = conversationId;
      session.customerId = customerId;

      // Join conversation room
      const socket = this.io?.sockets.sockets.get(session.socketId);
      socket?.join(`conversation:${conversationId}`);
    }
  }

  // ============================================================================
  // WEBHOOK PROCESSING (for HTTP fallback)
  // ============================================================================

  async processWebhook(
    payload: {
      sessionId: string;
      type: 'message' | 'init' | 'typing';
      data: any;
    },
    headers?: Record<string, string>
  ): Promise<NormalizedMessage[]> {
    // HTTP fallback for when WebSocket isn't available
    if (payload.type === 'message') {
      const session = this.sessions.get(payload.sessionId);

      if (!session) {
        throw new Error('Session not found');
      }

      const normalizedMessage = this.createNormalizedMessage({
        direction: MessageDirection.INBOUND,
        senderIdentity: session.customerIdentity,
        content: payload.data.content,
        contentType: payload.data.contentType || 'text',
        attachments: payload.data.attachments,
        conversationHints: {
          sessionId: payload.sessionId,
        },
        channelMetadata: {
          sessionId: payload.sessionId,
          fallback: true,
        },
      });

      return [normalizedMessage];
    }

    return [];
  }

  verifyWebhook(payload: any, signature?: string): boolean {
    // For HTTP fallback, verify session token
    return !!payload.sessionId && this.sessions.has(payload.sessionId);
  }

  // ============================================================================
  // SESSION MANAGEMENT
  // ============================================================================

  private generateSessionId(): string {
    return `chat_${Date.now()}_${Math.random().toString(36).substr(2, 12)}`;
  }

  private checkRateLimit(sessionId: string): boolean {
    const config = this.config as WebChatConfig;
    const now = new Date();
    let limiter = this.rateLimiters.get(sessionId);

    if (!limiter || limiter.resetAt < now) {
      limiter = {
        count: 0,
        resetAt: new Date(now.getTime() + 60000),
      };
      this.rateLimiters.set(sessionId, limiter);
    }

    limiter.count++;
    return limiter.count <= config.rateLimitPerMinute;
  }

  private cleanupSessions(): void {
    const config = this.config as WebChatConfig;
    const timeout = config.sessionTimeoutMinutes * 60 * 1000;
    const now = Date.now();

    for (const [sessionId, session] of this.sessions) {
      if (now - session.lastActivityAt.getTime() > timeout) {
        // Check if socket still connected
        const socket = this.io?.sockets.sockets.get(session.socketId);
        if (!socket?.connected) {
          this.sessions.delete(sessionId);
          this.socketToSession.delete(session.socketId);
          this.logActivity('Session cleaned up', { sessionId });
        }
      }
    }
  }

  // ============================================================================
  // AGENT INTERFACE
  // ============================================================================

  /**
   * Get active sessions for agent dashboard
   */
  getActiveSessions(): Array<{
    sessionId: string;
    conversationId?: string;
    customerName?: string;
    isTyping: boolean;
    lastActivityAt: Date;
    messageCount: number;
  }> {
    return Array.from(this.sessions.values()).map((s) => ({
      sessionId: s.sessionId,
      conversationId: s.conversationId,
      customerName: s.customerIdentity.name,
      isTyping: s.isTyping,
      lastActivityAt: s.lastActivityAt,
      messageCount: s.messageCount,
    }));
  }

  /**
   * Join agent to conversation room for real-time updates
   */
  joinAgentToConversation(agentSocketId: string, conversationId: string): void {
    const socket = this.io?.sockets.sockets.get(agentSocketId);
    socket?.join(`conversation:${conversationId}`);
  }

  /**
   * Process incoming webchat message - create customer, conversation, message
   */
  private async processIncomingMessage(
    session: any,
    normalizedMessage: NormalizedMessage,
    content: string
  ): Promise<void> {
    try {
      const pool = getPool();
      const email = session.customerIdentity.email || null;
      const name = session.customerIdentity.name || 'Web Visitor';

      // 1. Find or create customer
      let customer = null;
      if (email) {
        const result = await pool.query('SELECT * FROM customers WHERE email = $1', [email]);
        if (result.rows.length > 0) customer = result.rows[0];
      }

      if (!customer) {
        const result = await pool.query(
          `INSERT INTO customers (email, name, created_at, updated_at)
           VALUES ($1, $2, NOW(), NOW())
           RETURNING *`,
          [email, name]
        );
        customer = result.rows[0];
        this.logActivity('Created new customer', { customerId: customer.id });
      }

      // 2. Find or create conversation (link to session if not already linked)
      let conversation = null;
      if (session.conversationId) {
        const result = await pool.query('SELECT * FROM conversations WHERE id = $1', [session.conversationId]);
        if (result.rows.length > 0) conversation = result.rows[0];
      }

      if (!conversation) {
        // Find open conversation for this customer on webchat
        const result = await pool.query(
          `SELECT * FROM conversations
           WHERE customer_id = $1 AND channel = 'webchat' AND status IN ('open', 'pending')
           ORDER BY updated_at DESC LIMIT 1`,
          [customer.id]
        );

        if (result.rows.length > 0) {
          conversation = result.rows[0];
        } else {
          // Create new conversation
          const newConv = await pool.query(
            `INSERT INTO conversations (customer_id, channel, status, subject, priority, created_at, updated_at)
             VALUES ($1, 'webchat', 'open', 'Web Chat', 'normal', NOW(), NOW())
             RETURNING *`,
            [customer.id]
          );
          conversation = newConv.rows[0];
          this.logActivity('Created new conversation', { conversationId: conversation.id });
        }

        // Link session to conversation
        session.conversationId = conversation.id;
        session.customerId = customer.id;
      }

      // 3. Create message in database
      const messageResult = await pool.query(
        `INSERT INTO messages (conversation_id, content, sender_type, channel, created_at)
         VALUES ($1, $2, 'customer', 'webchat', NOW())
         RETURNING id`,
        [conversation.id, content]
      );

      // Update conversation timestamp
      await pool.query(
        'UPDATE conversations SET updated_at = NOW() WHERE id = $1',
        [conversation.id]
      );

      const messageId = messageResult.rows[0].id;
      this.logActivity('Created message', { conversationId: conversation.id, messageId });

      // 4. Emit message.received event for Socket.IO broadcast and AI processing
      await this.eventBus.publish('message.received', {
        messageId: messageId,
        conversationId: conversation.id,
        channel: 'webchat',
        direction: MessageDirection.INBOUND,
        senderType: 'customer',
        customerId: customer.id,
      });

    } catch (error) {
      this.logError('Failed to process incoming message', error as Error);
      throw error;
    }
  }

}
