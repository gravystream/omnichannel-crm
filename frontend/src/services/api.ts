import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { store, authActions } from '../store';
import type { ApiResponse, User, Conversation, Message, Customer, Resolution, AnalyticsMetrics } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = store.getState().auth.token;
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      store.dispatch(authActions.logout());
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: async (email: string, password: string) => {
    const { data } = await api.post<ApiResponse<{ user: User; token: string }>>('/auth/login', { email, password });
    return data;
  },

  register: async (userData: { email: string; password: string; name: string }) => {
    const { data } = await api.post<ApiResponse<{ user: User; token: string }>>('/auth/register', userData);
    return data;
  },

  me: async () => {
    const { data } = await api.get<ApiResponse<User>>('/auth/me');
    return data;
  },

  updateStatus: async (status: User['status']) => {
    const { data } = await api.put<ApiResponse<User>>('/auth/status', { status });
    return data;
  },

  logout: async () => {
    await api.post('/auth/logout');
  },
};

// Conversations API
export const conversationsApi = {
  list: async (params?: { status?: string; channel?: string; assignedTo?: string; page?: number; limit?: number }) => {
    const { data } = await api.get<ApiResponse<Conversation[]>>('/conversations', { params });
    return data;
  },

  getById: async (id: string) => {
    const { data } = await api.get<ApiResponse<Conversation>>(`/conversations/${id}`);
    return data;
  },

  getMessages: async (id: string, params?: { limit?: number; before?: string }) => {
    const { data } = await api.get<ApiResponse<Message[]>>(`/conversations/${id}/messages`, { params });
    return data;
  },

  sendMessage: async (id: string, content: string, attachments?: File[]) => {
    const formData = new FormData();
    formData.append('content', content);
    if (attachments) {
      attachments.forEach(file => formData.append('attachments', file));
    }
    const { data } = await api.post<ApiResponse<Message>>(`/conversations/${id}/messages`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  updateStatus: async (id: string, status: string) => {
    const { data } = await api.put<ApiResponse<Conversation>>(`/conversations/${id}/status`, { status });
    return data;
  },

  assign: async (id: string, agentId: string) => {
    const { data } = await api.put<ApiResponse<Conversation>>(`/conversations/${id}/assign`, { agentId });
    return data;
  },

  updatePriority: async (id: string, priority: string) => {
    const { data } = await api.put<ApiResponse<Conversation>>(`/conversations/${id}/priority`, { priority });
    return data;
  },

  addTags: async (id: string, tags: string[]) => {
    const { data } = await api.post<ApiResponse<Conversation>>(`/conversations/${id}/tags`, { tags });
    return data;
  },
};

// Customers API
export const customersApi = {
  list: async (params?: { search?: string; segment?: string; page?: number; limit?: number }) => {
    const { data } = await api.get<ApiResponse<Customer[]>>('/customers', { params });
    return data;
  },

  getById: async (id: string) => {
    const { data } = await api.get<ApiResponse<Customer>>(`/customers/${id}`);
    return data;
  },

  create: async (customerData: Partial<Customer>) => {
    const { data } = await api.post<ApiResponse<Customer>>('/customers', customerData);
    return data;
  },

  update: async (id: string, customerData: Partial<Customer>) => {
    const { data } = await api.put<ApiResponse<Customer>>(`/customers/${id}`, customerData);
    return data;
  },

  getConversations: async (id: string) => {
    const { data } = await api.get<ApiResponse<Conversation[]>>(`/customers/${id}/conversations`);
    return data;
  },

  merge: async (primaryId: string, secondaryId: string) => {
    const { data } = await api.post<ApiResponse<Customer>>(`/customers/${primaryId}/merge`, { secondaryId });
    return data;
  },
};

// Resolutions API
export const resolutionsApi = {
  list: async (params?: { status?: string; priority?: string; page?: number; limit?: number }) => {
    const { data } = await api.get<ApiResponse<Resolution[]>>('/resolutions', { params });
    return data;
  },

  getById: async (id: string) => {
    const { data } = await api.get<ApiResponse<Resolution>>(`/resolutions/${id}`);
    return data;
  },

  create: async (resolutionData: Partial<Resolution>) => {
    const { data } = await api.post<ApiResponse<Resolution>>('/resolutions', resolutionData);
    return data;
  },

  update: async (id: string, resolutionData: Partial<Resolution>) => {
    const { data } = await api.put<ApiResponse<Resolution>>(`/resolutions/${id}`, resolutionData);
    return data;
  },

  addUpdate: async (id: string, update: { type: string; content: string; isPublic?: boolean }) => {
    const { data } = await api.post<ApiResponse<Resolution>>(`/resolutions/${id}/updates`, update);
    return data;
  },

  updateStatus: async (id: string, status: string) => {
    const { data } = await api.put<ApiResponse<Resolution>>(`/resolutions/${id}/status`, { status });
    return data;
  },
};

// Analytics API
export const analyticsApi = {
  getOverview: async (params?: { startDate?: string; endDate?: string }) => {
    const { data } = await api.get<ApiResponse<AnalyticsMetrics>>('/analytics/overview', { params });
    return data;
  },

  getConversationMetrics: async (params?: { startDate?: string; endDate?: string; groupBy?: string }) => {
    const { data } = await api.get<ApiResponse<any>>('/analytics/conversations', { params });
    return data;
  },

  getAgentPerformance: async (params?: { startDate?: string; endDate?: string }) => {
    const { data } = await api.get<ApiResponse<any>>('/analytics/agents', { params });
    return data;
  },

  getChannelBreakdown: async (params?: { startDate?: string; endDate?: string }) => {
    const { data } = await api.get<ApiResponse<any>>('/analytics/channels', { params });
    return data;
  },
};

// AI API
export const aiApi = {
  getConfig: async () => {
    const { data } = await api.get<ApiResponse<any>>('/ai/config');
    return data;
  },

  saveConfig: async (config: {
    provider?: string;
    apiKey?: string;
    model?: string;
    autoResponse?: boolean;
    confidenceThreshold?: number;
    maxTokens?: number;
    temperature?: number;
    autoAssign?: boolean;
    aiEnabled?: boolean;
    slackEscalationEnabled?: boolean;
    slackWebhookUrl?: string;
    slackChannel?: string;
    enableKnowledgeDeflection?: boolean;
  }) => {
    const { data } = await api.post<ApiResponse<any>>('/ai/config', config);
    return data;
  },

  getTrainingData: async () => {
    const { data } = await api.get<ApiResponse<any[]>>('/ai/training');
    return data;
  },

  addTrainingData: async (item: { question: string; answer: string; category?: string; tags?: string[] }) => {
    const { data } = await api.post<ApiResponse<any>>('/ai/training', item);
    return data;
  },

  bulkAddTrainingData: async (items: { question: string; answer: string; category?: string; tags?: string[] }[]) => {
    const { data } = await api.post<ApiResponse<any>>('/ai/training/bulk', { items });
    return data;
  },

  updateTrainingData: async (id: string, item: { question?: string; answer?: string; category?: string; tags?: string[] }) => {
    const { data } = await api.put<ApiResponse<any>>(`/ai/training/${id}`, item);
    return data;
  },

  deleteTrainingData: async (id: string) => {
    const { data } = await api.delete<ApiResponse<void>>(`/ai/training/${id}`);
    return data;
  },

  getTemplates: async () => {
    const { data } = await api.get<ApiResponse<any[]>>('/ai/templates');
    return data;
  },

  addTemplate: async (template: { name: string; content: string; category?: string }) => {
    const { data } = await api.post<ApiResponse<any>>('/ai/templates', template);
    return data;
  },

  updateTemplate: async (id: string, template: { name?: string; content?: string; category?: string }) => {
    const { data } = await api.put<ApiResponse<any>>(`/ai/templates/${id}`, template);
    return data;
  },

  deleteTemplate: async (id: string) => {
    const { data } = await api.delete<ApiResponse<void>>(`/ai/templates/${id}`);
    return data;
  },

  testAI: async (message: string) => {
    const { data } = await api.post<ApiResponse<{ response: string; provider: string; model: string; knowledgeUsed: number }>>('/ai/test', { message });
    return data;
  },

  classifyMessage: async (message: string, conversationId?: string, channel?: string) => {
    const { data } = await api.post<ApiResponse<any>>('/ai/classify', { message, conversationId, channel });
    return data;
  },

  generateResponse: async (message: string, conversationId?: string, context?: string) => {
    const { data } = await api.post<ApiResponse<any>>('/ai/respond', { message, conversationId, context });
    return data;
  },

  autoAssign: async (conversationId: string, intent?: string, severity?: string, skills?: string[]) => {
    const { data } = await api.post<ApiResponse<any>>('/ai/assign', { conversationId, intent, severity, skills });
    return data;
  },

  escalateToSlack: async (conversationId: string, title: string, description: string, severity: string, channel?: string) => {
    const { data } = await api.post<ApiResponse<any>>('/ai/escalate-slack', { conversationId, title, description, severity, channel });
    return data;
  },

  getStats: async () => {
    const { data } = await api.get<ApiResponse<any>>('/ai/stats');
    return data;
  },

  getActions: async (limit?: number, type?: string) => {
    const { data } = await api.get<ApiResponse<any[]>>('/ai/actions', { params: { limit, type } });
    return data;
  },
};

// Knowledge Base API
export const knowledgeBaseApi = {
  getArticles: async (params?: { search?: string; category?: string; status?: string; page?: number; pageSize?: number }) => {
    const { data } = await api.get<ApiResponse<any[]>>('/knowledge-base/articles', { params });
    return data;
  },

  getArticle: async (id: string) => {
    const { data } = await api.get<ApiResponse<any>>(`/knowledge-base/articles/${id}`);
    return data;
  },

  createArticle: async (article: { title: string; content: string; category?: string; tags?: string[]; status?: string; summary?: string }) => {
    const { data } = await api.post<ApiResponse<any>>('/knowledge-base/articles', article);
    return data;
  },

  updateArticle: async (id: string, article: { title?: string; content?: string; category?: string; tags?: string[]; status?: string; summary?: string }) => {
    const { data } = await api.put<ApiResponse<any>>(`/knowledge-base/articles/${id}`, article);
    return data;
  },

  deleteArticle: async (id: string) => {
    const { data } = await api.delete<ApiResponse<void>>(`/knowledge-base/articles/${id}`);
    return data;
  },

  markHelpful: async (id: string, helpful: boolean) => {
    const { data } = await api.post<ApiResponse<any>>(`/knowledge-base/articles/${id}/helpful`, { helpful });
    return data;
  },

  getCategories: async () => {
    const { data } = await api.get<ApiResponse<any[]>>('/knowledge-base/categories');
    return data;
  },

  search: async (query: string, limit?: number) => {
    const { data } = await api.get<ApiResponse<any[]>>('/knowledge-base/search', { params: { q: query, limit } });
    return data;
  },

  getStats: async () => {
    const { data } = await api.get<ApiResponse<any>>('/knowledge-base/stats');
    return data;
  },

  importArticles: async (articles: any[]) => {
    const { data } = await api.post<ApiResponse<any>>('/knowledge-base/import', { articles });
    return data;
  },
};

// Admin API
export const adminApi = {
  getUsers: async () => {
    const { data } = await api.get<ApiResponse<User[]>>('/admin/users');
    return data;
  },

  createUser: async (userData: { email: string; password: string; name: string; role: string }) => {
    const { data } = await api.post<ApiResponse<User>>('/admin/users', userData);
    return data;
  },

  updateUser: async (id: string, userData: Partial<User>) => {
    const { data } = await api.put<ApiResponse<User>>(`/admin/users/${id}`, userData);
    return data;
  },

  deleteUser: async (id: string) => {
    const { data } = await api.delete<ApiResponse<void>>(`/admin/users/${id}`);
    return data;
  },

  getSettings: async () => {
    const { data } = await api.get<ApiResponse<Record<string, any>>>('/admin/settings');
    return data;
  },

  updateSettings: async (settings: Record<string, any>) => {
    const { data } = await api.put<ApiResponse<Record<string, any>>>('/admin/settings', settings);
    return data;
  },

  getChannelConfigs: async () => {
    const { data } = await api.get<ApiResponse<any[]>>('/admin/channels');
    return data;
  },

  updateChannelConfig: async (channelId: string, config: any) => {
    const { data } = await api.put<ApiResponse<any>>(`/admin/channels/${channelId}`, config);
    return data;
  },
};

export default api;
