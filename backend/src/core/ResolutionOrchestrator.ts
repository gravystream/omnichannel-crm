/**
 * Resolution Orchestration System (ROS)
 *
 * Manages complex, long-running technical issues (24-48h+)
 * Ensures customer communication never goes silent
 * Maintains separation: Agents manage trust, Engineers manage fixes
 */

import { EventEmitter } from 'events';
import {
  Resolution,
  ResolutionStatus,
  ResolutionUpdate,
  Swarm,
  Conversation,
  IssueType,
  OwningTeam,
  Severity,
  Channel,
  CustomerUpdate,
} from '../models';
import { EventBus } from './EventBus';
import { Logger } from '../utils/Logger';
import { ResolutionRepository } from '../repositories/ResolutionRepository';
import { SwarmRepository } from '../repositories/SwarmRepository';
import { ConversationEngine } from './ConversationEngine';
import { SlackService } from '../services/SlackService';
import { NotificationService } from '../services/NotificationService';
import { AIOrchestrator } from './AIOrchestrator';

export interface ResolutionConfig {
  defaultEtaHours: Record<Severity, number>;
  updateIntervalHours: number;
  slackIntegrationEnabled: boolean;
  slackChannelPrefix: string;
  autoAcknowledge: boolean;
  silenceThresholdHours: number;
}

export interface CreateResolutionInput {
  conversationId: string;
  issueType: IssueType;
  owningTeam: OwningTeam;
  priority: Severity;
  initialNotes?: string;
  createSwarm?: boolean;
  ownerId?: string;
}

export interface UpdateResolutionInput {
  status?: ResolutionStatus;
  ownerId?: string;
  rootCause?: string;
  rootCauseCategory?: string;
  fixDescription?: string;
  affectedSystems?: string[];
  etaWindowHours?: number;
  etaUpdateReason?: string;
}

export class ResolutionOrchestrator extends EventEmitter {
  private config: ResolutionConfig;
  private eventBus: EventBus;
  private logger: Logger;
  private resolutionRepo: ResolutionRepository;
  private swarmRepo: SwarmRepository;
  private conversationEngine: ConversationEngine;
  private slackService: SlackService;
  private notificationService: NotificationService;
  private aiOrchestrator: AIOrchestrator;

  // Active update timers
  private updateTimers: Map<string, NodeJS.Timeout> = new Map();

