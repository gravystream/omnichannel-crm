// User & Auth Types
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'owner' | 'admin' | 'agent' | 'viewer';
  avatar?: string;
  status: 'online' | 'away' | 'busy' | 'offline';
  skills: string[];
  maxConcurrentChats: number;
  createdAt: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

// Conversation Types
export type ChannelType = 'web_chat' | 'email' | 'whatsapp' | 'sms' | 'voice' | 'social';
export type ConversationStatus = 'open' | 'pending' | 'resolved' | 'closed';
export type ConversationPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface Conversation {
  id: string;
  customerId: string;
  customer?: Customer;
  channel: ChannelType;
  status: ConversationStatus;
  priority: ConversationPriority;
  subject?: string;
  assignedTo?: string;
  assignedAgent?: User;
  tags: string[];
  sentiment?: 'positive' | 'neutral' | 'negative';
  classification?: string;
  firstResponseDueAt?: string;
  resolutionDueAt?: string;
  firstResponseAt?: string;
  resolvedAt?: string;
  lastMessageAt: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  direction: 'inbound' | 'outbound';
  senderType: 'customer' | 'agent' | 'system' | 'bot';
  senderId?: string;
  content: string;
  contentType: 'text' | 'html' | 'markdown';
  attachments: Attachment[];
  metadata?: Record<string, any>;
  aiAnnotations?: {
    intent?: string;
    sentiment?: string;
    entities?: Array<{ type: string; value: string }>;
    suggestedResponses?: string[];
  };
  createdAt: string;
}

export interface Attachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  url: string;
}

// Customer Types
export interface Customer {
  id: string;
  identityGraph: {
    emails: string[];
    phoneNumbers: string[];
    socialIds: Record<string, string>;
  };
  profile: {
    name?: string;
    company?: string;
    title?: string;
    location?: string;
    timezone?: string;
    avatar?: string;
  };
  slaTier: 'standard' | 'premium' | 'enterprise';
  tags: string[];
  segments: string[];
  customFields: Record<string, any>;
  stats?: {
    totalConversations: number;
    openConversations: number;
    avgResolutionTime: number;
    satisfaction: number;
  };
  createdAt: string;
  updatedAt: string;
}

// Resolution Types
export type ResolutionPriority = 'P0' | 'P1' | 'P2' | 'P3';
export type ResolutionStatus = 'investigating' | 'identified' | 'in_progress' | 'resolved' | 'closed';

export interface Resolution {
  id: string;
  conversationId: string;
  customerId: string;
  customer?: Customer;
  title: string;
  description: string;
  priority: ResolutionPriority;
  status: ResolutionStatus;
  category: string;
  rootCause?: string;
  resolution?: string;
  eta?: string;
  assignedTeam?: string;
  assignedTo?: string;
  swarmChannel?: string;
  updates: ResolutionUpdate[];
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
}

export interface ResolutionUpdate {
  id: string;
  resolutionId: string;
  type: 'status_change' | 'note' | 'customer_update' | 'escalation';
  content: string;
  author: string;
  isPublic: boolean;
  createdAt: string;
}

// Knowledge Base Types
export interface KBArticle {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  status: 'draft' | 'published' | 'archived';
  author: string;
  views: number;
  helpful: number;
  notHelpful: number;
  createdAt: string;
  updatedAt: string;
}

// Analytics Types
export interface AnalyticsMetrics {
  conversations: {
    total: number;
    open: number;
    resolved: number;
    avgResolutionTime: number;
    firstResponseTime: number;
  };
  channels: Record<ChannelType, number>;
  satisfaction: {
    average: number;
    responses: number;
  };
  agents: {
    online: number;
    busy: number;
    avgHandleTime: number;
  };
}

export interface TimeSeriesData {
  timestamp: string;
  value: number;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// UI State Types
export interface UIState {
  sidebarOpen: boolean;
  activeConversation: string | null;
  selectedCustomer: string | null;
  theme: 'light' | 'dark' | 'system';
  notifications: Notification[];
}

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}
