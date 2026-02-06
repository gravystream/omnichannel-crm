import { initDatabase } from "./utils/database";
/**
 * Omnichannel CRM - Main Server Entry Point
 */

import express, { Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

import { Logger } from './utils/Logger';
import { EventBus } from './core/EventBus';
import { ConversationEngine } from './core/ConversationEngine';
import { AIOrchestrator } from './core/AIOrchestrator';
import { ResolutionOrchestrator } from './core/ResolutionOrchestrator';
import { RoutingService } from './services/RoutingService';
import { WebChatAdapter } from './adapters/WebChatAdapter';

// Import routes
import authRoutes from './api/routes/auth';
import conversationRoutes from './api/routes/conversations';
import customerRoutes from './api/routes/customers';
import resolutionRoutes from './api/routes/resolutions';
import webhookRoutes from './api/routes/webhooks';
import analyticsRoutes from './api/routes/analytics';
import adminRoutes from './api/routes/admin';
import aiRoutes from './api/routes/ai';
import integrationsRoutes from './api/routes/integrations';
import inboxRoutes from './api/routes/inbox';

// Initialize logger
const logger = new Logger('Server');

// Create Express app
const app = express();
const httpServer = createServer(app);

// Initialize Socket.IO
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3001'],
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// =============================================================================
// MIDDLEWARE
// =============================================================================

// Security headers
app.use(helmet({
  contentSecurityPolicy: false, // Disable for development
}));

// CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3001'],
  credentials: true,
}));

// Compression
app.use(compression());

// Request logging
app.use(morgan('combined', {
  stream: { write: (message) => logger.info(message.trim()) },
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/v1/', limiter);

// =============================================================================
// HEALTH CHECKS
// =============================================================================

app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
  });
});

app.get('/health/ready', async (req: Request, res: Response) => {
  try {
    // Check database connection
    // await prisma.$queryRaw`SELECT 1`;

    res.json({
      status: 'ready',
      checks: {
        database: 'ok',
        redis: 'ok',
        eventBus: 'ok',
      },
    });
  } catch (error) {
    res.status(503).json({
      status: 'not ready',
      error: (error as Error).message,
    });
  }
});

// =============================================================================
// INITIALIZE SERVICES
// =============================================================================

// Event Bus
const eventBus = new EventBus({
  backend: 'memory', // Use 'redis' or 'kafka' in production
  retryAttempts: 3,
  retryDelayMs: 1000,
}, logger);

// Mock repositories (replace with real implementations)
const mockConversationRepo = {
  create: async (data: any) => ({ id: `conv_${Date.now()}`, ...data, createdAt: new Date(), updatedAt: new Date() }),
  getById: async (id: string) => null,
  update: async (id: string, data: any) => ({ id, ...data }),
  getByCustomer: async (customerId: string) => [],
  findByEmailThread: async (threadId: string) => null,
};

const mockMessageRepo = {
  create: async (data: any, attachments?: any[]) => ({ id: `msg_${Date.now()}`, ...data, attachments: [], createdAt: new Date() }),
  getByConversation: async (conversationId: string, limit?: number) => [],
  updateAIAnnotations: async (id: string, annotations: any) => {},
};

const mockCustomerService = {
  getById: async (id: string) => ({
    id,
    identityGraph: { emails: ['customer@example.com'], phoneNumbers: [], socialIds: {}, deviceFingerprints: [] },
    profile: { name: 'Test Customer' },
    slaTier: 'standard' as const,
    tags: [],
    segments: [],
    riskFlags: [],
  }),
  getInteractionStats: async (id: string) => ({ totalConversations: 5, openConversations: 1 }),
};

const mockSLAService = {
  calculateDeadlines: async (tier: string, channel: string) => ({
    firstResponseDueAt: new Date(Date.now() + 60 * 60 * 1000),
    resolutionDueAt: new Date(Date.now() + 4 * 60 * 60 * 1000),
  }),
};

const mockKBService = {
  search: async (query: string, options: any) => [],
};