  // Silence monitors
  private silenceMonitors: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    config: ResolutionConfig,
    eventBus: EventBus,
    logger: Logger,
    resolutionRepo: ResolutionRepository,
    swarmRepo: SwarmRepository,
    conversationEngine: ConversationEngine,
    slackService: SlackService,
    notificationService: NotificationService,
    aiOrchestrator: AIOrchestrator
  ) {
    super();
    this.config = config;
    this.eventBus = eventBus;
    this.logger = logger;
    this.resolutionRepo = resolutionRepo;
    this.swarmRepo = swarmRepo;
    this.conversationEngine = conversationEngine;
    this.slackService = slackService;
    this.notificationService = notificationService;
    this.aiOrchestrator = aiOrchestrator;

    this.setupEventListeners();
    this.startSilenceMonitoring();
  }

  private setupEventListeners(): void {
    // Listen for Slack messages if integration enabled
    if (this.config.slackIntegrationEnabled) {
      this.eventBus.subscribe('slack.message', this.handleSlackMessage.bind(this));
    }
  }

  // ============================================================================
  // RESOLUTION CREATION
  // ============================================================================

  async createResolution(input: CreateResolutionInput): Promise<Resolution> {
    const {
      conversationId,
      issueType,
      owningTeam,
      priority,
      initialNotes,
      createSwarm,
      ownerId,
    } = input;

    this.logger.info('Creating resolution', {
      conversationId,
      issueType,
      owningTeam,
      priority,
    });

    // Calculate ETA based on priority
    const etaHours = this.config.defaultEtaHours[priority];
    const expectedResolutionAt = new Date(Date.now() + etaHours * 60 * 60 * 1000);

    // Create resolution
    const resolution: Partial<Resolution> = {
      conversationId,
      issueType,
      owningTeam,
      ownerId,
      status: ResolutionStatus.INVESTIGATING,
      expectedResolutionAt,
      etaWindowHours: etaHours,
      slaStartedAt: new Date(),
      slaTotalPausedSeconds: 0,
      slaBreached: false,
      priority,
      isRecurrence: false,
      recurrenceCount: 0,
      tags: [],
      metadata: {},
    };

    const created = await this.resolutionRepo.create(resolution);

    // Link to conversation
    await this.conversationEngine.linkResolution(conversationId, created.id);

    // Add initial note if provided
    if (initialNotes) {
      await this.addUpdate(created.id, {
        updateType: 'note',
        content: initialNotes,
        visibility: 'internal',
        authorId: ownerId || 'system',
        authorSource: 'app',
      });
    }

    // Create Slack swarm if requested
    let swarm: Swarm | undefined;
    if (createSwarm && this.config.slackIntegrationEnabled) {
      swarm = await this.createSwarm(created.id, owningTeam, priority);
    }

    // Send customer acknowledgement
    if (this.config.autoAcknowledge) {
      await this.sendCustomerAcknowledgement(created);
    }

    // Start proactive update timer
    this.startUpdateTimer(created.id);

    // Start silence monitoring
    this.startSilenceMonitor(created.id);

    // Emit event
    await this.eventBus.publish('resolution.created', {
      resolutionId: created.id,
      conversationId,
      issueType,
      owningTeam,
      priority,
      swarmId: swarm?.id,
    });

    this.logger.info('Resolution created', {
      resolutionId: created.id,
      swarmId: swarm?.id,
    });

    return created;
  }

  // ============================================================================
  // STATUS UPDATES
  // ============================================================================

  async updateResolution(
    resolutionId: string,
    input: UpdateResolutionInput,
    userId: string,
    source: 'app' | 'slack' | 'api' | 'automation' = 'app'
  ): Promise<Resolution> {
    const resolution = await this.resolutionRepo.getById(resolutionId);
    if (!resolution) {
      throw new Error(`Resolution not found: ${resolutionId}`);
    }

    const previousStatus = resolution.status;
    const updates: Partial<Resolution> = {};

    // Status change
    if (input.status && input.status !== resolution.status) {
      if (!this.isValidStatusTransition(resolution.status, input.status)) {
        throw new Error(`Invalid status transition: ${resolution.status} -> ${input.status}`);
      }
      updates.status = input.status;

      // Log status change
      await this.addUpdate(resolutionId, {
        updateType: 'status_change',
        content: `Status changed from ${previousStatus} to ${input.status}`,
        visibility: 'internal',
        authorId: userId,
        authorSource: source,
        previousStatus,
        newStatus: input.status,
      });

      // Handle special status updates
      if (input.status === ResolutionStatus.RESOLVED) {
        updates.resolvedAt = new Date();
        await this.handleResolutionCompletion(resolution, input);
      } else if (input.status === ResolutionStatus.DEPLOYED) {
        updates.fixDeployedAt = new Date();
      }

      // Reset silence monitor on status change
      this.resetSilenceMonitor(resolutionId);
    }

    // Owner change
    if (input.ownerId !== undefined) {
      updates.ownerId = input.ownerId;
      await this.addUpdate(resolutionId, {
        updateType: 'assignment_change',
        content: `Owner changed to ${input.ownerId || 'unassigned'}`,
        visibility: 'internal',
        authorId: userId,
        authorSource: source,
      });
    }

    // Root cause
    if (input.rootCause) {
      updates.rootCause = input.rootCause;
      updates.rootCauseCategory = input.rootCauseCategory;
      await this.addUpdate(resolutionId, {
        updateType: 'root_cause_identified',
        content: `Root cause identified: ${input.rootCause}`,
        visibility: 'internal',
        authorId: userId,
        authorSource: source,
      });
    }

    // Fix description
    if (input.fixDescription) {
      updates.fixDescription = input.fixDescription;
    }

    // Affected systems
    if (input.affectedSystems) {
      updates.affectedSystems = input.affectedSystems;
    }

    // ETA update
    if (input.etaWindowHours !== undefined) {
      updates.etaWindowHours = input.etaWindowHours;
      updates.expectedResolutionAt = new Date(
        Date.now() + input.etaWindowHours * 60 * 60 * 1000
      );
      updates.etaUpdatedAt = new Date();
      updates.etaUpdateReason = input.etaUpdateReason;

      await this.addUpdate(resolutionId, {
        updateType: 'eta_change',
        content: `ETA updated to ${input.etaWindowHours} hours. Reason: ${input.etaUpdateReason || 'Not specified'}`,
        visibility: 'internal',
        authorId: userId,
        authorSource: source,
      });

      // Notify customer of ETA change
      await this.sendETAUpdate(resolution, input.etaWindowHours, input.etaUpdateReason);
    }

    const updated = await this.resolutionRepo.update(resolutionId, updates);

    // Sync to Slack if enabled
    if (this.config.slackIntegrationEnabled && Object.keys(updates).length > 0) {
      await this.syncToSlack(resolutionId, updates, userId);
    }

    // Emit event
    await this.eventBus.publish('resolution.status_changed', {
      resolutionId,
      previousStatus,
      newStatus: updated.status,
      updates,
    });

    return updated;
  }

  private isValidStatusTransition(from: ResolutionStatus, to: ResolutionStatus): boolean {
    const validTransitions: Record<ResolutionStatus, ResolutionStatus[]> = {
      [ResolutionStatus.INVESTIGATING]: [
        ResolutionStatus.AWAITING_FIX,
        ResolutionStatus.FIX_IN_PROGRESS,
        ResolutionStatus.RESOLVED,
        ResolutionStatus.WONT_FIX,
        ResolutionStatus.DUPLICATE,
      ],
      [ResolutionStatus.AWAITING_FIX]: [
        ResolutionStatus.FIX_IN_PROGRESS,
        ResolutionStatus.RESOLVED,
        ResolutionStatus.WONT_FIX,
      ],
      [ResolutionStatus.FIX_IN_PROGRESS]: [
        ResolutionStatus.AWAITING_DEPLOY,
        ResolutionStatus.AWAITING_FIX,
        ResolutionStatus.RESOLVED,
      ],
      [ResolutionStatus.AWAITING_DEPLOY]: [
        ResolutionStatus.DEPLOYED,
        ResolutionStatus.FIX_IN_PROGRESS,
      ],
      [ResolutionStatus.DEPLOYED]: [ResolutionStatus.MONITORING, ResolutionStatus.FIX_IN_PROGRESS],
      [ResolutionStatus.MONITORING]: [
        ResolutionStatus.RESOLVED,
        ResolutionStatus.FIX_IN_PROGRESS,
      ],
      [ResolutionStatus.RESOLVED]: [], // Final state
      [ResolutionStatus.WONT_FIX]: [], // Final state
      [ResolutionStatus.DUPLICATE]: [], // Final state
    };

    return validTransitions[from]?.includes(to) ?? false;
  }

  // ============================================================================
  // INTERNAL UPDATES
  // ============================================================================

  async addUpdate(
    resolutionId: string,
    update: Omit<ResolutionUpdate, 'id' | 'resolutionId' | 'createdAt'>
  ): Promise<ResolutionUpdate> {
    const created = await this.resolutionRepo.addUpdate(resolutionId, update);

    // Reset silence monitor
    this.resetSilenceMonitor(resolutionId);

    return created;
  }

  // ============================================================================
  // CUSTOMER COMMUNICATION
  // ============================================================================

  /**
   * HARD RULE: Silence is forbidden.
   * Customers must receive updates even if status hasn't changed.
   */

  private async sendCustomerAcknowledgement(resolution: Resolution): Promise<void> {
    const conversation = await this.conversationEngine.getById(resolution.conversationId);
    if (!conversation) return;

    const content = this.generateAcknowledgementMessage(resolution);

    await this.sendCustomerUpdate(resolution, {
      updateType: 'acknowledgement',
      content,
    });

    this.logger.info('Customer acknowledgement sent', {
      resolutionId: resolution.id,
      conversationId: resolution.conversationId,
    });
  }

  private generateAcknowledgementMessage(resolution: Resolution): string {
    const etaText = resolution.etaWindowHours
      ? `We expect to have this resolved within ${resolution.etaWindowHours} hours.`
      : 'We are working to resolve this as quickly as possible.';

    return `Thank you for your patience. We've identified your issue and our ${resolution.owningTeam} team is actively working on it.

Case ID: ${resolution.id.slice(0, 8).toUpperCase()}
Priority: ${resolution.priority}
${etaText}

We'll keep you updated on our progress. You can reply to this message if you have any additional information to share.`;
  }

  private async sendETAUpdate(
    resolution: Resolution,
    newEtaHours: number,
    reason?: string
  ): Promise<void> {
    const content = `We wanted to update you on the status of your issue (Case ID: ${resolution.id.slice(0, 8).toUpperCase()}).

Our team is continuing to work on this. The estimated resolution time has been updated to approximately ${newEtaHours} hours from now.
${reason ? `\nReason for update: ${reason}` : ''}

We appreciate your patience and will continue to keep you informed.`;

    await this.sendCustomerUpdate(resolution, {
      updateType: 'eta_update',
      content,
    });
  }

  async sendProactiveUpdate(resolutionId: string): Promise<void> {
    const resolution = await this.resolutionRepo.getById(resolutionId);
    if (!resolution) return;

    // Don't send updates for resolved resolutions
    if (
      resolution.status === ResolutionStatus.RESOLVED ||
      resolution.status === ResolutionStatus.WONT_FIX ||
      resolution.status === ResolutionStatus.DUPLICATE
    ) {
      return;
    }

    const statusMessages: Record<ResolutionStatus, string> = {
      [ResolutionStatus.INVESTIGATING]:
        'Our team is actively investigating your issue.',
      [ResolutionStatus.AWAITING_FIX]:
        "We've identified the cause and are preparing a fix.",
      [ResolutionStatus.FIX_IN_PROGRESS]:
        "A fix is currently being developed for your issue.",
      [ResolutionStatus.AWAITING_DEPLOY]:
        'The fix has been completed and is scheduled for deployment.',
      [ResolutionStatus.DEPLOYED]:
        'We have deployed a fix and are monitoring the results.',
      [ResolutionStatus.MONITORING]:
        "The fix has been deployed. We're monitoring to ensure it resolves your issue.",
      [ResolutionStatus.RESOLVED]: '',
      [ResolutionStatus.WONT_FIX]: '',
      [ResolutionStatus.DUPLICATE]: '',
    };

    const statusMessage = statusMessages[resolution.status] || 'We are working on your issue.';

    const content = `Update on your issue (Case ID: ${resolution.id.slice(0, 8).toUpperCase()}):

${statusMessage}

${resolution.expectedResolutionAt ? `Expected resolution: ${this.formatDate(resolution.expectedResolutionAt)}` : ''}

Thank you for your continued patience. We will update you again soon.`;

    await this.sendCustomerUpdate(resolution, {
      updateType: 'status_update',
      content,
    });

    this.logger.info('Proactive update sent', {
      resolutionId,
      status: resolution.status,
    });
  }

  private async sendCustomerUpdate(
    resolution: Resolution,
    update: {
      updateType: CustomerUpdate['updateType'];
      content: string;
    }
  ): Promise<void> {
    const conversation = await this.conversationEngine.getById(resolution.conversationId);
    if (!conversation) return;

    // Determine best channel for update
    const channel = this.determineUpdateChannel(conversation);

    // Send via conversation engine
    await this.conversationEngine.addMessage({
      conversationId: resolution.conversationId,
      channel,
      direction: 'outbound',
      senderType: 'system',
      content: update.content,
      contentType: 'text',
    });

    // Record the update
    await this.resolutionRepo.addCustomerUpdate(resolution.id, {
      resolutionId: resolution.id,
      conversationId: resolution.conversationId,
      updateType: update.updateType,
      content: update.content,
      channel,
      status: 'sent',
      sentAt: new Date(),
    });
  }

  private determineUpdateChannel(conversation: Conversation): Channel {
    // Prefer email for long-running issues as it's asynchronous
    if (conversation.channelsUsed.includes(Channel.EMAIL)) {
      return Channel.EMAIL;
    }

    // Fall back to current channel
    return conversation.currentChannel || conversation.initialChannel;
  }

  // ============================================================================
  // RESOLUTION COMPLETION
  // ============================================================================

  private async handleResolutionCompletion(
    resolution: Resolution,
    input: UpdateResolutionInput
  ): Promise<void> {
    this.logger.info('Handling resolution completion', {
      resolutionId: resolution.id,
    });

    // Generate summary using AI
    const updates = await this.resolutionRepo.getUpdates(resolution.id);
    const summary = await this.generateResolutionSummary(resolution, updates);

    // Send customer notification
    await this.sendResolutionNotification(resolution, summary);

    // Close Slack swarm if exists
    if (this.config.slackIntegrationEnabled) {
      await this.closeSwarm(resolution.id);
    }

    // Stop timers
    this.stopUpdateTimer(resolution.id);
    this.stopSilenceMonitor(resolution.id);

    // Update conversation state
    await this.conversationEngine.changeState(
      resolution.conversationId,
      'resolved',
      'resolution_completed'
    );

    // Archive for AI training
    await this.archiveForTraining(resolution, updates, summary);

    // Emit completion event
    await this.eventBus.publish('resolution.completed', {
      resolutionId: resolution.id,
      conversationId: resolution.conversationId,
      rootCause: resolution.rootCause,
      fixDescription: input.fixDescription || resolution.fixDescription,
      duration: this.calculateDuration(resolution),
    });
  }

  private async generateResolutionSummary(
    resolution: Resolution,
    updates: ResolutionUpdate[]
  ): Promise<string> {
    const updateText = updates
      .filter((u) => u.visibility === 'internal')
      .map((u) => `${u.updateType}: ${u.content}`)
      .join('\n');

    const prompt = `Generate a customer-friendly summary of how this issue was resolved. Keep it brief and non-technical.

Issue Type: ${resolution.issueType}
Root Cause: ${resolution.rootCause || 'Identified and addressed'}
Fix: ${resolution.fixDescription || 'Issue has been resolved'}

Internal Updates:
${updateText}

Summary (2-3 sentences, customer-friendly):`;

    try {
      return await this.aiOrchestrator.generateSummary([]);
    } catch {
      return `Your issue has been resolved. ${resolution.rootCause ? `The problem was caused by: ${resolution.rootCause}. ` : ''}${resolution.fixDescription || 'Our team has implemented a fix.'} Thank you for your patience.`;
    }
  }

  private async sendResolutionNotification(
    resolution: Resolution,
    summary: string
  ): Promise<void> {
    const content = `Great news! Your issue has been resolved.

Case ID: ${resolution.id.slice(0, 8).toUpperCase()}

${summary}

If you experience any further issues, please don't hesitate to contact us. Simply reply to this message and we'll be happy to help.

Thank you for your patience throughout this process.`;

    await this.sendCustomerUpdate(resolution, {
      updateType: 'resolution_summary',
      content,
    });
  }

  private calculateDuration(resolution: Resolution): number {
    const start = resolution.slaStartedAt.getTime();
    const end = resolution.resolvedAt?.getTime() || Date.now();
    const pausedMs = resolution.slaTotalPausedSeconds * 1000;
    return (end - start - pausedMs) / (1000 * 60 * 60); // Hours
  }

  private async archiveForTraining(
    resolution: Resolution,
    updates: ResolutionUpdate[],
    summary: string
  ): Promise<void> {
    // Archive resolution data for AI training
    await this.eventBus.publish('ai.training_data', {
      type: 'resolution',
      resolutionId: resolution.id,
      issueType: resolution.issueType,
      rootCause: resolution.rootCause,
      rootCauseCategory: resolution.rootCauseCategory,
      fixDescription: resolution.fixDescription,
      duration: this.calculateDuration(resolution),
      priority: resolution.priority,
      updateCount: updates.length,
      summary,
    });
  }

  // ============================================================================
  // REOPENING & RECURRENCE
  // ============================================================================

  async handleReopen(resolutionId: string, reason: string, userId: string): Promise<Resolution> {
    const resolution = await this.resolutionRepo.getById(resolutionId);
    if (!resolution) {
      throw new Error(`Resolution not found: ${resolutionId}`);
    }

    // Check if this is a recurrence
    const isRecurrence =
      resolution.status === ResolutionStatus.RESOLVED &&
      resolution.resolvedAt &&
      Date.now() - resolution.resolvedAt.getTime() < 7 * 24 * 60 * 60 * 1000; // Within 7 days

    if (isRecurrence) {
      // Create new resolution linked to original
      const newResolution = await this.createResolution({
        conversationId: resolution.conversationId,
        issueType: resolution.issueType,
        owningTeam: resolution.owningTeam,
        priority: this.escalatePriority(resolution.priority), // Higher priority for recurrence
        initialNotes: `RECURRENCE: ${reason}\n\nOriginal resolution: ${resolutionId}`,
        createSwarm: this.config.slackIntegrationEnabled,
      });

      // Update new resolution
      await this.resolutionRepo.update(newResolution.id, {
        isRecurrence: true,
        parentResolutionId: resolutionId,
      });

      // Update original resolution recurrence count
      await this.resolutionRepo.update(resolutionId, {
        recurrenceCount: resolution.recurrenceCount + 1,
      });

      this.logger.warn('Recurrence detected', {
        originalResolutionId: resolutionId,
        newResolutionId: newResolution.id,
        recurrenceCount: resolution.recurrenceCount + 1,
      });

      return newResolution;
    }

    // Not a recurrence, just reopen
    return this.updateResolution(
      resolutionId,
      { status: ResolutionStatus.INVESTIGATING },
      userId
    );
  }

  private escalatePriority(current: Severity): Severity {
    switch (current) {
      case Severity.P3:
        return Severity.P2;
      case Severity.P2:
        return Severity.P1;
      case Severity.P1:
      case Severity.P0:
        return Severity.P0;
      default:
        return Severity.P1;
    }
  }

  // ============================================================================
  // SLACK SWARM INTEGRATION
  // ============================================================================

  private async createSwarm(
    resolutionId: string,
    owningTeam: OwningTeam,
    priority: Severity
  ): Promise<Swarm> {
    const resolution = await this.resolutionRepo.getById(resolutionId);
    if (!resolution) {
      throw new Error(`Resolution not found: ${resolutionId}`);
    }

    // Create Slack channel
    const channelName = `${this.config.slackChannelPrefix}-${new Date().toISOString().slice(0, 10)}-${resolutionId.slice(0, 8)}`;

    const slackChannel = await this.slackService.createChannel(channelName, {
      topic: `Resolution: ${resolutionId} | Priority: ${priority} | Team: ${owningTeam}`,
      purpose: `Incident response for resolution ${resolutionId}`,
    });

    // Create swarm record
    const swarm: Partial<Swarm> = {
      resolutionId,
      slackChannelId: slackChannel.id,
      slackChannelName: channelName,
      slackChannelUrl: slackChannel.url,
      participants: [],
      status: 'active',
      syncEnabled: true,
    };

    const created = await this.swarmRepo.create(swarm);

    // Post initial message to channel
    await this.slackService.postMessage(slackChannel.id, {
      text: `🚨 New Resolution Created`,
      blocks: [
        {
          type: 'header',
          text: { type: 'plain_text', text: `🚨 ${priority} - ${resolution.issueType}` },
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Resolution ID:*\n${resolutionId}` },
            { type: 'mrkdwn', text: `*Owning Team:*\n${owningTeam}` },
            { type: 'mrkdwn', text: `*Priority:*\n${priority}` },
            {
              type: 'mrkdwn',
              text: `*ETA:*\n${resolution.etaWindowHours}h`,
            },
          ],
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Conversation:* <link|View in CRM>`,
          },
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: { type: 'plain_text', text: 'Take Ownership' },
              action_id: 'resolution_take_ownership',
              value: resolutionId,
            },
            {
              type: 'button',
              text: { type: 'plain_text', text: 'Update Status' },
              action_id: 'resolution_update_status',
              value: resolutionId,
            },
          ],
        },
      ],
    });

    // Invite team members
    await this.inviteTeamToSwarm(created.id, owningTeam);

    this.logger.info('Swarm created', {
      swarmId: created.id,
      slackChannelId: slackChannel.id,
      resolutionId,
    });

    return created;
  }

  private async inviteTeamToSwarm(swarmId: string, team: OwningTeam): Promise<void> {
    const swarm = await this.swarmRepo.getById(swarmId);
    if (!swarm) return;

    // Get team members (implementation depends on user service)
    // await this.slackService.inviteToChannel(swarm.slackChannelId, userSlackIds);
  }

  private async syncToSlack(
    resolutionId: string,
    updates: Partial<Resolution>,
    userId: string
  ): Promise<void> {
    const swarm = await this.swarmRepo.getByResolution(resolutionId);
    if (!swarm || !swarm.syncEnabled) return;

    const updateParts: string[] = [];

    if (updates.status) {
      updateParts.push(`Status → *${updates.status}*`);
    }
    if (updates.rootCause) {
      updateParts.push(`Root Cause: ${updates.rootCause}`);
    }
    if (updates.fixDescription) {
      updateParts.push(`Fix: ${updates.fixDescription}`);
    }
    if (updates.etaWindowHours) {
      updateParts.push(`ETA updated to ${updates.etaWindowHours}h`);
    }

    if (updateParts.length > 0) {
      await this.slackService.postMessage(swarm.slackChannelId, {
        text: `📝 Update from CRM:\n${updateParts.join('\n')}`,
      });
    }
  }

  private async handleSlackMessage(event: {
    channelId: string;
    userId: string;
    text: string;
  }): Promise<void> {
    // Find swarm by channel
    const swarm = await this.swarmRepo.getBySlackChannel(event.channelId);
    if (!swarm) return;

    // Check for status update commands
    const statusMatch = event.text.match(/^!status\s+(\w+)$/i);
    if (statusMatch) {
      const newStatus = statusMatch[1].toUpperCase() as ResolutionStatus;
      try {
        await this.updateResolution(swarm.resolutionId, { status: newStatus }, event.userId, 'slack');
        await this.slackService.addReaction(event.channelId, 'white_check_mark');
      } catch (error) {
        await this.slackService.postMessage(event.channelId, {
          text: `❌ Invalid status: ${newStatus}`,
        });
      }
      return;
    }

    // Log as internal note
    await this.addUpdate(swarm.resolutionId, {
      updateType: 'note',
      content: `[From Slack] ${event.text}`,
      visibility: 'internal',
      authorId: event.userId,
      authorSource: 'slack',
    });
  }

  private async closeSwarm(resolutionId: string): Promise<void> {
    const swarm = await this.swarmRepo.getByResolution(resolutionId);
    if (!swarm) return;

    // Post closure message
    await this.slackService.postMessage(swarm.slackChannelId, {
      text: `✅ Resolution completed. This channel will be archived.`,
    });

    // Archive channel
    await this.slackService.archiveChannel(swarm.slackChannelId);

    // Update swarm status
    await this.swarmRepo.update(swarm.id, {
      status: 'archived',
      archivedAt: new Date(),
    });

    this.logger.info('Swarm closed', {
      swarmId: swarm.id,
      resolutionId,
    });
  }

  // ============================================================================
  // PROACTIVE UPDATE TIMERS
  // ============================================================================

  private startUpdateTimer(resolutionId: string): void {
    const intervalMs = this.config.updateIntervalHours * 60 * 60 * 1000;

    const timer = setInterval(() => {
      this.sendProactiveUpdate(resolutionId);
    }, intervalMs);

    this.updateTimers.set(resolutionId, timer);
  }

  private stopUpdateTimer(resolutionId: string): void {
    const timer = this.updateTimers.get(resolutionId);
    if (timer) {
      clearInterval(timer);
      this.updateTimers.delete(resolutionId);
    }
  }

  // ============================================================================
  // SILENCE MONITORING
  // ============================================================================

  /**
   * HARD RULE: Silence is failure.
   * Monitor for resolutions with no updates and alert.
   */

  private startSilenceMonitoring(): void {
    // Check all active resolutions periodically
    setInterval(() => {
      this.checkForSilentResolutions();
    }, 60 * 60 * 1000); // Every hour
  }

  private startSilenceMonitor(resolutionId: string): void {
    const thresholdMs = this.config.silenceThresholdHours * 60 * 60 * 1000;

    const timer = setTimeout(() => {
      this.handleSilenceAlert(resolutionId);
    }, thresholdMs);

    this.silenceMonitors.set(resolutionId, timer);
  }

  private resetSilenceMonitor(resolutionId: string): void {
    this.stopSilenceMonitor(resolutionId);
    this.startSilenceMonitor(resolutionId);
  }

  private stopSilenceMonitor(resolutionId: string): void {
    const timer = this.silenceMonitors.get(resolutionId);
    if (timer) {
      clearTimeout(timer);
      this.silenceMonitors.delete(resolutionId);
    }
  }

  private async handleSilenceAlert(resolutionId: string): Promise<void> {
    const resolution = await this.resolutionRepo.getById(resolutionId);
    if (!resolution) return;

    // Don't alert for resolved resolutions
    if (
      resolution.status === ResolutionStatus.RESOLVED ||
      resolution.status === ResolutionStatus.WONT_FIX
    ) {
      return;
    }

    this.logger.warn('Silence detected', {
      resolutionId,
      status: resolution.status,
      lastUpdateHours: this.config.silenceThresholdHours,
    });

    // Notify internal teams
    await this.notificationService.sendSilenceAlert(resolution);

    // If Slack swarm exists, post reminder
    if (this.config.slackIntegrationEnabled) {
      const swarm = await this.swarmRepo.getByResolution(resolutionId);
      if (swarm) {
        await this.slackService.postMessage(swarm.slackChannelId, {
          text: `⚠️ *Silence Alert*\nNo updates in ${this.config.silenceThresholdHours} hours. Please provide a status update.`,
        });
      }
    }

    // Send customer update anyway (silence is forbidden)
    await this.sendProactiveUpdate(resolutionId);

    // Restart monitor
    this.startSilenceMonitor(resolutionId);
  }

  private async checkForSilentResolutions(): Promise<void> {
    const activeResolutions = await this.resolutionRepo.getActive();
    const thresholdTime = new Date(
      Date.now() - this.config.silenceThresholdHours * 60 * 60 * 1000
    );

    for (const resolution of activeResolutions) {
      const lastUpdate = await this.resolutionRepo.getLastUpdateTime(resolution.id);
      if (lastUpdate && lastUpdate < thresholdTime) {
        // Not already being monitored
        if (!this.silenceMonitors.has(resolution.id)) {
          await this.handleSilenceAlert(resolution.id);
        }
      }
    }
  }

  // ============================================================================
  // UTILITY
  // ============================================================================

  private formatDate(date: Date): string {
    return date.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    });
  }
}

export default ResolutionOrchestrator;
