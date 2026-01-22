/**
 * Omnichannel CRM - Core Data Models
 * TypeScript interfaces matching the PostgreSQL schema
 */

// ============================================================================
// ENUMS
// ============================================================================

export enum ConversationState {
  OPEN = 'open',
  AWAITING_CUSTOMER = 'awaiting_customer',
  AWAITING_AGENT = 'awaiting_agent',
  ESCALATED = 'escalated',
  RESOLVED = 'resolved',
  REOPENED = 'reopened',
}

export enum Channel {
  WEB_CHAT = 'web_chat',
  EMAIL = 'email',
  WHATSAPP = 'whatsapp',
  FACEBOOK = 'facebook',
  INSTAGRAM = 'instagram',
  TWITTER = 'twitter',
  VOICE = 'voice',
  SMS = 'sms',
  INTERNAL = 'internal',
}

export enum MessageDirection {
  INBOUND = 'inbound',
  OUTBOUND = 'outbound',
  INTERNAL = 'internal',
}

export enum SenderType {
  CUSTOMER = 'customer',
  AGENT = 'agent',
  SYSTEM = 'system',
  AI = 'ai',
}

export enum Severity {
  P0 = 'P0', // Critical: money, security, trust
  P1 = 'P1', // High
  P2 = 'P2', // Normal
  P3 = 'P3', // Informational
}

export enum Intent {
  HOW_TO_GUIDANCE = 'how_to_guidance',
  ACCOUNT_ACCESS_ISSUE = 'account_access_issue',
  TRANSACTION_SYSTEM_FAILURE = 'transaction_system_failure',
  BUG_TECHNICAL_DEFECT = 'bug_technical_defect',
  URGENT_HIGH_RISK = 'urgent_high_risk',
  NOISE_LOW_INTENT = 'noise_low_intent',
  UNKNOWN = 'unknown',
}

export enum Sentiment {
  POSITIVE = 'positive',
  NEUTRAL = 'neutral',
  NEGATIVE = 'negative',
  ANGRY = 'angry',
}

export enum ResolutionStatus {
  INVESTIGATING = 'investigating',
  AWAITING_FIX = 'awaiting_fix',
  FIX_IN_PROGRESS = 'fix_in_progress',
  AWAITING_DEPLOY = 'awaiting_deploy',
  DEPLOYED = 'deployed',
  MONITORING = 'monitoring',
  RESOLVED = 'resolved',
  WONT_FIX = 'wont_fix',
  DUPLICATE = 'duplicate',
}

export enum IssueType {
  TECHNICAL = 'technical',
  BILLING = 'billing',
  OPS = 'ops',
  COMPLIANCE = 'compliance',
  SECURITY = 'security',
  OTHER = 'other',
}

export enum OwningTeam {
  ENGINEERING = 'engineering',
  INFRA = 'infra',
  FINANCE = 'finance',
  SUPPORT = 'support',
  SECURITY = 'security',
  PRODUCT = 'product',
}

export enum UserRole {
  ADMIN = 'admin',
  SUPERVISOR = 'supervisor',
  AGENT = 'agent',
  ENGINEER = 'engineer',
  API = 'api',
}

export enum UserStatus {
  AVAILABLE = 'available',
  BUSY = 'busy',
  AWAY = 'away',
  OFFLINE = 'offline',
  DO_NOT_DISTURB = 'do_not_disturb',
}

export enum SLATier {
  FREE = 'free',
  STANDARD = 'standard',
  PREMIUM = 'premium',
  ENTERPRISE = 'enterprise',
}

// ============================================================================
// CORE INTERFACES
// ============================================================================