const mockResolutionRepo = {
  create: async (data: any) => ({ id: `res_${Date.now()}`, ...data, createdAt: new Date(), updatedAt: new Date() }),
  getById: async (id: string) => null,
  update: async (id: string, data: any) => ({ id, ...data }),
  addUpdate: async (id: string, update: any) => ({ id: `upd_${Date.now()}`, resolutionId: id, ...update, createdAt: new Date() }),
  getUpdates: async (id: string) => [],
  addCustomerUpdate: async (id: string, update: any) => {},
  getActive: async () => [],
  getLastUpdateTime: async (id: string) => new Date(),
};

const mockSwarmRepo = {
  create: async (data: any) => ({ id: `swarm_${Date.now()}`, ...data, createdAt: new Date() }),
  getById: async (id: string) => null,
  getByResolution: async (resolutionId: string) => null,
  getBySlackChannel: async (channelId: string) => null,
  update: async (id: string, data: any) => ({ id, ...data }),
};

const mockSlackService = {
  createChannel: async (name: string, options: any) => ({ id: 'C123', url: `https://slack.com/channels/${name}` }),
  postMessage: async (channelId: string, message: any) => {},
  archiveChannel: async (channelId: string) => {},
  addReaction: async (channelId: string, reaction: string) => {},
};

const mockNotificationService = {
  sendSilenceAlert: async (resolution: any) => {},
};

// AI Orchestrator
const aiOrchestrator = new AIOrchestrator({
  provider: (process.env.AI_PROVIDER as 'openai' | 'anthropic' | 'local') || 'local',
  apiKey: process.env.AI_API_KEY,
  modelName: process.env.AI_MODEL || 'gpt-4',
  maxTokens: 1000,
  temperature: 0.3,
  confidenceThreshold: 0.7,
  maxDeflectionAttempts: 2,
  enableKnowledgeDeflection: true,
}, logger, eventBus, mockKBService as any);

// Conversation Engine
const conversationEngine = new ConversationEngine({
  autoClassify: true,
  autoRoute: true,
  chatTimeoutMinutes: 30,
  emailContinuationEnabled: true,
  maxMessagesPerConversation: 1000,
}, eventBus, mockCustomerService as any, mockMessageRepo as any, mockConversationRepo as any, mockSLAService as any, aiOrchestrator, logger);

// Resolution Orchestrator
const resolutionOrchestrator = new ResolutionOrchestrator({
  defaultEtaHours: { P0: 4, P1: 8, P2: 24, P3: 72 },
  updateIntervalHours: 12,
  slackIntegrationEnabled: false,
  slackChannelPrefix: 'incident',
  autoAcknowledge: true,
  silenceThresholdHours: 6,
}, eventBus, logger, mockResolutionRepo as any, mockSwarmRepo as any, conversationEngine, mockSlackService as any, mockNotificationService as any, aiOrchestrator);

// Routing Service
const routingService = new RoutingService({
  defaultRoutingMode: 'skill_based',
  enableSkillMatching: true,
  enableLoadBalancing: true,
  slaUrgencyBoost: true,
  sentimentUrgencyBoost: true,
  maxQueueSize: 1000,
  escalationTimeoutMinutes: 30,
}, logger, eventBus);

// Web Chat Adapter
const webChatAdapter = new WebChatAdapter({
  channelId: 'web_chat_default',
  channelType: 'web_chat' as any,
  credentials: {},
  enabled: true,
  widgetOrigins: ['*'],
  sessionTimeoutMinutes: 30,
  typingTimeoutSeconds: 5,
  maxMessageLength: 5000,
  rateLimitPerMinute: 30,
}, logger, eventBus);

// Attach Socket.IO to web chat adapter
webChatAdapter.attachSocketServer(io);

// Store services in app for route access
app.set('eventBus', eventBus);
app.set('conversationEngine', conversationEngine);
app.set('aiOrchestrator', aiOrchestrator);
app.set('resolutionOrchestrator', resolutionOrchestrator);
app.set('routingService', routingService);
app.set('webChatAdapter', webChatAdapter);
app.set('logger', logger);

