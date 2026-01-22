/**
 * Routing & Queue Engine
 *
 * Manages intelligent conversation routing based on:
 * - Skills matching
 * - SLA priorities
 * - Agent availability
 * - Load balancing
 */

import {
  Conversation,
  User,
  Team,
  Channel,
  Severity,
  UserStatus,
  ConversationState,
} from '../models';
import { Logger } from '../utils/Logger';
import { EventBus } from '../core/EventBus';

export interface RoutingConfig {
  defaultRoutingMode: 'round_robin' | 'least_busy' | 'skill_based' | 'manual';
  enableSkillMatching: boolean;
  enableLoadBalancing: boolean;
  slaUrgencyBoost: boolean;
  sentimentUrgencyBoost: boolean;
  maxQueueSize: number;
  escalationTimeoutMinutes: number;
}

export interface QueueItem {
  conversation: Conversation;
  urgencyScore: number;
  queuedAt: Date;
  requiredSkills: string[];
  preferredAgentId?: string;
  preferredTeamId?: string;
  escalationLevel: number;
}

export interface AgentCapacity {
  agentId: string;
  teamId?: string;
  status: UserStatus;
  skills: string[];
  skillLevels: Record<string, 'beginner' | 'intermediate' | 'expert'>;
  maxConversations: number;
  currentConversations: number;
  availableCapacity: number;
  lastAssignedAt?: Date;
}

interface RoutingDecision {
  success: boolean;
  agentId?: string;
  teamId?: string;
  reason: string;
  score?: number;
}

export class RoutingService {
  private config: RoutingConfig;
  private logger: Logger;
  private eventBus: EventBus;

  // Queue management
  private queue: Map<string, QueueItem> = new Map();
  private agentCapacities: Map<string, AgentCapacity> = new Map();

  // Round-robin state
  private roundRobinIndex: Map<string, number> = new Map(); // teamId -> index

  constructor(config: RoutingConfig, logger: Logger, eventBus: EventBus) {
    this.config = config;
    this.logger = logger;
    this.eventBus = eventBus;

    this.setupEventListeners();
    this.startQueueProcessing();
  }

  private setupEventListeners(): void {
    // Listen for agent status changes
    this.eventBus.subscribe('agent.status_changed', this.handleAgentStatusChange.bind(this));

    // Listen for conversation state changes
    this.eventBus.subscribe(
      'conversation.state_changed',
      this.handleConversationStateChange.bind(this)
    );
  }

  // ============================================================================
  // QUEUE MANAGEMENT
  // ============================================================================

  async addToQueue(conversation: Conversation, options?: {
    preferredAgentId?: string;
    preferredTeamId?: string;
    escalationLevel?: number;
  }): Promise<void> {
    if (this.queue.size >= this.config.maxQueueSize) {
      throw new Error('Queue is full');
    }

    const urgencyScore = this.calculateUrgencyScore(conversation);

    const queueItem: QueueItem = {
      conversation,
      urgencyScore,
      queuedAt: new Date(),
      requiredSkills: conversation.requiredSkills || [],
      preferredAgentId: options?.preferredAgentId,
      preferredTeamId: options?.preferredTeamId || conversation.assignedTeamId,
      escalationLevel: options?.escalationLevel || 0,
    };

    this.queue.set(conversation.id, queueItem);

    this.logger.info('Conversation added to queue', {
      conversationId: conversation.id,
      urgencyScore,
      requiredSkills: queueItem.requiredSkills,
    });

    // Attempt immediate routing
    await this.processQueueItem(queueItem);
  }

  async removeFromQueue(conversationId: string): Promise<void> {
    this.queue.delete(conversationId);
  }

  getQueueStats(): {
    totalQueued: number;
    byPriority: Record<Severity, number>;
    avgWaitTimeMinutes: number;
    oldestItemMinutes: number;
  } {
    const items = Array.from(this.queue.values());
    const now = Date.now();

    const byPriority: Record<Severity, number> = {
      [Severity.P0]: 0,
      [Severity.P1]: 0,
      [Severity.P2]: 0,
      [Severity.P3]: 0,
    };

    let totalWaitTime = 0;
    let oldestWaitTime = 0;

    for (const item of items) {
      const severity = item.conversation.severity || Severity.P2;
      byPriority[severity]++;

      const waitTime = now - item.queuedAt.getTime();
      totalWaitTime += waitTime;
      oldestWaitTime = Math.max(oldestWaitTime, waitTime);
    }

    return {
      totalQueued: items.length,
      byPriority,
      avgWaitTimeMinutes: items.length > 0 ? totalWaitTime / items.length / 60000 : 0,
      oldestItemMinutes: oldestWaitTime / 60000,
    };
  }

