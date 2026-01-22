/**
 * Admin Routes
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// In-memory storage for admin data
const users = new Map<string, any>();
const teams = new Map<string, any>();
const slaConfigs = new Map<string, any>();
const automationRules = new Map<string, any>();

// Initialize sample admin data
function initAdminData() {
  // Users
  users.set('user_admin1', {
    id: 'user_admin1',
    email: 'admin@company.com',
    name: 'Admin User',
    role: 'admin',
    status: 'active',
    permissions: ['*'],
    createdAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString()
  });

  users.set('user_agent1', {
    id: 'user_agent1',
    email: 'agent@company.com',
    name: 'Sarah Support',
    role: 'agent',
    status: 'active',
    teamId: 'team_support',
    skills: ['billing', 'technical', 'general'],
    maxConcurrentChats: 8,
    permissions: ['conversations.view', 'conversations.respond', 'customers.view'],
    createdAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString()
  });

  users.set('user_eng1', {
    id: 'user_eng1',
    email: 'engineer@company.com',
    name: 'Mike Engineer',
    role: 'engineer',
    status: 'active',
    teamId: 'team_engineering',
    skills: ['backend', 'database', 'payments'],
    permissions: ['resolutions.view', 'resolutions.update', 'conversations.view'],
    createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
  });

  // Teams
  teams.set('team_support', {
    id: 'team_support',
    name: 'Customer Support',
    description: 'Front-line customer support team',
    memberIds: ['user_agent1'],
    skills: ['billing', 'technical', 'general'],
    workingHours: {
      timezone: 'America/New_York',
      schedule: {
        monday: { start: '09:00', end: '18:00' },
        tuesday: { start: '09:00', end: '18:00' },
        wednesday: { start: '09:00', end: '18:00' },
        thursday: { start: '09:00', end: '18:00' },
        friday: { start: '09:00', end: '17:00' }
      }
    },
    createdAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString()
  });

  teams.set('team_engineering', {
    id: 'team_engineering',
    name: 'Engineering',
    description: 'Technical escalation team',
    memberIds: ['user_eng1'],
    skills: ['backend', 'frontend', 'database', 'payments', 'infrastructure'],
    isEscalationTeam: true,
    createdAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString()
  });

  // SLA Configurations
  slaConfigs.set('sla_p0', {
    id: 'sla_p0',
    priority: 'P0',
    name: 'Critical - System Down',
    firstResponseMinutes: 15,
    resolutionMinutes: 240, // 4 hours
    escalationMinutes: 30,
    businessHoursOnly: false,
    isActive: true
  });

  slaConfigs.set('sla_p1', {
    id: 'sla_p1',
    priority: 'P1',
    name: 'High - Major Impact',
    firstResponseMinutes: 30,
    resolutionMinutes: 480, // 8 hours
    escalationMinutes: 60,
    businessHoursOnly: false,
    isActive: true
  });

  slaConfigs.set('sla_p2', {
    id: 'sla_p2',
    priority: 'P2',
    name: 'Medium - Standard',
    firstResponseMinutes: 60,
    resolutionMinutes: 1440, // 24 hours
    escalationMinutes: 120,
    businessHoursOnly: true,
    isActive: true
  });

  slaConfigs.set('sla_p3', {
    id: 'sla_p3',
    priority: 'P3',
    name: 'Low - Minor',
    firstResponseMinutes: 240, // 4 hours
    resolutionMinutes: 4320, // 72 hours
    escalationMinutes: 480,
    businessHoursOnly: true,
    isActive: true
  });

  // Automation Rules
  automationRules.set('rule_auto_classify', {
    id: 'rule_auto_classify',
    name: 'Auto-Classify Incoming Messages',
    description: 'Automatically classify intent and severity for new messages',
    trigger: {
      event: 'message.received',
      conditions: [{ field: 'direction', operator: 'equals', value: 'inbound' }]
    },
    actions: [
      { type: 'ai_classify', config: { classifyIntent: true, classifySeverity: true, classifySentiment: true } }
    ],
    isActive: true,
    priority: 1
  });

  automationRules.set('rule_p0_alert', {
    id: 'rule_p0_alert',
    name: 'P0 Incident Alert',
    description: 'Immediately alert on-call when P0 incident detected',
    trigger: {
      event: 'conversation.classified',
      conditions: [{ field: 'severity', operator: 'equals', value: 'P0' }]
    },
    actions: [
      { type: 'send_notification', config: { channel: 'slack', target: '#oncall-alerts' } },
      { type: 'assign_team', config: { teamId: 'team_engineering' } },
      { type: 'create_resolution', config: { priority: 'P0' } }
    ],
    isActive: true,
    priority: 10
  });

  automationRules.set('rule_knowledge_deflect', {
    id: 'rule_knowledge_deflect',
    name: 'Knowledge Base Deflection',
    description: 'Attempt to answer how-to questions with knowledge base',
    trigger: {
      event: 'conversation.classified',
      conditions: [
        { field: 'intent', operator: 'equals', value: 'how_to_guidance' },
        { field: 'aiConfidence', operator: 'gte', value: 0.8 }
      ]
    },
    actions: [
      { type: 'search_knowledge_base', config: { autoRespond: true, confidenceThreshold: 0.85 } }
    ],
    isActive: true,
    priority: 5
  });
}

initAdminData();

// =============================================================================
// USER MANAGEMENT
// =============================================================================

// GET /api/admin/users
router.get('/users', (req: Request, res: Response) => {
  const { role, status, teamId } = req.query;

  let result = Array.from(users.values());

  if (role) result = result.filter(u => u.role === role);
  if (status) result = result.filter(u => u.status === status);
  if (teamId) result = result.filter(u => u.teamId === teamId);

  res.json({ success: true, data: result });
});

// GET /api/admin/users/:id
router.get('/users/:id', (req: Request, res: Response) => {
  const user = users.get(req.params.id);
  if (!user) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
  }
  res.json({ success: true, data: user });
});

// POST /api/admin/users
router.post('/users', (req: Request, res: Response) => {
  const { email, name, role, teamId, skills, permissions } = req.body;

  const id = `user_${uuidv4().slice(0, 8)}`;
  const user = {
    id,
    email,
    name,
    role: role || 'agent',
    status: 'active',
    teamId: teamId || null,
    skills: skills || [],
    permissions: permissions || [],
    maxConcurrentChats: 6,
    createdAt: new Date().toISOString()
  };

  users.set(id, user);
  res.status(201).json({ success: true, data: user });
});

// PATCH /api/admin/users/:id
router.patch('/users/:id', (req: Request, res: Response) => {
  const user = users.get(req.params.id);
  if (!user) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
  }

  const { name, role, status, teamId, skills, permissions, maxConcurrentChats } = req.body;

  if (name !== undefined) user.name = name;
  if (role !== undefined) user.role = role;
  if (status !== undefined) user.status = status;
  if (teamId !== undefined) user.teamId = teamId;
  if (skills !== undefined) user.skills = skills;
  if (permissions !== undefined) user.permissions = permissions;
  if (maxConcurrentChats !== undefined) user.maxConcurrentChats = maxConcurrentChats;

  user.updatedAt = new Date().toISOString();

  res.json({ success: true, data: user });
});

// =============================================================================
// TEAM MANAGEMENT
// =============================================================================

// GET /api/admin/teams
router.get('/teams', (req: Request, res: Response) => {
  res.json({ success: true, data: Array.from(teams.values()) });
});

// GET /api/admin/teams/:id
router.get('/teams/:id', (req: Request, res: Response) => {
  const team = teams.get(req.params.id);
  if (!team) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Team not found' } });
  }

  // Include team members
  const members = team.memberIds.map((id: string) => users.get(id)).filter(Boolean);
  res.json({ success: true, data: { ...team, members } });
});

// POST /api/admin/teams
router.post('/teams', (req: Request, res: Response) => {
  const { name, description, skills, workingHours, isEscalationTeam } = req.body;

  const id = `team_${uuidv4().slice(0, 8)}`;
  const team = {
    id,
    name,
    description: description || '',
    memberIds: [],
    skills: skills || [],
    workingHours: workingHours || null,
    isEscalationTeam: isEscalationTeam || false,
    createdAt: new Date().toISOString()
  };

  teams.set(id, team);
  res.status(201).json({ success: true, data: team });
});

// POST /api/admin/teams/:id/members
router.post('/teams/:id/members', (req: Request, res: Response) => {
  const team = teams.get(req.params.id);
  if (!team) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Team not found' } });
  }

  const { userId } = req.body;
  const user = users.get(userId);
  if (!user) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
  }

  if (!team.memberIds.includes(userId)) {
    team.memberIds.push(userId);
    user.teamId = req.params.id;
  }

  res.json({ success: true, data: team });
});

// =============================================================================
// SLA CONFIGURATION
// =============================================================================

// GET /api/admin/sla
router.get('/sla', (req: Request, res: Response) => {
  res.json({ success: true, data: Array.from(slaConfigs.values()) });
});

// PUT /api/admin/sla/:priority
router.put('/sla/:priority', (req: Request, res: Response) => {
  const priority = req.params.priority.toUpperCase();
  const slaId = `sla_${priority.toLowerCase()}`;

  const existing = slaConfigs.get(slaId);
  if (!existing) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'SLA config not found' } });
  }

  const {
    name,
    firstResponseMinutes,
    resolutionMinutes,
    escalationMinutes,
    businessHoursOnly,
    isActive
  } = req.body;

  if (name !== undefined) existing.name = name;
  if (firstResponseMinutes !== undefined) existing.firstResponseMinutes = firstResponseMinutes;
  if (resolutionMinutes !== undefined) existing.resolutionMinutes = resolutionMinutes;
  if (escalationMinutes !== undefined) existing.escalationMinutes = escalationMinutes;
  if (businessHoursOnly !== undefined) existing.businessHoursOnly = businessHoursOnly;
  if (isActive !== undefined) existing.isActive = isActive;

  existing.updatedAt = new Date().toISOString();

  res.json({ success: true, data: existing });
});

// =============================================================================
// AUTOMATION RULES
// =============================================================================

// GET /api/admin/automation
router.get('/automation', (req: Request, res: Response) => {
  const rules = Array.from(automationRules.values());
  rules.sort((a, b) => b.priority - a.priority);
  res.json({ success: true, data: rules });
});

// GET /api/admin/automation/:id
router.get('/automation/:id', (req: Request, res: Response) => {
  const rule = automationRules.get(req.params.id);
  if (!rule) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Rule not found' } });
  }
  res.json({ success: true, data: rule });
});

// POST /api/admin/automation
router.post('/automation', (req: Request, res: Response) => {
  const { name, description, trigger, actions, priority, isActive } = req.body;

  const id = `rule_${uuidv4().slice(0, 8)}`;
  const rule = {
    id,
    name,
    description: description || '',
    trigger,
    actions,
    priority: priority || 0,
    isActive: isActive !== false,
    createdAt: new Date().toISOString()
  };

  automationRules.set(id, rule);
  res.status(201).json({ success: true, data: rule });
});

// PATCH /api/admin/automation/:id
router.patch('/automation/:id', (req: Request, res: Response) => {
  const rule = automationRules.get(req.params.id);
  if (!rule) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Rule not found' } });
  }

  const { name, description, trigger, actions, priority, isActive } = req.body;

  if (name !== undefined) rule.name = name;
  if (description !== undefined) rule.description = description;
  if (trigger !== undefined) rule.trigger = trigger;
  if (actions !== undefined) rule.actions = actions;
  if (priority !== undefined) rule.priority = priority;
  if (isActive !== undefined) rule.isActive = isActive;

  rule.updatedAt = new Date().toISOString();

  res.json({ success: true, data: rule });
});

// DELETE /api/admin/automation/:id
router.delete('/automation/:id', (req: Request, res: Response) => {
  if (!automationRules.has(req.params.id)) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Rule not found' } });
  }

  automationRules.delete(req.params.id);
  res.json({ success: true, message: 'Rule deleted' });
});

// =============================================================================
// SYSTEM SETTINGS
// =============================================================================

// GET /api/admin/settings
router.get('/settings', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      general: {
        companyName: 'Demo Company',
        supportEmail: 'support@demo.com',
        timezone: 'America/New_York',
        dateFormat: 'MM/DD/YYYY',
        timeFormat: '12h'
      },
      ai: {
        provider: process.env.AI_PROVIDER || 'openai',
        model: 'gpt-4',
        confidenceThreshold: 0.7,
        autoClassifyEnabled: true,
        autoDeflectEnabled: true,
        maxAutoResponsesPerConversation: 3
      },
      channels: {
        webChat: { enabled: true, widgetColor: '#0066FF' },
        email: { enabled: true, inboundAddress: 'support@demo.com' },
        whatsapp: { enabled: false },
        sms: { enabled: false },
        voice: { enabled: false },
        facebook: { enabled: false },
        instagram: { enabled: false },
        twitter: { enabled: false }
      },
      notifications: {
        slackEnabled: true,
        emailAlertsEnabled: true,
        slaWarningMinutes: 15
      }
    }
  });
});

// PATCH /api/admin/settings
router.patch('/settings', (req: Request, res: Response) => {
  // In production: persist settings
  console.log('Settings update requested:', req.body);

  res.json({
    success: true,
    message: 'Settings updated'
  });
});

// =============================================================================
// HEALTH & STATUS
// =============================================================================

// GET /api/admin/health
router.get('/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      version: '1.0.0',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected',
        redis: 'connected',
        kafka: 'connected',
        elasticsearch: 'connected',
        ai: 'connected'
      }
    }
  });
});

export default router;
