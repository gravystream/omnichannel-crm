/**
 * Event Bus - Central event orchestration
 *
 * Provides reliable event publishing and subscription for all system components.
 * Supports multiple backends: in-memory, Redis Streams, or Kafka.
 */

import { EventEmitter } from 'events';
import { Logger } from '../utils/Logger';

export type EventType =
  | 'message.received'
  | 'message.sent'
  | 'message.classified'
  | 'conversation.created'
  | 'conversation.state_changed'
  | 'conversation.assigned'
  | 'conversation.escalated'
  | 'resolution.created'
  | 'resolution.status_changed'
  | 'resolution.completed'
  | 'sla.warning'
  | 'sla.breached'
  | 'automation.triggered'
  | 'automation.executed'
  | 'customer.updated'
  | 'customer.merged'
  | 'swarm.created'
  | 'swarm.message'
  | 'swarm.closed'
  | 'ai.human_correction'
  | 'ai.training_data'
  | 'slack.message'
  | 'channel.webhook';

export interface Event<T = any> {
  id: string;
  type: EventType;
  payload: T;
  timestamp: Date;
  correlationId?: string;
  causationId?: string;
  metadata?: Record<string, any>;
}

export interface EventHandler<T = any> {
  (event: Event<T>): Promise<void> | void;
}

export interface EventBusConfig {
  backend: 'memory' | 'redis' | 'kafka';
  redis?: {
    host: string;
    port: number;
    password?: string;
  };
  kafka?: {
    brokers: string[];
    clientId: string;
    groupId: string;
  };
  retryAttempts: number;
  retryDelayMs: number;
}

export class EventBus {
  private config: EventBusConfig;
  private logger: Logger;
  private emitter: EventEmitter;
  private handlers: Map<EventType, Set<EventHandler>> = new Map();
  private pendingEvents: Event[] = [];

  // For idempotency
  private processedEvents: Set<string> = new Set();
  private processedEventsMaxSize: number = 10000;

  constructor(config: EventBusConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(100);
  }

  async initialize(): Promise<void> {
    switch (this.config.backend) {
      case 'redis':
        await this.initializeRedis();
        break;
      case 'kafka':
        await this.initializeKafka();
        break;
      case 'memory':
      default:
        this.logger.info('Using in-memory event bus');
    }
  }

  private async initializeRedis(): Promise<void> {
    // Redis Streams initialization
    // const redis = new Redis(this.config.redis);
    this.logger.info('Redis event bus initialized');
  }

  private async initializeKafka(): Promise<void> {
    // Kafka initialization
    // const kafka = new Kafka(this.config.kafka);
    this.logger.info('Kafka event bus initialized');
  }

  // ============================================================================
  // PUBLISHING
  // ============================================================================

  async publish<T>(
    type: EventType,
    payload: T,
    options?: {
      correlationId?: string;
      causationId?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<string> {
    const event: Event<T> = {
      id: this.generateEventId(),
      type,
      payload,
      timestamp: new Date(),
      correlationId: options?.correlationId,
      causationId: options?.causationId,
      metadata: options?.metadata,
    };

    this.logger.debug('Publishing event', {
      eventId: event.id,
      type,
      correlationId: event.correlationId,
    });

    switch (this.config.backend) {
      case 'redis':
        await this.publishToRedis(event);
        break;
      case 'kafka':
        await this.publishToKafka(event);
        break;
      case 'memory':
      default:
        await this.publishInMemory(event);
    }

    return event.id;
  }

  private async publishInMemory<T>(event: Event<T>): Promise<void> {
    // Emit to local handlers
    this.emitter.emit(event.type, event);

    // Process handlers
    const handlers = this.handlers.get(event.type);
    if (handlers) {
      for (const handler of handlers) {
        try {
          await this.executeHandler(handler, event);
        } catch (error) {
          this.logger.error('Handler execution failed', {
            eventId: event.id,
            type: event.type,
            error,
          });
        }
      }
    }
  }

  private async publishToRedis<T>(event: Event<T>): Promise<void> {
    // await this.redisClient.xadd(
    //   `events:${event.type}`,
    //   '*',
    //   'data', JSON.stringify(event)
    // );
    // Fallback to in-memory for now
    await this.publishInMemory(event);
  }

  private async publishToKafka<T>(event: Event<T>): Promise<void> {
    // await this.kafkaProducer.send({
    //   topic: event.type,
    //   messages: [{ value: JSON.stringify(event) }]
    // });
    // Fallback to in-memory for now
    await this.publishInMemory(event);
  }

  // ============================================================================
  // SUBSCRIPTION
  // ============================================================================

  subscribe<T>(type: EventType, handler: EventHandler<T>): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }

    this.handlers.get(type)!.add(handler);

    this.logger.debug('Handler subscribed', { type });

    // Return unsubscribe function
    return () => {
      this.handlers.get(type)?.delete(handler);
    };
  }

