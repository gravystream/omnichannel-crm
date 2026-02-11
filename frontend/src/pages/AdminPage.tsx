import React, { useState, useEffect } from 'react';
import api from '../services/api';
import type { Team, SLAConfig, AutomationRule, SystemSettings } from '../types';
import { adminApi } from '../services/adminApi';

interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  color: string;
}

interface Designation {
  id: string;
  name: string;
  department: string;
  level: number;
}

interface Agent {
  id: string;
  name: string;
  email: string;
  phone: string;
  roleId: string;
  designationId: string;
  status: 'online' | 'away' | 'offline';
  avatar: string;
  department: string;
  joinedAt: string;
  skills: string[];
  maxChats: number;
  role?: Role;
  designation?: Designation;
}

interface Permission {
  id: string;
  name: string;
  description: string;
}

const AdminPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('agents');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAgentModal, setShowAgentModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showDesignationModal, setShowDesignationModal] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [editingDesignation, setEditingDesignation] = useState<Designation | null>(null);

  // New tab states
  const [teams, setTeams] = useState<Team[]>([]);
  const [slaConfigs, setSlaConfigs] = useState<SLAConfig[]>([]);
  const [automationRules, setAutomationRules] = useState<AutomationRule[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);

  // Team modal states
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [teamForm, setTeamForm] = useState({
    name: '', description: '', skills: '', isEscalationTeam: false
  });

  // SLA modal states
  const [showSlaModal, setShowSlaModal] = useState(false);
  const [editingSla, setEditingSla] = useState<SLAConfig | null>(null);

  // Automation modal states
  const [showAutomationModal, setShowAutomationModal] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState<AutomationRule | null>(null);

  const [agentForm, setAgentForm] = useState({
    name: '', email: '', phone: '', roleId: '', designationId: '', department: 'Support', skills: '', maxChats: 5, password: '', confirmPassword: ''
  });

  const [roleForm, setRoleForm] = useState({
    name: '', description: '', permissions: [] as string[], color: '#6b7280'
  });

  const [designationForm, setDesignationForm] = useState({
    name: '', department: 'Support', level: 5
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [agentsRes, rolesRes, desRes, permsRes, teamsRes, slaRes, rulesRes, settingsRes] = await Promise.all([
        api.get('/agents'),
        api.get('/agents/config/roles'),
        api.get('/agents/config/designations'),
        api.get('/agents/config/permissions'),
        adminApi.getTeams(),
        adminApi.getSLAConfigs(),
        adminApi.getAutomationRules(),
        adminApi.getSettings()
      ]);

      setAgents(agentsRes.data);
      setRoles(rolesRes.data);
      setDesignations(desRes.data);
      setPermissions(permsRes.data);

      if (teamsRes.success && teamsRes.data) setTeams(teamsRes.data);
      if (slaRes.success && slaRes.data) setSlaConfigs(slaRes.data);
      if (rulesRes.success && rulesRes.data) setAutomationRules(rulesRes.data);
      if (settingsRes.success && settingsRes.data) setSettings(settingsRes.data);
    } catch (err) {
      console.error('Error fetching data:', err);
    }
    setLoading(false);
  };

  const handleSaveAgent = async () => {
    try {
      // Validation for new agents
      if (!editingAgent) {
        if (!agentForm.password || !agentForm.confirmPassword) {
          alert('Password is required for new agents');
          return;
        }
        if (agentForm.password !== agentForm.confirmPassword) {
          alert('Passwords do not match');
          return;
        }
        if (agentForm.password.length < 8) {
          alert('Password must be at least 8 characters long');
          return;
        }
      }

      const data = {
        ...agentForm,
        skills: agentForm.skills.split(',').map(s => s.trim()).filter(Boolean)
      };

      if (editingAgent) {
        await api.put('/agents/' + editingAgent.id, data);
      } else {
        // Create agent profile
        const agentResponse = await api.post('/agents', data);

        // Create login credentials (register user)
        const [firstName, ...lastNameParts] = agentForm.name.split(' ');
        const lastName = lastNameParts.join(' ') || firstName;

        try {
          await api.post('/auth/register', {
            email: agentForm.email,
            password: agentForm.password,
            firstName,
            lastName,
            role: 'agent', // Default role for agents
            skills: agentForm.skills.split(',').map(s => s.trim()).filter(Boolean)
          });
          alert('Agent created successfully! They can now log in with their email and password.');
        } catch (regErr: any) {
          console.error('Registration error:', regErr);
          if (regErr.response?.data?.error?.code === 'USER_EXISTS') {
            alert('Agent profile created, but user account already exists. The agent can use their existing login credentials.');
          } else {
            alert('Agent profile created, but failed to create login credentials. Please create them manually or contact administrator.');
          }
        }
      }

      fetchData();
      setShowAgentModal(false);
      resetAgentForm();
    } catch (err: any) {
      console.error('Error saving agent:', err);
      alert('Error saving agent: ' + (err.response?.data?.error?.message || err.message || 'Unknown error'));
    }
  };

  const handleDeleteAgent = async (id: string) => {
    if (!confirm('Are you sure you want to delete this agent?')) return;
    try {
      await api.delete('/api/v1/agents/' + id);
      fetchData();
    } catch (err) {
      console.error('Error deleting agent:', err);
    }
  };

  const handleSaveRole = async () => {
    try {
      if (editingRole) {
        await api.put('/api/v1/agents/config/roles/' + editingRole.id, roleForm);
      } else {
        await api.post('/api/v1/agents/config/roles', roleForm);
      }
      fetchData();
      setShowRoleModal(false);
      resetRoleForm();
    } catch (err) {
      console.error('Error saving role:', err);
    }
  };

  const handleDeleteRole = async (id: string) => {
    if (!confirm('Are you sure you want to delete this role?')) return;
    try {
      await api.delete('/api/v1/agents/config/roles/' + id);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error deleting role');
    }
  };

  const handleSaveDesignation = async () => {
    try {
      if (editingDesignation) {
        await api.put('/api/v1/agents/config/designations/' + editingDesignation.id, designationForm);
      } else {
        await api.post('/api/v1/agents/config/designations', designationForm);
      }
      fetchData();
      setShowDesignationModal(false);
      resetDesignationForm();
    } catch (err) {
      console.error('Error saving designation:', err);
    }
  };

  const handleDeleteDesignation = async (id: string) => {
    if (!confirm('Are you sure you want to delete this designation?')) return;
    try {
      await api.delete('/api/v1/agents/config/designations/' + id);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error deleting designation');
    }
  };

  const resetAgentForm = () => {
    setAgentForm({ name: '', email: '', phone: '', roleId: '', designationId: '', department: 'Support', skills: '', maxChats: 5, password: '', confirmPassword: '' });
    setEditingAgent(null);
  };

  const resetRoleForm = () => {
    setRoleForm({ name: '', description: '', permissions: [], color: '#6b7280' });
    setEditingRole(null);
  };

  const resetDesignationForm = () => {
    setDesignationForm({ name: '', department: 'Support', level: 5 });
    setEditingDesignation(null);
  };

  const openEditAgent = (agent: Agent) => {
    setEditingAgent(agent);
    setAgentForm({
      name: agent.name,
      email: agent.email,
      phone: agent.phone,
      roleId: agent.roleId,
      designationId: agent.designationId,
      department: agent.department,
      skills: agent.skills.join(', '),
      maxChats: agent.maxChats
    });
    setShowAgentModal(true);
  };

  const openEditRole = (role: Role) => {
    setEditingRole(role);
    setRoleForm({
      name: role.name,
      description: role.description,
      permissions: role.permissions,
      color: role.color
    });
    setShowRoleModal(true);
  };

  const openEditDesignation = (des: Designation) => {
    setEditingDesignation(des);
    setDesignationForm({
      name: des.name,
      department: des.department,
      level: des.level
    });
    setShowDesignationModal(true);
  };

  const togglePermission = (permId: string) => {
    setRoleForm(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permId)
        ? prev.permissions.filter(p => p !== permId)
        : [...prev.permissions, permId]
    }));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'away': return 'bg-yellow-500';
      default: return 'bg-gray-400';
    }
  };

  // Team handlers
  const handleSaveTeam = async () => {
    try {
      const data = {
        name: teamForm.name,
        description: teamForm.description,
        skills: teamForm.skills.split(',').map(s => s.trim()).filter(Boolean),
        isEscalationTeam: teamForm.isEscalationTeam
      };
      if (editingTeam) {
        await adminApi.updateTeam(editingTeam.id, data);
      } else {
        await adminApi.createTeam(data);
      }
      fetchData();
      setShowTeamModal(false);
      resetTeamForm();
    } catch (err) {
      console.error('Error saving team:', err);
    }
  };

  const handleDeleteTeam = async (id: string) => {
    if (!confirm('Are you sure you want to delete this team?')) return;
    try {
      await adminApi.deleteTeam(id);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Error deleting team');
    }
  };

  const openEditTeam = (team: Team) => {
    setEditingTeam(team);
    setTeamForm({
      name: team.name,
      description: team.description || '',
      skills: team.skills.join(', '),
      isEscalationTeam: team.isEscalationTeam
    });
    setShowTeamModal(true);
  };

  const resetTeamForm = () => {
    setTeamForm({ name: '', description: '', skills: '', isEscalationTeam: false });
    setEditingTeam(null);
  };

  // SLA handlers
  const handleSaveSLA = async (sla: SLAConfig) => {
    try {
      await adminApi.updateSLAConfig(sla.priority, {
        firstResponseMinutes: sla.firstResponseMinutes,
        resolutionMinutes: sla.resolutionMinutes,
        escalationMinutes: sla.escalationMinutes,
        businessHoursOnly: sla.businessHoursOnly,
        isActive: sla.isActive
      });
      fetchData();
      setShowSlaModal(false);
      setEditingSla(null);
    } catch (err) {
      console.error('Error saving SLA:', err);
    }
  };

  const openEditSla = (sla: SLAConfig) => {
    setEditingSla(sla);
    setShowSlaModal(true);
  };

  // Automation handlers
  const [automationForm, setAutomationForm] = useState({
    name: '', description: '', priority: 10, isActive: true,
    triggerEvent: 'message.received',
    conditions: [] as Array<{field: string; operator: string; value: string}>,
    actions: [] as Array<{type: string; config: Record<string, any>}>
  });

  const handleSaveAutomation = async () => {
    try {
      const data = {
        name: automationForm.name,
        description: automationForm.description,
        trigger: {
          event: automationForm.triggerEvent,
          conditions: automationForm.conditions
        },
        actions: automationForm.actions,
        priority: automationForm.priority,
        isActive: automationForm.isActive
      };
      if (editingAutomation) {
        await adminApi.updateAutomationRule(editingAutomation.id, data);
      } else {
        await adminApi.createAutomationRule(data);
      }
      fetchData();
      setShowAutomationModal(false);
      resetAutomationForm();
    } catch (err) {
      console.error('Error saving automation rule:', err);
    }
  };

  const handleDeleteAutomation = async (id: string) => {
    if (!confirm('Are you sure you want to delete this automation rule?')) return;
    try {
      await adminApi.deleteAutomationRule(id);
      fetchData();
    } catch (err) {
      console.error('Error deleting automation rule:', err);
    }
  };

  const openEditAutomation = (rule: AutomationRule) => {
    setEditingAutomation(rule);
    setAutomationForm({
      name: rule.name,
      description: rule.description || '',
      priority: rule.priority,
      isActive: rule.isActive,
      triggerEvent: rule.trigger.event,
      conditions: rule.trigger.conditions,
      actions: rule.actions
    });
    setShowAutomationModal(true);
  };

  const resetAutomationForm = () => {
    setAutomationForm({
      name: '', description: '', priority: 10, isActive: true,
      triggerEvent: 'message.received', conditions: [], actions: []
    });
    setEditingAutomation(null);
  };

  // Settings handler
  const handleSaveSettings = async () => {
    if (!settings) return;
    try {
      await adminApi.updateSettings(settings);
      fetchData();
      alert('Settings saved successfully!');
    } catch (err) {
      console.error('Error saving settings:', err);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="text-gray-500">Loading...</div></div>;
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-2">Administration</h1>
      <p className="text-gray-600 mb-6">Manage agents, roles, and designations</p>

      <div className="border-b border-gray-200 mb-6">
        <nav className="flex space-x-8">
          {[
            { id: 'agents', label: 'Agents', count: agents.length },
            { id: 'roles', label: 'Roles', count: roles.length },
            { id: 'designations', label: 'Designations', count: designations.length },
            { id: 'teams', label: 'Teams', count: teams.length },
            { id: 'sla', label: 'SLA Config', count: slaConfigs.length },
            { id: 'automation', label: 'Automation', count: automationRules.length },
            { id: 'settings', label: 'Settings', count: 0 }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={
                'py-3 px-1 border-b-2 font-medium text-sm ' +
                (activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300')
              }
            >
              {tab.label}
              {tab.count > 0 && (
                <span className="ml-2 bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Agents Tab */}
      {activeTab === 'agents' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Team Members</h2>
            <button
              onClick={() => { resetAgentForm(); setShowAgentModal(true); }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              + Add Agent
            </button>
          </div>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Agent</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Designation</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Skills</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {agents.map(agent => (
                  <tr key={agent.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold">
                          {agent.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{agent.name}</div>
                          <div className="text-sm text-gray-500">{agent.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs rounded-full text-white" style={{backgroundColor: agent.role?.color || '#6b7280'}}>
                        {agent.role?.name || 'No Role'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {agent.designation?.name || 'No Designation'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="flex items-center">
                        <span className={'w-2 h-2 rounded-full mr-2 ' + getStatusColor(agent.status)}></span>
                        <span className="text-sm text-gray-600 capitalize">{agent.status}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-wrap gap-1">
                        {agent.skills.slice(0,2).map(skill => (
                          <span key={skill} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">{skill}</span>
                        ))}
                        {agent.skills.length > 2 && <span className="text-xs text-gray-400">+{agent.skills.length - 2}</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <button onClick={() => openEditAgent(agent)} className="text-blue-600 hover:text-blue-800 mr-3">Edit</button>
                      <button onClick={() => handleDeleteAgent(agent.id)} className="text-red-600 hover:text-red-800">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Roles Tab */}
      {activeTab === 'roles' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Roles & Permissions</h2>
            <button
              onClick={() => { resetRoleForm(); setShowRoleModal(true); }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              + Add Role
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {roles.map(role => (
              <div key={role.id} className="bg-white rounded-lg shadow p-4 border-l-4" style={{borderLeftColor: role.color}}>
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold text-gray-800">{role.name}</h3>
                  <div>
                    <button onClick={() => openEditRole(role)} className="text-blue-600 hover:text-blue-800 text-sm mr-2">Edit</button>
                    <button onClick={() => handleDeleteRole(role.id)} className="text-red-600 hover:text-red-800 text-sm">Delete</button>
                  </div>
                </div>
                <p className="text-sm text-gray-500 mb-3">{role.description}</p>
                <div className="flex flex-wrap gap-1">
                  {role.permissions.slice(0,4).map(perm => (
                    <span key={perm} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">{perm}</span>
                  ))}
                  {role.permissions.length > 4 && <span className="text-xs text-gray-400">+{role.permissions.length - 4} more</span>}
                </div>
                <div className="mt-3 text-xs text-gray-400">
                  {agents.filter(a => a.roleId === role.id).length} agents assigned
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Designations Tab */}
      {activeTab === 'designations' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Designations</h2>
            <button
              onClick={() => { resetDesignationForm(); setShowDesignationModal(true); }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              + Add Designation
            </button>
          </div>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Designation</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Level</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Agents</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {designations.sort((a,b) => a.level - b.level).map(des => (
                  <tr key={des.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{des.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{des.department}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">Level {des.level}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {agents.filter(a => a.designationId === des.id).length} agents
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <button onClick={() => openEditDesignation(des)} className="text-blue-600 hover:text-blue-800 mr-3">Edit</button>
                      <button onClick={() => handleDeleteDesignation(des.id)} className="text-red-600 hover:text-red-800">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Agent Modal */}
      {showAgentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">{editingAgent ? 'Edit Agent' : 'Add New Agent'}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input type="text" value={agentForm.name} onChange={e => setAgentForm({...agentForm, name: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="Full name" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input type="email" value={agentForm.email} onChange={e => setAgentForm({...agentForm, email: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="email@example.com" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input type="tel" value={agentForm.phone} onChange={e => setAgentForm({...agentForm, phone: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="+1234567890" />
              </div>

              {!editingAgent && (
                <>
                  <div className="border-t border-gray-200 pt-4">
                    <p className="text-sm text-gray-600 mb-3">Set login credentials for this agent</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                    <input type="password" value={agentForm.password} onChange={e => setAgentForm({...agentForm, password: e.target.value})}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="Minimum 8 characters" />
                    <p className="text-xs text-gray-500 mt-1">Agent will use this to log in</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password *</label>
                    <input type="password" value={agentForm.confirmPassword} onChange={e => setAgentForm({...agentForm, confirmPassword: e.target.value})}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="Re-enter password" />
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
                <select value={agentForm.roleId} onChange={e => setAgentForm({...agentForm, roleId: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2">
                  <option value="">Select Role</option>
                  {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Designation</label>
                <select value={agentForm.designationId} onChange={e => setAgentForm({...agentForm, designationId: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2">
                  <option value="">Select Designation</option>
                  {designations.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                <input type="text" value={agentForm.department} onChange={e => setAgentForm({...agentForm, department: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="Support" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Skills (comma separated)</label>
                <input type="text" value={agentForm.skills} onChange={e => setAgentForm({...agentForm, skills: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="billing, technical, sales" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max Concurrent Chats</label>
                <input type="number" min="1" max="20" value={agentForm.maxChats} onChange={e => setAgentForm({...agentForm, maxChats: parseInt(e.target.value)})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => { setShowAgentModal(false); resetAgentForm(); }} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={handleSaveAgent} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                {editingAgent ? 'Save Changes' : 'Add Agent'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Role Modal */}
      {showRoleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">{editingRole ? 'Edit Role' : 'Add New Role'}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role Name *</label>
                <input type="text" value={roleForm.name} onChange={e => setRoleForm({...roleForm, name: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="e.g., Team Lead" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input type="text" value={roleForm.description} onChange={e => setRoleForm({...roleForm, description: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="Brief description" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                <input type="color" value={roleForm.color} onChange={e => setRoleForm({...roleForm, color: e.target.value})}
                  className="w-16 h-10 border border-gray-300 rounded cursor-pointer" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Permissions</label>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3">
                  {permissions.map(perm => (
                    <label key={perm.id} className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                      <input type="checkbox" checked={roleForm.permissions.includes(perm.id)} onChange={() => togglePermission(perm.id)}
                        className="rounded border-gray-300" />
                      <span className="text-sm text-gray-700">{perm.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => { setShowRoleModal(false); resetRoleForm(); }} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={handleSaveRole} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                {editingRole ? 'Save Changes' : 'Add Role'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Designation Modal */}
      {showDesignationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">{editingDesignation ? 'Edit Designation' : 'Add New Designation'}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Designation Name *</label>
                <input type="text" value={designationForm.name} onChange={e => setDesignationForm({...designationForm, name: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="e.g., Senior Support Agent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                <input type="text" value={designationForm.department} onChange={e => setDesignationForm({...designationForm, department: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="Support" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Level (1 = highest)</label>
                <input type="number" min="1" max="10" value={designationForm.level} onChange={e => setDesignationForm({...designationForm, level: parseInt(e.target.value)})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => { setShowDesignationModal(false); resetDesignationForm(); }} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={handleSaveDesignation} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                {editingDesignation ? 'Save Changes' : 'Add Designation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Teams Tab */}
      {activeTab === 'teams' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-800">Team Management</h2>
            <button onClick={() => { resetTeamForm(); setShowTeamModal(true); }} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
              + Add Team
            </button>
          </div>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Team Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Members</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Skills</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {teams.map(team => (
                  <tr key={team.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{team.name}</div>
                      {team.description && <div className="text-sm text-gray-500">{team.description}</div>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900">{team.memberIds.length} members</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {team.skills.slice(0, 3).map(skill => (
                          <span key={skill} className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">{skill}</span>
                        ))}
                        {team.skills.length > 3 && <span className="text-xs text-gray-400">+{team.skills.length - 3}</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {team.isEscalationTeam && (
                        <span className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded">Escalation</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <button onClick={() => openEditTeam(team)} className="text-blue-600 hover:text-blue-800 mr-3">Edit</button>
                      <button onClick={() => handleDeleteTeam(team.id)} className="text-red-600 hover:text-red-800">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {showTeamModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
                <h3 className="text-lg font-semibold mb-4">{editingTeam ? 'Edit Team' : 'Add New Team'}</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Team Name *</label>
                    <input type="text" value={teamForm.name} onChange={e => setTeamForm({...teamForm, name: e.target.value})}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="e.g., Technical Support" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea value={teamForm.description} onChange={e => setTeamForm({...teamForm, description: e.target.value})}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2" rows={3} placeholder="Team responsibilities..." />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Skills (comma-separated)</label>
                    <input type="text" value={teamForm.skills} onChange={e => setTeamForm({...teamForm, skills: e.target.value})}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="e.g., technical, backend, infrastructure" />
                  </div>
                  <div className="flex items-center">
                    <input type="checkbox" checked={teamForm.isEscalationTeam} onChange={e => setTeamForm({...teamForm, isEscalationTeam: e.target.checked})}
                      className="rounded border-gray-300 mr-2" />
                    <label className="text-sm text-gray-700">Escalation Team</label>
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-6">
                  <button onClick={() => { setShowTeamModal(false); resetTeamForm(); }} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                  <button onClick={handleSaveTeam} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    {editingTeam ? 'Save Changes' : 'Add Team'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SLA Tab */}
      {activeTab === 'sla' && (
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-4">SLA Configuration</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {slaConfigs.map(sla => {
              const priorityColors: Record<string, string> = {
                P0: '#ef4444', P1: '#f97316', P2: '#eab308', P3: '#10b981'
              };
              return (
                <div key={sla.id} className="bg-white rounded-lg shadow p-4 border-l-4" style={{borderLeftColor: priorityColors[sla.priority]}}>
                  <div className="flex justify-between items-start mb-3">
                    <div><h3 className="font-semibold text-gray-800">{sla.priority} - {sla.name}</h3></div>
                    <button onClick={() => openEditSla(sla)} className="text-blue-600 hover:text-blue-800 text-sm">Edit</button>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">First Response:</span>
                      <span className="font-medium">{sla.firstResponseMinutes}m</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Resolution:</span>
                      <span className="font-medium">{sla.resolutionMinutes}m</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Escalation:</span>
                      <span className="font-medium">{sla.escalationMinutes}m</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Business Hours Only:</span>
                      <span className={sla.businessHoursOnly ? 'text-green-600' : 'text-gray-400'}>
                        {sla.businessHoursOnly ? 'Yes' : 'No'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {showSlaModal && editingSla && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 w-full max-w-md">
                <h3 className="text-lg font-semibold mb-4">Edit SLA - {editingSla.priority}</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">First Response (minutes)</label>
                    <input type="number" value={editingSla.firstResponseMinutes}
                      onChange={e => setEditingSla({...editingSla, firstResponseMinutes: Number(e.target.value)})}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Resolution (minutes)</label>
                    <input type="number" value={editingSla.resolutionMinutes}
                      onChange={e => setEditingSla({...editingSla, resolutionMinutes: Number(e.target.value)})}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Escalation (minutes)</label>
                    <input type="number" value={editingSla.escalationMinutes}
                      onChange={e => setEditingSla({...editingSla, escalationMinutes: Number(e.target.value)})}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2" />
                  </div>
                  <div className="flex items-center">
                    <input type="checkbox" checked={editingSla.businessHoursOnly}
                      onChange={e => setEditingSla({...editingSla, businessHoursOnly: e.target.checked})}
                      className="rounded border-gray-300 mr-2" />
                    <label className="text-sm text-gray-700">Business Hours Only</label>
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-6">
                  <button onClick={() => { setShowSlaModal(false); setEditingSla(null); }} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                  <button onClick={() => handleSaveSLA(editingSla)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save Changes</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Automation Tab */}
      {activeTab === 'automation' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-800">Automation Rules</h2>
            <button onClick={() => { resetAutomationForm(); setShowAutomationModal(true); }} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              + Add Rule
            </button>
          </div>
          <div className="space-y-3">
            {automationRules.map(rule => (
              <div key={rule.id} className="bg-white rounded-lg shadow p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-gray-800">{rule.name}</h3>
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">Priority: {rule.priority}</span>
                      <span className={`px-2 py-0.5 text-xs rounded ${rule.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {rule.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{rule.description}</p>
                    <div className="text-xs text-gray-500">
                      Trigger: <code className="bg-gray-100 px-1 rounded">{rule.trigger.event}</code> |
                      {rule.trigger.conditions.length} conditions | {rule.actions.length} actions
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => openEditAutomation(rule)} className="text-blue-600 hover:text-blue-800 text-sm">Edit</button>
                    <button onClick={() => handleDeleteAutomation(rule.id)} className="text-red-600 hover:text-red-800 text-sm">Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {showAutomationModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <h3 className="text-lg font-semibold mb-4">{editingAutomation ? 'Edit Rule' : 'Add Automation Rule'}</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Rule Name *</label>
                    <input type="text" value={automationForm.name} onChange={e => setAutomationForm({...automationForm, name: e.target.value})}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea value={automationForm.description} onChange={e => setAutomationForm({...automationForm, description: e.target.value})}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2" rows={2} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                      <input type="number" value={automationForm.priority} onChange={e => setAutomationForm({...automationForm, priority: Number(e.target.value)})}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Trigger Event</label>
                      <select value={automationForm.triggerEvent} onChange={e => setAutomationForm({...automationForm, triggerEvent: e.target.value})}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2">
                        <option value="message.received">Message Received</option>
                        <option value="conversation.classified">Conversation Classified</option>
                        <option value="conversation.created">Conversation Created</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <input type="checkbox" checked={automationForm.isActive} onChange={e => setAutomationForm({...automationForm, isActive: e.target.checked})}
                      className="rounded border-gray-300 mr-2" />
                    <label className="text-sm text-gray-700">Active</label>
                  </div>
                  <p className="text-sm text-gray-500">Note: Condition and action configuration can be added in a future update</p>
                </div>
                <div className="flex justify-end gap-2 mt-6">
                  <button onClick={() => { setShowAutomationModal(false); resetAutomationForm(); }} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                  <button onClick={handleSaveAutomation} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    {editingAutomation ? 'Save Changes' : 'Add Rule'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && settings && (
        <div className="max-w-2xl">
          <h2 className="text-lg font-semibold text-gray-800 mb-6">System Settings</h2>
          <div className="bg-white rounded-lg shadow p-6 space-y-6">
            <div className="border-b pb-6">
              <h3 className="font-medium text-gray-900 mb-4">General Settings</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Company Name</label>
                  <input type="text" value={settings.general.companyName}
                    onChange={e => setSettings({...settings, general: {...settings.general, companyName: e.target.value}})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Support Email</label>
                  <input type="email" value={settings.general.supportEmail}
                    onChange={e => setSettings({...settings, general: {...settings.general, supportEmail: e.target.value}})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
              </div>
            </div>

            <div className="border-b pb-6">
              <h3 className="font-medium text-gray-900 mb-4">AI Configuration</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Provider</label>
                    <input type="text" value={settings.ai.provider}
                      onChange={e => setSettings({...settings, ai: {...settings.ai, provider: e.target.value}})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Model</label>
                    <input type="text" value={settings.ai.model}
                      onChange={e => setSettings({...settings, ai: {...settings.ai, model: e.target.value}})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Confidence Threshold</label>
                  <input type="number" step="0.01" min="0" max="1" value={settings.ai.confidenceThreshold}
                    onChange={e => setSettings({...settings, ai: {...settings.ai, confidenceThreshold: Number(e.target.value)}})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">Auto-Classify Enabled</span>
                    <input type="checkbox" checked={settings.ai.autoClassifyEnabled}
                      onChange={e => setSettings({...settings, ai: {...settings.ai, autoClassifyEnabled: e.target.checked}})}
                      className="rounded border-gray-300" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">Auto-Deflect Enabled</span>
                    <input type="checkbox" checked={settings.ai.autoDeflectEnabled}
                      onChange={e => setSettings({...settings, ai: {...settings.ai, autoDeflectEnabled: e.target.checked}})}
                      className="rounded border-gray-300" />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button onClick={handleSaveSettings} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPage;
