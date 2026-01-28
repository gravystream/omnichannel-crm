import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// In-memory storage for agents, roles, and designations
const agents = new Map<string, any>();
const roles = new Map<string, any>();
const designations = new Map<string, any>();

// Initialize default roles
const defaultRoles = [
  { id: 'role-admin', name: 'Administrator', description: 'Full system access', permissions: ['all'], color: '#dc2626' },
  { id: 'role-supervisor', name: 'Supervisor', description: 'Team management and reporting', permissions: ['view_dashboard', 'manage_agents', 'view_reports', 'manage_conversations', 'view_customers'], color: '#7c3aed' },
  { id: 'role-senior-agent', name: 'Senior Agent', description: 'Handle complex issues and mentor juniors', permissions: ['view_dashboard', 'manage_conversations', 'view_customers', 'use_ai', 'escalate'], color: '#2563eb' },
  { id: 'role-agent', name: 'Agent', description: 'Handle customer conversations', permissions: ['view_dashboard', 'manage_conversations', 'view_customers'], color: '#059669' },
  { id: 'role-viewer', name: 'Viewer', description: 'Read-only access', permissions: ['view_dashboard', 'view_customers'], color: '#6b7280' }
];

// Initialize default designations
const defaultDesignations = [
  { id: 'des-ceo', name: 'CEO', department: 'Executive', level: 1 },
  { id: 'des-cto', name: 'CTO', department: 'Executive', level: 1 },
  { id: 'des-manager', name: 'Support Manager', department: 'Support', level: 2 },
  { id: 'des-team-lead', name: 'Team Lead', department: 'Support', level: 3 },
  { id: 'des-senior', name: 'Senior Support Agent', department: 'Support', level: 4 },
  { id: 'des-agent', name: 'Support Agent', department: 'Support', level: 5 },
  { id: 'des-junior', name: 'Junior Support Agent', department: 'Support', level: 6 },
  { id: 'des-intern', name: 'Intern', department: 'Support', level: 7 }
];

// Initialize default agents
const defaultAgents = [
  { id: 'agent-1', name: 'John Smith', email: 'john@gravystream.io', phone: '+1234567890', roleId: 'role-admin', designationId: 'des-manager', status: 'online', avatar: '', department: 'Support', joinedAt: '2024-01-15', skills: ['billing', 'technical'], maxChats: 5 },
  { id: 'agent-2', name: 'Sarah Johnson', email: 'sarah@gravystream.io', phone: '+1234567891', roleId: 'role-supervisor', designationId: 'des-team-lead', status: 'online', avatar: '', department: 'Support', joinedAt: '2024-02-20', skills: ['sales', 'technical'], maxChats: 4 },
  { id: 'agent-3', name: 'Mike Wilson', email: 'mike@gravystream.io', phone: '+1234567892', roleId: 'role-senior-agent', designationId: 'des-senior', status: 'away', avatar: '', department: 'Support', joinedAt: '2024-03-10', skills: ['billing', 'sales'], maxChats: 5 },
  { id: 'agent-4', name: 'Emily Davis', email: 'emily@gravystream.io', phone: '+1234567893', roleId: 'role-agent', designationId: 'des-agent', status: 'online', avatar: '', department: 'Support', joinedAt: '2024-04-05', skills: ['technical'], maxChats: 4 },
  { id: 'agent-5', name: 'Chris Brown', email: 'chris@gravystream.io', phone: '+1234567894', roleId: 'role-agent', designationId: 'des-junior', status: 'offline', avatar: '', department: 'Support', joinedAt: '2024-05-01', skills: ['sales'], maxChats: 3 }
];

// Initialize data
defaultRoles.forEach(role => roles.set(role.id, role));
defaultDesignations.forEach(des => designations.set(des.id, des));
defaultAgents.forEach(agent => agents.set(agent.id, agent));

// Available permissions
const allPermissions = [
  { id: 'view_dashboard', name: 'View Dashboard', description: 'Access to main dashboard' },
  { id: 'manage_agents', name: 'Manage Agents', description: 'Add, edit, delete agents' },
  { id: 'manage_roles', name: 'Manage Roles', description: 'Create and modify roles' },
  { id: 'view_reports', name: 'View Reports', description: 'Access analytics and reports' },
  { id: 'manage_conversations', name: 'Manage Conversations', description: 'Handle customer chats' },
  { id: 'view_customers', name: 'View Customers', description: 'Access customer data' },
  { id: 'manage_customers', name: 'Manage Customers', description: 'Edit customer information' },
  { id: 'use_ai', name: 'Use AI Assistant', description: 'Access AI-powered features' },
  { id: 'manage_settings', name: 'Manage Settings', description: 'System configuration' },
  { id: 'manage_integrations', name: 'Manage Integrations', description: 'Configure integrations' },
  { id: 'escalate', name: 'Escalate Issues', description: 'Escalate to supervisors' },
  { id: 'delete_data', name: 'Delete Data', description: 'Permanently delete records' },
  { id: 'export_data', name: 'Export Data', description: 'Export customer data' },
  { id: 'all', name: 'Full Access', description: 'All permissions (Admin only)' }
];

// ============ AGENTS ROUTES ============

// Get all agents
router.get('/', (req: Request, res: Response) => {
  const agentList = Array.from(agents.values()).map(agent => ({
    ...agent,
    role: roles.get(agent.roleId),
    designation: designations.get(agent.designationId)
  }));
  res.json(agentList);
});