  // ============================================================================
  // ROUTING LOGIC
  // ============================================================================

  async routeConversation(conversation: Conversation): Promise<RoutingDecision> {
    this.logger.info('Routing conversation', {
      conversationId: conversation.id,
      severity: conversation.severity,
      requiredSkills: conversation.requiredSkills,
    });

    // 1. Check for preferred agent
    if (conversation.assignedAgentId) {
      const agentAvailable = this.isAgentAvailable(conversation.assignedAgentId);
      if (agentAvailable) {
        return {
          success: true,
          agentId: conversation.assignedAgentId,
          reason: 'preferred_agent_available',
        };
      }
    }

    // 2. Get routing mode
    const routingMode = this.getRoutingMode(conversation);

    // 3. Find eligible agents
    const eligibleAgents = this.getEligibleAgents(conversation);

    if (eligibleAgents.length === 0) {
      this.logger.warn('No eligible agents found', {
        conversationId: conversation.id,
        requiredSkills: conversation.requiredSkills,
      });

      // Add to queue
      await this.addToQueue(conversation);

      return {
        success: false,
        reason: 'no_eligible_agents',
      };
    }

    // 4. Select agent based on routing mode
    let selectedAgent: AgentCapacity | null = null;

    switch (routingMode) {
      case 'round_robin':
        selectedAgent = this.selectRoundRobin(eligibleAgents, conversation.assignedTeamId);
        break;
      case 'least_busy':
        selectedAgent = this.selectLeastBusy(eligibleAgents);
        break;
      case 'skill_based':
        selectedAgent = this.selectBySkillMatch(eligibleAgents, conversation);
        break;
      case 'manual':
        // Don't auto-assign, just queue
        await this.addToQueue(conversation);
        return {
          success: false,
          reason: 'manual_routing',
        };
    }

    if (!selectedAgent) {
      await this.addToQueue(conversation);
      return {
        success: false,
        reason: 'no_suitable_agent',
      };
    }

    // 5. Assign to selected agent
    this.updateAgentCapacity(selectedAgent.agentId, 1);

    this.logger.info('Conversation routed', {
      conversationId: conversation.id,
      agentId: selectedAgent.agentId,
      routingMode,
    });

    return {
      success: true,
      agentId: selectedAgent.agentId,
      teamId: selectedAgent.teamId,
      reason: routingMode,
      score: this.calculateAgentScore(selectedAgent, conversation),
    };
  }

  private getRoutingMode(conversation: Conversation): RoutingConfig['defaultRoutingMode'] {
    // Could be overridden by team settings or channel config
    return this.config.defaultRoutingMode;
  }

  private getEligibleAgents(conversation: Conversation): AgentCapacity[] {
    const agents = Array.from(this.agentCapacities.values());

    return agents.filter((agent) => {
      // Must be available
      if (agent.status !== UserStatus.AVAILABLE) {
        return false;
      }

      // Must have capacity
      if (agent.availableCapacity <= 0) {
        return false;
      }

      // Team filter
      if (conversation.assignedTeamId && agent.teamId !== conversation.assignedTeamId) {
        return false;
      }

      // Skill matching
      if (this.config.enableSkillMatching && conversation.requiredSkills.length > 0) {
        const hasRequiredSkills = conversation.requiredSkills.some((skill) =>
          agent.skills.includes(skill)
        );
        if (!hasRequiredSkills) {
          return false;
        }
      }

      return true;
    });
  }

  // ============================================================================
  // SELECTION STRATEGIES
  // ============================================================================

  private selectRoundRobin(agents: AgentCapacity[], teamId?: string): AgentCapacity | null {
    if (agents.length === 0) return null;

    const key = teamId || 'default';
    let index = this.roundRobinIndex.get(key) || 0;

    // Ensure index is valid
    index = index % agents.length;

    const selected = agents[index];

    // Update index for next time
    this.roundRobinIndex.set(key, (index + 1) % agents.length);

    return selected;
  }

  private selectLeastBusy(agents: AgentCapacity[]): AgentCapacity | null {
    if (agents.length === 0) return null;

    // Sort by available capacity (descending)
    const sorted = [...agents].sort((a, b) => b.availableCapacity - a.availableCapacity);

    return sorted[0];
  }

  private selectBySkillMatch(
    agents: AgentCapacity[],
    conversation: Conversation
  ): AgentCapacity | null {
    if (agents.length === 0) return null;

    const requiredSkills = conversation.requiredSkills || [];

    // Score each agent
    const scored = agents.map((agent) => ({
      agent,
      score: this.calculateSkillScore(agent, requiredSkills),
    }));

    // Sort by score (descending)
    scored.sort((a, b) => b.score - a.score);

    return scored[0]?.agent || null;
  }