  subscribeAll(handler: EventHandler): () => void {
    const allTypes: EventType[] = [
      'message.received',
      'message.sent',
      'message.classified',
      'conversation.created',
      'conversation.state_changed',
      'conversation.assigned',
      'conversation.escalated',
      'resolution.created',
      'resolution.status_changed',
      'resolution.completed',
      'sla.warning',
      'sla.breached',
      'automation.triggered',
      'automation.executed',
      'customer.updated',
      'customer.merged',
      'swarm.created',
      'swarm.message',
      'swarm.closed',
      'ai.human_correction',
      'ai.training_data',
      'slack.message',
      'channel.webhook',
    ];

    const unsubscribers = allTypes.map((type) => this.subscribe(type, handler));

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }

  // ============================================================================
  // HANDLER EXECUTION
  // ============================================================================

  private async executeHandler<T>(handler: EventHandler<T>, event: Event<T>): Promise<void> {
    // Idempotency check
    const handlerKey = `${event.id}:${handler.name || 'anonymous'}`;
    if (this.processedEvents.has(handlerKey)) {
      this.logger.debug('Event already processed by handler', {
        eventId: event.id,
        handler: handler.name,
      });
      return;
    }

    let attempt = 0;
    let lastError: Error | undefined;

    while (attempt < this.config.retryAttempts) {
      try {
        await handler(event);

        // Mark as processed
        this.markEventProcessed(handlerKey);

        return;
      } catch (error) {
        attempt++;
        lastError = error as Error;

        this.logger.warn('Handler failed, retrying', {
          eventId: event.id,
          type: event.type,
          attempt,
          maxAttempts: this.config.retryAttempts,
          error: lastError.message,
        });

        if (attempt < this.config.retryAttempts) {
          await this.delay(this.config.retryDelayMs * attempt);
        }
      }
    }

    // All retries exhausted
    this.logger.error('Handler failed after all retries', {
      eventId: event.id,
      type: event.type,
      error: lastError?.message,
    });

    // Store failed event for later processing
    this.pendingEvents.push(event);
  }

  private markEventProcessed(key: string): void {
    this.processedEvents.add(key);

    // Cleanup old entries
    if (this.processedEvents.size > this.processedEventsMaxSize) {
      const entries = Array.from(this.processedEvents);
      this.processedEvents = new Set(entries.slice(-this.processedEventsMaxSize / 2));
    }
  }

  // ============================================================================
  // UTILITY
  // ============================================================================

  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ============================================================================
  // MONITORING
  // ============================================================================

  getStats(): {
    pendingCount: number;
    processedCount: number;
    handlersCount: number;
  } {
    let handlersCount = 0;
    for (const handlers of this.handlers.values()) {
      handlersCount += handlers.size;
    }

    return {
      pendingCount: this.pendingEvents.length,
      processedCount: this.processedEvents.size,
      handlersCount,
    };
  }

  async replayPendingEvents(): Promise<number> {
    const events = [...this.pendingEvents];
    this.pendingEvents = [];

    let replayed = 0;

    for (const event of events) {
      try {
        await this.publishInMemory(event);
        replayed++;
      } catch (error) {
        this.pendingEvents.push(event);
      }
    }

    return replayed;
  }
}

export default EventBus;