// Get single agent
router.get('/:id', (req: Request, res: Response) => {
  const agent = agents.get(req.params.id);
  if (!agent) {
    return res.status(404).json({ error: 'Agent not found' });
  }
  res.json({
    ...agent,
    role: roles.get(agent.roleId),
    designation: designations.get(agent.designationId)
  });
});

// Create agent
router.post('/', (req: Request, res: Response) => {
  const { name, email, phone, roleId, designationId, department, skills, maxChats } = req.body;
  
  if (!name || !email || !roleId) {
    return res.status(400).json({ error: 'Name, email, and role are required' });
  }
  
  const id = 'agent-' + uuidv4().slice(0, 8);
  const agent = {
    id,
    name,
    email,
    phone: phone || '',
    roleId,
    designationId: designationId || 'des-agent',
    status: 'offline',
    avatar: '',
    department: department || 'Support',
    joinedAt: new Date().toISOString().split('T')[0],
    skills: skills || [],
    maxChats: maxChats || 5
  };
  
  agents.set(id, agent);
  res.status(201).json({
    ...agent,
    role: roles.get(agent.roleId),
    designation: designations.get(agent.designationId)
  });
});

// Update agent
router.put('/:id', (req: Request, res: Response) => {
  const agent = agents.get(req.params.id);
  if (!agent) {
    return res.status(404).json({ error: 'Agent not found' });
  }
  
  const updated = { ...agent, ...req.body, id: agent.id };
  agents.set(agent.id, updated);
  res.json({
    ...updated,
    role: roles.get(updated.roleId),
    designation: designations.get(updated.designationId)
  });
});

// Delete agent
router.delete('/:id', (req: Request, res: Response) => {
  if (!agents.has(req.params.id)) {
    return res.status(404).json({ error: 'Agent not found' });
  }
  agents.delete(req.params.id);
  res.json({ success: true });
});

// Update agent status
router.patch('/:id/status', (req: Request, res: Response) => {
  const agent = agents.get(req.params.id);
  if (!agent) {
    return res.status(404).json({ error: 'Agent not found' });
  }
  
  agent.status = req.body.status;
  agents.set(agent.id, agent);
  res.json(agent);
});

// ============ ROLES ROUTES ============

// Get all roles
router.get('/config/roles', (req: Request, res: Response) => {
  res.json(Array.from(roles.values()));
});

// Create role
router.post('/config/roles', (req: Request, res: Response) => {
  const { name, description, permissions, color } = req.body;
  
  if (!name || !permissions) {
    return res.status(400).json({ error: 'Name and permissions are required' });
  }
  
  const id = 'role-' + uuidv4().slice(0, 8);
  const role = { id, name, description: description || '', permissions, color: color || '#6b7280' };
  roles.set(id, role);
  res.status(201).json(role);
});

// Update role
router.put('/config/roles/:id', (req: Request, res: Response) => {
  const role = roles.get(req.params.id);
  if (!role) {
    return res.status(404).json({ error: 'Role not found' });
  }
  
  const updated = { ...role, ...req.body, id: role.id };
  roles.set(role.id, updated);
  res.json(updated);
});

// Delete role
router.delete('/config/roles/:id', (req: Request, res: Response) => {
  if (!roles.has(req.params.id)) {
    return res.status(404).json({ error: 'Role not found' });
  }
  
  // Check if any agents use this role
  const agentsWithRole = Array.from(agents.values()).filter(a => a.roleId === req.params.id);
  if (agentsWithRole.length > 0) {
    return res.status(400).json({ error: 'Cannot delete role that is assigned to agents' });
  }
  
  roles.delete(req.params.id);
  res.json({ success: true });
});

// ============ DESIGNATIONS ROUTES ============

// Get all designations
router.get('/config/designations', (req: Request, res: Response) => {
  res.json(Array.from(designations.values()));
});

// Create designation
router.post('/config/designations', (req: Request, res: Response) => {
  const { name, department, level } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }
  
  const id = 'des-' + uuidv4().slice(0, 8);
  const designation = { id, name, department: department || 'Support', level: level || 5 };
  designations.set(id, designation);
  res.status(201).json(designation);
});

// Update designation
router.put('/config/designations/:id', (req: Request, res: Response) => {
  const designation = designations.get(req.params.id);
  if (!designation) {
    return res.status(404).json({ error: 'Designation not found' });
  }
  
  const updated = { ...designation, ...req.body, id: designation.id };
  designations.set(designation.id, updated);
  res.json(updated);
});

// Delete designation
router.delete('/config/designations/:id', (req: Request, res: Response) => {
  if (!designations.has(req.params.id)) {
    return res.status(404).json({ error: 'Designation not found' });
  }
  
  // Check if any agents use this designation
  const agentsWithDes = Array.from(agents.values()).filter(a => a.designationId === req.params.id);
  if (agentsWithDes.length > 0) {
    return res.status(400).json({ error: 'Cannot delete designation that is assigned to agents' });
  }
  
  designations.delete(req.params.id);
  res.json({ success: true });
});

// ============ PERMISSIONS ROUTES ============

// Get all available permissions
router.get('/config/permissions', (req: Request, res: Response) => {
  res.json(allPermissions);
});

export default router;