  private calculateSkillScore(agent: AgentCapacity, requiredSkills: string[]): number {
    if (requiredSkills.length === 0) return 1;

    let score = 0;

    for (const skill of requiredSkills) {
      if (agent.skills.includes(skill)) {
        const level = agent.skillLevels[skill] || 'beginner';
        switch (level) {
          case 'expert':
            score += 3;
            break;
          case 'intermediate':
            score += 2;
            break;
          case 'beginner':
            score += 1;
            break;
        }
      }
    }

    // Normalize by required skills count
    return score / requiredSkills.length;
  }

  private calculateAgentScore(agent: AgentCapacity, conversation: Conversation): number {
    let score = 0;

    // Skill match (0-3)
    score += this.calculateSkillScore(agent, conversation.requiredSkills) * 3;

    // Available capacity (0-2)
    const capacityRatio = agent.availableCapacity / agent.maxConversations;
    score += capacityRatio * 2;

    // Recent assignment penalty (0-1)
    if (agent.lastAssignedAt) {
      const minutesSinceLastAssignment =
        (Date.now() - agent.lastAssignedAt.getTime()) / 60000;
      score += Math.min(1, minutesSinceLastAssignment / 30);
    } else {
      score += 1;
    }

    return score;
  }

  // ============================================================================
  // URGENCY CALCULATION
  // ============================================================================

  private calculateUrgencyScore(conversation: Conversation): number {
    let score = 0;

    // Severity (0-100)
    switch (conversation.severity) {
      case Severity.P0:
        score += 100;
        break;
      case Severity.P1:
        score += 75;
        break;
      case Severity.P2:
        score += 50;
        break;
      case Severity.P3:
        score += 25;
        break;
    }

    // SLA urgency boost
    if (this.config.slaUrgencyBoost && conversation.firstResponseDueAt) {
      const minutesUntilBreach =
        (conversation.firstResponseDueAt.getTime() - Date.now()) / 60000;

      if (minutesUntilBreach < 0) {
        score += 50; // Already breached
      } else if (minutesUntilBreach < 15) {
        score += 30; // Critical
      } else if (minutesUntilBreach < 30) {
        score += 15; // Warning
      }
    }

    // Sentiment urgency boost
    if (this.config.sentimentUrgencyBoost) {
      switch (conversation.sentiment) {
        case 'angry':
          score += 30;
          break;
        case 'negative':
          score += 15;
          break;
      }
    }

    // Customer tier boost
    switch (conversation.slaTier) {
      case 'enterprise':
        score += 20;
        break;
      case 'premium':
        score += 10;
        break;
    }

    return score;
  }

  // ============================================================================
  // QUEUE PROCESSING
  // ============================================================================

  private startQueueProcessing(): void {
    // Process queue periodically
    setInterval(() => this.processQueue(), 5000);

    // Check for escalations
    setInterval(() => this.checkEscalations(), 60000);
  }

  private async processQueue(): Promise<void> {
    if (this.queue.size === 0) return;

    // Sort queue by urgency
    const sortedItems = Array.from(this.queue.values()).sort(
      (a, b) => b.urgencyScore - a.urgencyScore
    );

    for (const item of sortedItems) {
      // Update urgency score (may have changed due to SLA)
      item.urgencyScore = this.calculateUrgencyScore(item.conversation);

      const result = await this.processQueueItem(item);

      if (result) {
        this.queue.delete(item.conversation.id);
      }
    }
  }

  private async processQueueItem(item: QueueItem): Promise<boolean> {
    // Check for preferred agent first
    if (item.preferredAgentId) {
      const agent = this.agentCapacities.get(item.preferredAgentId);
      if (agent && agent.status === UserStatus.AVAILABLE && agent.availableCapacity > 0) {
        await this.assignToAgent(item.conversation, agent.agentId);
        return true;
      }
    }

    // Find any eligible agent
    const eligibleAgents = this.getEligibleAgents(item.conversation);

    if (eligibleAgents.length > 0) {
      const routingMode = this.getRoutingMode(item.conversation);
      let selectedAgent: AgentCapacity | null = null;

      switch (routingMode) {
        case 'round_robin':
          selectedAgent = this.selectRoundRobin(eligibleAgents, item.preferredTeamId);
          break;
        case 'least_busy':
          selectedAgent = this.selectLeastBusy(eligibleAgents);
          break;
        case 'skill_based':
          selectedAgent = this.selectBySkillMatch(eligibleAgents, item.conversation);
          break;
      }

      if (selectedAgent) {
        await this.assignToAgent(item.conversation, selectedAgent.agentId);
        return true;
      }
    }

    return false;
  }