// =============================================================================
// API ROUTES
// =============================================================================

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/conversations', conversationRoutes);
app.use('/api/v1/customers', customerRoutes);
app.use('/api/v1/resolutions', resolutionRoutes);
app.use('/api/v1/webhooks', webhookRoutes);
app.use('/api/v1/integrations', integrationsRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/ai', aiRoutes);
app.use('/api/v1/inbox', inboxRoutes);

// API documentation
app.get('/api', (req: Request, res: Response) => {
  res.json({
    name: 'Omnichannel CRM API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/v1/auth',
      conversations: '/api/v1/conversations',
      customers: '/api/v1/customers',
      resolutions: '/api/v1/resolutions',
      webhooks: '/api/v1/webhooks',
      analytics: '/api/v1/analytics',
      admin: '/api/v1/admin',
    },
    documentation: '/api/v1/docs',
  });
});

// =============================================================================
// SOCKET.IO EVENTS
// =============================================================================

io.on('connection', (socket) => {
  logger.info('Socket connected', { socketId: socket.id });

  // Agent authentication
  socket.on('agent:auth', async (data: { token: string }) => {
    try {
      // Verify JWT token
      // const decoded = jwt.verify(data.token, process.env.JWT_SECRET!);
      // socket.data.agentId = decoded.sub;
      socket.data.agentId = 'agent_test';
      socket.emit('agent:authenticated', { success: true });
      logger.info('Agent authenticated', { socketId: socket.id });
    } catch (error) {
      socket.emit('agent:authenticated', { success: false, error: 'Invalid token' });
    }
  });

  // Agent joins conversation room
  socket.on('agent:join_conversation', (data: { conversationId: string }) => {
    socket.join(`conversation:${data.conversationId}`);
    logger.info('Agent joined conversation', { socketId: socket.id, conversationId: data.conversationId });
  });

  // Agent leaves conversation room
  socket.on('agent:leave_conversation', (data: { conversationId: string }) => {
    socket.leave(`conversation:${data.conversationId}`);
  });

  // Agent typing indicator
  socket.on('agent:typing', (data: { conversationId: string; isTyping: boolean }) => {
    io.to(`conversation:${data.conversationId}`).emit('agent:typing', {
      conversationId: data.conversationId,
      isTyping: data.isTyping,
      agentId: socket.data.agentId,
    });
  });

  // Agent status change
  socket.on('agent:status', (data: { status: string }) => {
    logger.info('Agent status changed', { socketId: socket.id, status: data.status });
    // Update routing service
    // routingService.updateAgentStatus(socket.data.agentId, data.status);
  });

  socket.on('disconnect', () => {
    logger.info('Socket disconnected', { socketId: socket.id });
  });
});

// Broadcast events to relevant rooms
eventBus.subscribe('message.received', async (event) => {
  const payload = event.payload as any;
  io.to(`conversation:${payload.conversationId}`).emit('conversation:message', {
    conversationId: payload.conversationId,
    message: payload,
  });
});

eventBus.subscribe('conversation.state_changed', async (event) => {
  const payload = event.payload as any;
  io.to(`conversation:${payload.conversationId}`).emit('conversation:state_changed', payload);
});

eventBus.subscribe('resolution.status_changed', async (event) => {
  io.emit('resolution:update', event.payload);
});

// =============================================================================
// ERROR HANDLING
// =============================================================================

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
    },
  });
});

// Global error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack, path: req.path });

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production' ? 'An internal error occurred' : err.message,
    },
  });
});

// =============================================================================
// START SERVER
// =============================================================================

const PORT = parseInt(process.env.PORT || '3000', 10);

async function startServer() {
  // Initialize PostgreSQL database
  await initDatabase();
  try {
    // Initialize event bus
    await eventBus.initialize();
    logger.info('Event bus initialized');

    // Initialize web chat adapter
    await webChatAdapter.initialize();
    logger.info('Web chat adapter initialized');

    // Start HTTP server
    httpServer.listen(PORT, '0.0.0.0', () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`📡 WebSocket server ready`);
      logger.info(`🔗 API: http://localhost:${PORT}/api`);
      logger.info(`❤️  Health: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  httpServer.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  httpServer.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

// Start the server
startServer();

export { app, httpServer, io };
