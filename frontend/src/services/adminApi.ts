import api from './api';
import type { ApiResponse, Team, SLAConfig, AutomationRule, SystemSettings } from '../types';

export const adminApi = {
  // Teams
  getTeams: async () => {
    const { data } = await api.get<ApiResponse<Team[]>>('/admin/teams');
    return data;
  },
  createTeam: async (teamData: Omit<Team, 'id' | 'createdAt' | 'memberIds'>) => {
    const { data } = await api.post<ApiResponse<Team>>('/admin/teams', teamData);
    return data;
  },
  updateTeam: async (id: string, teamData: Partial<Team>) => {
    const { data } = await api.put<ApiResponse<Team>>(`/admin/teams/${id}`, teamData);
    return data;
  },
  deleteTeam: async (id: string) => {
    const { data } = await api.delete<ApiResponse<void>>(`/admin/teams/${id}`);
    return data;
  },

  // SLA
  getSLAConfigs: async () => {
    const { data } = await api.get<ApiResponse<SLAConfig[]>>('/admin/sla');
    return data;
  },
  updateSLAConfig: async (priority: string, slaData: Partial<SLAConfig>) => {
    const { data } = await api.put<ApiResponse<SLAConfig>>(`/admin/sla/${priority}`, slaData);
    return data;
  },

  // Automation
  getAutomationRules: async () => {
    const { data } = await api.get<ApiResponse<AutomationRule[]>>('/admin/automation');
    return data;
  },
  createAutomationRule: async (ruleData: Omit<AutomationRule, 'id' | 'createdAt'>) => {
    const { data } = await api.post<ApiResponse<AutomationRule>>('/admin/automation', ruleData);
    return data;
  },
  updateAutomationRule: async (id: string, ruleData: Partial<AutomationRule>) => {
    const { data } = await api.patch<ApiResponse<AutomationRule>>(`/admin/automation/${id}`, ruleData);
    return data;
  },
  deleteAutomationRule: async (id: string) => {
    const { data } = await api.delete<ApiResponse<void>>(`/admin/automation/${id}`);
    return data;
  },

  // Settings
  getSettings: async () => {
    const { data } = await api.get<ApiResponse<SystemSettings>>('/admin/settings');
    return data;
  },
  updateSettings: async (settings: Partial<SystemSettings>) => {
    const { data} = await api.patch<ApiResponse<SystemSettings>>('/admin/settings', settings);
    return data;
  },
};