  private async assignToAgent(conversation: Conversation, agentId: string): Promise<void> {
    this.updateAgentCapacity(agentId, 1);

    await this.eventBus.publish('conversation.assigned', {
      conversationId: conversation.id,
      agentId,
      assignedBy: 'routing_engine',
    });

    this.logger.info('Assigned from queue', {
      conversationId: conversation.id,
      agentId,
    });
  }

  private checkEscalations(): void {
    const now = Date.now();
    const timeoutMs = this.config.escalationTimeoutMinutes * 60 * 1000;

    for (const [conversationId, item] of this.queue) {
      const waitTime = now - item.queuedAt.getTime();

      if (waitTime > timeoutMs * (item.escalationLevel + 1)) {
        item.escalationLevel++;

        this.logger.warn('Queue escalation', {
          conversationId,
          waitTimeMinutes: waitTime / 60000,
          escalationLevel: item.escalationLevel,
        });

        // Emit escalation event
        this.eventBus.publish('routing.escalation', {
          conversationId,
          waitTimeMinutes: waitTime / 60000,
          escalationLevel: item.escalationLevel,
        });
      }
    }
  }

  // ============================================================================
  // AGENT CAPACITY MANAGEMENT
  // ============================================================================

  updateAgentStatus(user: User): void {
    const capacity: AgentCapacity = {
      agentId: user.id,
      teamId: user.teamId,
      status: user.status,
      skills: user.skills,
      skillLevels: user.skillLevels,
      maxConversations: user.maxConcurrentConversations,
      currentConversations: user.currentConversationCount,
      availableCapacity: user.maxConcurrentConversations - user.currentConversationCount,
    };

    this.agentCapacities.set(user.id, capacity);
  }

  private updateAgentCapacity(agentId: string, delta: number): void {
    const capacity = this.agentCapacities.get(agentId);
    if (capacity) {
      capacity.currentConversations += delta;
      capacity.availableCapacity = capacity.maxConversations - capacity.currentConversations;
      capacity.lastAssignedAt = new Date();
    }
  }

  private isAgentAvailable(agentId: string): boolean {
    const capacity = this.agentCapacities.get(agentId);
    return (
      capacity !== undefined &&
      capacity.status === UserStatus.AVAILABLE &&
      capacity.availableCapacity > 0
    );
  }

  removeAgent(agentId: string): void {
    this.agentCapacities.delete(agentId);
  }

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  private handleAgentStatusChange(event: { agentId: string; status: UserStatus }): void {
    const capacity = this.agentCapacities.get(event.agentId);
    if (capacity) {
      capacity.status = event.status;

      // If agent became available, process queue
      if (event.status === UserStatus.AVAILABLE) {
        this.processQueue();
      }
    }
  }

  private handleConversationStateChange(event: {
    conversationId: string;
    previousState: ConversationState;
    newState: ConversationState;
    agentId?: string;
  }): void {
    // If conversation resolved, free up agent capacity
    if (event.newState === ConversationState.RESOLVED && event.agentId) {
      this.updateAgentCapacity(event.agentId, -1);
    }

    // Remove from queue if resolved
    if (event.newState === ConversationState.RESOLVED) {
      this.queue.delete(event.conversationId);
    }
  }

  // ============================================================================
  // MANUAL ASSIGNMENT
  // ============================================================================

  async manualAssign(
    conversationId: string,
    agentId: string,
    reason?: string
  ): Promise<RoutingDecision> {
    const capacity = this.agentCapacities.get(agentId);

    if (!capacity) {
      return {
        success: false,
        reason: 'agent_not_found',
      };
    }

    if (capacity.status !== UserStatus.AVAILABLE) {
      return {
        success: false,
        reason: 'agent_not_available',
      };
    }

    if (capacity.availableCapacity <= 0) {
      return {
        success: false,
        reason: 'agent_at_capacity',
      };
    }

    this.updateAgentCapacity(agentId, 1);
    this.queue.delete(conversationId);

    await this.eventBus.publish('conversation.assigned', {
      conversationId,
      agentId,
      assignedBy: 'manual',
      reason,
    });

    return {
      success: true,
      agentId,
      reason: 'manual_assignment',
    };
  }

  async transfer(
    conversationId: string,
    fromAgentId: string,
    toAgentId: string,
    reason?: string
  ): Promise<RoutingDecision> {
    // Free up source agent
    this.updateAgentCapacity(fromAgentId, -1);

    // Assign to target
    return this.manualAssign(conversationId, toAgentId, reason);
  }
}

export default RoutingService;
