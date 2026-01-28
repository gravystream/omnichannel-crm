import React, { useState, useEffect } from 'react';
import api from '../services/api';

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
  const [activeTab, setActiveTab] = useState<'agents' | 'roles' | 'designations'>('agents');
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

  const [agentForm, setAgentForm] = useState({
    name: '', email: '', phone: '', roleId: '', designationId: '', department: 'Support', skills: '', maxChats: 5
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
      const [agentsRes, rolesRes, desRes, permsRes] = await Promise.all([
        api.get('/api/v1/agents'),
        api.get('/api/v1/agents/config/roles'),
        api.get('/api/v1/agents/config/designations'),
        api.get('/api/v1/agents/config/permissions')
      ]);
      setAgents(agentsRes.data);
      setRoles(rolesRes.data);
      setDesignations(desRes.data);
      setPermissions(permsRes.data);
    } catch (err) {
      console.error('Error fetching data:', err);
    }
    setLoading(false);
  };

  const handleSaveAgent = async () => {
    try {
      const data = {
        ...agentForm,
        skills: agentForm.skills.split(',').map(s => s.trim()).filter(Boolean)
      };
      if (editingAgent) {
        await api.put('/api/v1/agents/' + editingAgent.id, data);
      } else {
        await api.post('/api/v1/agents', data);
      }
      fetchData();
      setShowAgentModal(false);
      resetAgentForm();
    } catch (err) {
      console.error('Error saving agent:', err);
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
    setAgentForm({ name: '', email: '', phone: '', roleId: '', designationId: '', department: 'Support', skills: '', maxChats: 5 });
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

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="text-gray-500">Loading...</div></div>;
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-2">Administration</h1>
      <p className="text-gray-600 mb-6">Manage agents, roles, and designations</p>

      <div className="border-b border-gray-200 mb-6">
        <nav className="flex space-x-8">
          {['agents', 'roles', 'designations'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={'py-3 px-1 border-b-2 font-medium text-sm ' + 
                (activeTab === tab 
                  ? 'border-blue-500 text-blue-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700')}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              <span className="ml-2 bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">
                {tab === 'agents' ? agents.length : tab === 'roles' ? roles.length : designations.length}
              </span>
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
    </div>
  );
};

export default AdminPage;