export interface Customer {
  id: string;
  identityGraph: IdentityGraph;
  profile: CustomerProfile;
  slaTier: SLATier;
  tags: string[];
  segments: string[];
  riskFlags: string[];
  status: 'active' | 'inactive' | 'blocked' | 'merged';
  mergedIntoId?: string;
  firstSeenAt: Date;
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IdentityGraph {
  emails: string[];
  phoneNumbers: string[];
  socialIds: Record<string, string>; // { "facebook": "123", "twitter": "456" }
  deviceFingerprints: string[];
}

export interface CustomerProfile {
  name?: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  avatarUrl?: string;
  metadata: Record<string, any>;
}

export interface Conversation {
  id: string;
  customerId: string;
  state: ConversationState;
  previousState?: ConversationState;
  channelsUsed: Channel[];
  currentChannel?: Channel;
  initialChannel: Channel;
  assignedAgentId?: string;
  assignedTeamId?: string;
  intent?: Intent;
  severity?: Severity;
  sentiment?: Sentiment;
  requiredSkills: string[];
  slaTier: SLATier;
  firstResponseAt?: Date;
  firstResponseDueAt?: Date;
  resolutionDueAt?: Date;
  slaBreached: boolean;
  resolutionId?: string;
  subject?: string;
  summary?: string;
  tags: string[];
  metadata: Record<string, any>;
  messageCount: number;
  internalNoteCount: number;
  lastMessageAt?: Date;
  lastCustomerMessageAt?: Date;
  lastAgentMessageAt?: Date;
  resolvedAt?: Date;
  reopenedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Message {
  id: string;
  conversationId: string;
  channel: Channel;
  direction: MessageDirection;
  senderType: SenderType;
  senderId?: string;
  contentType: 'text' | 'html' | 'markdown' | 'voice_transcript' | 'system_event';
  content: string;
  contentHtml?: string;
  voiceRecordingUrl?: string;
  voiceDurationSeconds?: number;
  channelMessageId?: string;
  channelMetadata: Record<string, any>;
  parentMessageId?: string;
  threadId?: string;
  aiProcessed: boolean;
  aiAnnotations: AIAnnotations;
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  errorMessage?: string;
  attachments: Attachment[];
  createdAt: Date;
  deliveredAt?: Date;
  readAt?: Date;
}

export interface Attachment {
  id: string;
  messageId: string;
  filename: string;
  originalFilename: string;
  contentType: string;
  sizeBytes: number;
  storageProvider: 'local' | 's3' | 'minio' | 'gcs';
  storageUrl: string;
  storageKey: string;
  isImage: boolean;
  thumbnailUrl?: string;
  dimensions?: { width: number; height: number };
  virusScanned: boolean;
  virusScanResult?: string;
  createdAt: Date;
  expiresAt?: Date;
}

export interface AIAnnotations {
  intent?: Intent;
  intentConfidence?: number;
  severity?: Severity;
  severityConfidence?: number;
  sentiment?: Sentiment;
  sentimentScore?: number;
  entities?: ExtractedEntities;
  suspectedRootCause?: string;
  suggestedAction?: string;
  suggestedResponse?: string;
  suggestedKbArticles?: string[];
  suggestedSkills?: string[];
  suggestedTeamId?: string;
  escalationRecommended?: boolean;
  modelVersion?: string;
  processingTimeMs?: number;
  humanCorrected?: boolean;
  correctedById?: string;
  correctedAt?: Date;
  correctionNotes?: string;
}

export interface ExtractedEntities {
  transactionIds?: string[];
  errorCodes?: string[];
  productNames?: string[];
  orderNumbers?: string[];
  accountIds?: string[];
  dates?: string[];
  amounts?: { value: number; currency: string }[];
  urls?: string[];
  emails?: string[];
  phoneNumbers?: string[];
  custom?: Record<string, string[]>;
}

export interface Resolution {
  id: string;
  conversationId: string;
  issueType: IssueType;
  issueSubtype?: string;
  owningTeam: OwningTeam;
  ownerId?: string;
  status: ResolutionStatus;
  expectedResolutionAt?: Date;
  etaWindowHours?: number;
  etaUpdatedAt?: Date;
  etaUpdateReason?: string;
  slaStartedAt: Date;
  slaPausedAt?: Date;
  slaTotalPausedSeconds: number;
  slaBreached: boolean;
  priority: Severity;
  rootCause?: string;
  rootCauseCategory?: string;
  affectedSystems?: string[];
  fixDescription?: string;
  fixCommitUrl?: string;
  fixDeployedAt?: Date;
  isRecurrence: boolean;
  parentResolutionId?: string;
  recurrenceCount: number;
  tags: string[];
  metadata: Record<string, any>;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ResolutionUpdate {
  id: string;
  resolutionId: string;
  updateType:
    | 'status_change'
    | 'note'
    | 'customer_update'
    | 'eta_change'
    | 'assignment_change'
    | 'priority_change'
    | 'fix_deployed'
    | 'root_cause_identified';
  content: string;
  visibility: 'internal' | 'customer';
  previousStatus?: ResolutionStatus;
  newStatus?: ResolutionStatus;
  authorId: string;
  authorSource: 'app' | 'slack' | 'api' | 'automation';
  createdAt: Date;
}

export interface Swarm {
  id: string;
  resolutionId: string;
  slackChannelId: string;
  slackChannelName: string;
  slackChannelUrl?: string;
  participants: SwarmParticipant[];
  leadId?: string;
  status: 'active' | 'resolved' | 'archived';
  lastSyncedAt?: Date;
  syncEnabled: boolean;
  createdAt: Date;
  archivedAt?: Date;
}

export interface SwarmParticipant {
  userId: string;
  slackId: string;
  role: 'lead' | 'member' | 'observer';
  joinedAt: Date;
}

export interface User {
  id: string;
  email: string;
  passwordHash?: string;
  authProvider: 'local' | 'google' | 'okta' | 'saml';
  authProviderId?: string;
  firstName: string;
  lastName: string;
  displayName?: string;
  avatarUrl?: string;
  timezone: string;
  locale: string;
  role: UserRole;
  permissions: string[];
  teamId?: string;
  skills: string[];
  skillLevels: Record<string, 'beginner' | 'intermediate' | 'expert'>;
  status: UserStatus;
  maxConcurrentConversations: number;
  currentConversationCount: number;
  slackUserId?: string;
  isActive: boolean;
  lastActiveAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Team {
  id: string;
  name: string;
  description?: string;
  defaultSkills: string[];
  routingMode: 'round_robin' | 'least_busy' | 'skill_based' | 'manual';
  slaOverrideId?: string;
  escalationTeamId?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface InternalNote {
  id: string;
  conversationId?: string;
  resolutionId?: string;
  content: string;
  visibility: 'private' | 'team' | 'all';
  authorId: string;
  mentions: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Assignment {
  id: string;
  conversationId: string;
  agentId: string;
  teamId?: string;
  assignedBy: 'routing_engine' | 'manual' | 'escalation' | 'transfer' | 'reopen';
  assignedByUserId?: string;
  reason?: string;
  assignedAt: Date;
  unassignedAt?: Date;
  unassignmentReason?: string;
}

export interface SLA {
  id: string;
  name: string;
  tier: SLATier;
  firstResponseTimeMinutes: number;
  resolutionTimeMinutes: number;
  updateIntervalMinutes: number;
  channelOverrides: Record<Channel, Partial<SLATimings>>;
  priorityOverrides: Record<Severity, Partial<SLATimings>>;
  businessHoursOnly: boolean;
  businessHours: BusinessHours;
  timezone: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SLATimings {
  firstResponseTimeMinutes: number;
  resolutionTimeMinutes: number;
}

export interface BusinessHours {
  monday?: { start: string; end: string };
  tuesday?: { start: string; end: string };
  wednesday?: { start: string; end: string };
  thursday?: { start: string; end: string };
  friday?: { start: string; end: string };
  saturday?: { start: string; end: string };
  sunday?: { start: string; end: string };
}

export interface ChannelConfig {
  id: string;
  type: Channel;
  name: string;
  config: Record<string, any>;
  credentialsEncrypted?: string;
  status: 'active' | 'inactive' | 'error';
  lastError?: string;
  lastErrorAt?: Date;
  defaultTeamId?: string;
  defaultSkills: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface AutomationRule {
  id: string;
  name: string;
  description?: string;
  triggerEvent: EventType;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  priority: number;
  stopProcessing: boolean;
  cooldownSeconds: number;
  cooldownKey?: string;
  enabled: boolean;
  createdById?: string;
  updatedById?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AutomationCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'in' | 'not_in';
  value: any;
}

export interface AutomationAction {
  type:
    | 'send_message'
    | 'assign_agent'
    | 'assign_team'
    | 'change_state'
    | 'add_tag'
    | 'remove_tag'
    | 'notify_slack'
    | 'create_resolution'
    | 'update_severity'
    | 'send_webhook';
  params: Record<string, any>;
}

export interface KnowledgeBaseArticle {
  id: string;
  title: string;
  slug: string;
  content: string;
  contentHtml?: string;
  summary?: string;
  categoryId?: string;
  tags: string[];
  intentKeywords: string[];
  excludeFromAi: boolean;
  visibility: 'internal' | 'customer' | 'both';
  viewCount: number;
  helpfulCount: number;
  notHelpfulCount: number;
  aiSuggestionCount: number;
  aiSuccessCount: number;
  status: 'draft' | 'published' | 'archived';
  authorId?: string;
  lastUpdatedById?: string;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface EventLog {
  id: number;
  eventType: EventType;
  eventVersion: number;
  entityType: string;
  entityId: string;
  payload: Record<string, any>;
  actorType: 'user' | 'system' | 'ai' | 'automation' | 'api';
  actorId?: string;
  actorIp?: string;
  actorUserAgent?: string;
  conversationId?: string;
  customerId?: string;
  resolutionId?: string;
  correlationId?: string;
  causationId?: number;
  createdAt: Date;
}

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
  | 'swarm.closed';

export interface CustomerUpdate {
  id: string;
  resolutionId: string;
  conversationId: string;
  updateType: 'acknowledgement' | 'status_update' | 'eta_update' | 'resolution_summary' | 'scheduled_update';
  content: string;
  channel: Channel;
  messageId?: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed';
  errorMessage?: string;
  scheduledFor?: Date;
  sentAt?: Date;
  createdAt: Date;
}

// ============================================================================
// NORMALIZED MESSAGE (for channel adapters)
// ============================================================================

export interface NormalizedMessage {
  id: string;
  channel: Channel;
  channelMessageId?: string;
  direction: MessageDirection;
  senderType: SenderType;

  // Identity hints for customer resolution
  senderIdentity: {
    email?: string;
    phone?: string;
    socialId?: string;
    deviceFingerprint?: string;
    name?: string;
    avatarUrl?: string;
  };

  // Content
  content: string;
  contentHtml?: string;
  contentType: 'text' | 'html' | 'markdown' | 'voice_transcript';

  // Attachments
  attachments: {
    url: string;
    filename: string;
    contentType: string;
    sizeBytes?: number;
  }[];

  // Threading
  replyToMessageId?: string;
  threadId?: string;

  // Conversation matching hints
  conversationHints: {
    emailThreadId?: string;
    emailSubject?: string;
    socialPostId?: string;
    sessionId?: string;
  };

  // Channel-specific data
  channelMetadata: Record<string, any>;

  // Timestamp
  timestamp: Date;
  receivedAt: Date;
}

// ============================================================================
// AI CLASSIFICATION RESULT
// ============================================================================

export interface AIClassificationResult {
  intent: Intent;
  intentConfidence: number;
  severity: Severity;
  severityConfidence: number;
  sentiment: Sentiment;
  sentimentScore: number;
  entities: ExtractedEntities;
  suspectedRootCause?: string;
  suggestedAction: 'deflect' | 'route' | 'escalate' | 'resolve';
  suggestedResponse?: string;
  suggestedKbArticles: string[];
  suggestedSkills: string[];
  escalationRecommended: boolean;
  modelVersion: string;
  processingTimeMs: number;
  reasoning?: string;
}

// ============================================================================
// HANDOFF BRIEF (for human escalation)
// ============================================================================

export interface HandoffBrief {
  conversationId: string;
  customerId: string;
  customerName?: string;
  slaTier: SLATier;

  // Context
  summary: string;
  intent: Intent;
  severity: Severity;
  sentiment: Sentiment;

  // Key information
  keyEntities: ExtractedEntities;
  suspectedRootCause?: string;

  // History
  messageCount: number;
  channelsUsed: Channel[];
  previousInteractions: number;

  // AI attempt summary
  aiAttemptedDeflection: boolean;
  aiDeflectionOutcome?: string;

  // Routing
  suggestedTeam?: string;
  suggestedSkills: string[];
  urgencyScore: number;

  // SLA
  firstResponseDueAt?: Date;
  minutesUntilBreach?: number;
}
