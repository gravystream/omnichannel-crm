import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { resolutionsApi } from '../services/api';
import type { Resolution, ResolutionPriority, ResolutionStatus } from '../types';

const priorityConfig: Record<ResolutionPriority, { color: string; bg: string; label: string }> = {
  P0: { color: 'text-red-700', bg: 'bg-red-100', label: 'Critical' },
  P1: { color: 'text-orange-700', bg: 'bg-orange-100', label: 'High' },
  P2: { color: 'text-yellow-700', bg: 'bg-yellow-100', label: 'Medium' },
  P3: { color: 'text-gray-700', bg: 'bg-gray-100', label: 'Low' },
};

const statusConfig: Record<ResolutionStatus, { icon: React.ComponentType<{ className?: string }>; color: string; bg: string }> = {
  investigating: { icon: MagnifyingGlassIcon, color: 'text-purple-700', bg: 'bg-purple-100' },
  identified: { icon: ExclamationTriangleIcon, color: 'text-orange-700', bg: 'bg-orange-100' },
  in_progress: { icon: ArrowPathIcon, color: 'text-blue-700', bg: 'bg-blue-100' },
  resolved: { icon: CheckCircleIcon, color: 'text-green-700', bg: 'bg-green-100' },
  closed: { icon: CheckCircleIcon, color: 'text-gray-700', bg: 'bg-gray-100' },
};

export const ResolutionsPage: React.FC = () => {
  const navigate = useNavigate();
  const [resolutions, setResolutions] = useState<Resolution[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterPriority, setFilterPriority] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    fetchResolutions();
  }, [filterStatus, filterPriority]);

  const fetchResolutions = async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = {};
      if (filterStatus) params.status = filterStatus;
      if (filterPriority) params.priority = filterPriority;

      const response = await resolutionsApi.list(params);
      if (response.success && response.data) {
        setResolutions(response.data);
      } else {
        setResolutions(mockResolutions);
      }
    } catch (error) {
      setResolutions(mockResolutions);
    } finally {
      setLoading(false);
    }
  };

  const filteredResolutions = resolutions.filter(res => {
    if (searchQuery) {
      const search = searchQuery.toLowerCase();
      return res.title.toLowerCase().includes(search) || res.description.toLowerCase().includes(search);
    }
    return true;
  });

  const activeResolutions = filteredResolutions.filter(r => !['resolved', 'closed'].includes(r.status));
  const resolvedResolutions = filteredResolutions.filter(r => ['resolved', 'closed'].includes(r.status));

  const openResolution = (res: Resolution) => {
    navigate(`/resolutions/${res.id}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Resolutions</h1>
          <p className="text-gray-500 mt-1">Track and manage complex customer issues</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center gap-2"
        >
          <PlusIcon className="w-5 h-5" />
          New Resolution
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {(['P0', 'P1', 'P2', 'P3'] as ResolutionPriority[]).map(priority => {
          const count = activeResolutions.filter(r => r.priority === priority).length;
          const config = priorityConfig[priority];
          return (
            <div
              key={priority}
              className={`${config.bg} rounded-xl p-4 border border-${config.color.replace('text-', '')}-200`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-sm font-medium ${config.color}`}>{priority} - {config.label}</span>
                <span className={`text-2xl font-bold ${config.color}`}>{count}</span>
              </div>
              <p className="text-xs text-gray-600 mt-1">Active issues</p>
            </div>
          );
        })}
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search resolutions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="border border-gray-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary-500"
        >
          <option value="">All Statuses</option>
          <option value="investigating">Investigating</option>
          <option value="identified">Identified</option>
          <option value="in_progress">In Progress</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
          className="border border-gray-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary-500"
        >
          <option value="">All Priorities</option>
          <option value="P0">P0 - Critical</option>
          <option value="P1">P1 - High</option>
          <option value="P2">P2 - Medium</option>
          <option value="P3">P3 - Low</option>
        </select>
      </div>

      {/* Active Resolutions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Active Resolutions ({activeResolutions.length})</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading...</div>
          ) : activeResolutions.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No active resolutions</div>
          ) : (
            activeResolutions.map(res => {
              const StatusIcon = statusConfig[res.status].icon;
              return (
                <div
                  key={res.id}
                  onClick={() => openResolution(res)}
                  className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <span className={`px-2 py-1 text-xs font-bold rounded ${priorityConfig[res.priority].bg} ${priorityConfig[res.priority].color}`}>
                        {res.priority}
                      </span>
                      <div>
                        <h3 className="font-medium text-gray-900">{res.title}</h3>
                        <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{res.description}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <StatusIcon className={`w-4 h-4 ${statusConfig[res.status].color}`} />
                            <span className="capitalize">{res.status.replace('_', ' ')}</span>
                          </span>
                          {res.eta && (
                            <span className="flex items-center gap-1">
                              <ClockIcon className="w-4 h-4" />
                              ETA: {new Date(res.eta).toLocaleDateString()}
                            </span>
                          )}
                          <span>{res.category}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">
                        {new Date(res.updatedAt).toLocaleDateString()}
                      </p>
                      {res.assignedTo && (
                        <p className="text-xs text-gray-400 mt-1">
                          Assigned: {res.assignedTo}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Resolved Resolutions */}
      {resolvedResolutions.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Recently Resolved ({resolvedResolutions.length})</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {resolvedResolutions.slice(0, 5).map(res => (
              <div
                key={res.id}
                onClick={() => openResolution(res)}
                className="p-4 hover:bg-gray-50 cursor-pointer transition-colors opacity-75"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircleIcon className="w-5 h-5 text-green-500" />
                    <div>
                      <h3 className="font-medium text-gray-700">{res.title}</h3>
                      <p className="text-xs text-gray-500">
                        Resolved {res.resolvedAt && new Date(res.resolvedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded ${priorityConfig[res.priority].bg} ${priorityConfig[res.priority].color}`}>
                    {res.priority}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <CreateResolutionModal
          onClose={() => setShowCreateModal(false)}
          onCreated={(newRes) => {
            setResolutions([newRes, ...resolutions]);
            setShowCreateModal(false);
          }}
        />
      )}
    </div>
  );
};

// Create Resolution Modal
interface CreateModalProps {
  onClose: () => void;
  onCreated: (resolution: Resolution) => void;
}

const CreateResolutionModal: React.FC<CreateModalProps> = ({ onClose, onCreated }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'P2' as ResolutionPriority,
    category: 'technical',
  });
  const [creating, setCreating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);

    try {
      const response = await resolutionsApi.create({
        ...formData,
        conversationId: '',
        customerId: '',
      });
      if (response.success && response.data) {
        onCreated(response.data);
      } else {
        // Mock create
        onCreated({
          id: `res_${Date.now()}`,
          conversationId: '',
          customerId: '',
          ...formData,
          status: 'investigating',
          updates: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      // Mock create
      onCreated({
        id: `res_${Date.now()}`,
        conversationId: '',
        customerId: '',
        ...formData,
        status: 'investigating',
        updates: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Create Resolution</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500"
              placeholder="Brief description of the issue"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              required
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500"
              placeholder="Detailed description..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value as ResolutionPriority })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500"
              >
                <option value="P0">P0 - Critical</option>
                <option value="P1">P1 - High</option>
                <option value="P2">P2 - Medium</option>
                <option value="P3">P3 - Low</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500"
              >
                <option value="technical">Technical</option>
                <option value="billing">Billing</option>
                <option value="account">Account</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create Resolution'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Mock data
const mockResolutions: Resolution[] = [
  {
    id: 'res_1', conversationId: 'conv_1', customerId: 'cust_1',
    title: 'Payment processing system failure',
    description: 'Multiple customers reporting failed transactions during checkout. Affecting approximately 15% of all orders.',
    priority: 'P0', status: 'in_progress', category: 'technical',
    eta: new Date(Date.now() + 7200000).toISOString(),
    assignedTeam: 'Engineering', assignedTo: 'John Doe',
    updates: [], createdAt: new Date(Date.now() - 7200000).toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: 'res_2', conversationId: 'conv_2', customerId: 'cust_2',
    title: 'Email notifications not sending',
    description: 'Order confirmation and shipping notification emails are delayed or not sending.',
    priority: 'P1', status: 'investigating', category: 'technical',
    assignedTeam: 'Engineering', assignedTo: 'Jane Smith',
    updates: [], createdAt: new Date(Date.now() - 86400000).toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: 'res_3', conversationId: 'conv_3', customerId: 'cust_3',
    title: 'Incorrect billing on enterprise accounts',
    description: 'Several enterprise customers were overbilled for the last billing cycle.',
    priority: 'P1', status: 'identified', category: 'billing',
    assignedTeam: 'Finance', assignedTo: 'Mike Johnson',
    updates: [], createdAt: new Date(Date.now() - 172800000).toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: 'res_4', conversationId: 'conv_4', customerId: 'cust_4',
    title: 'Mobile app login issues',
    description: 'Users on iOS 17 experiencing repeated logout issues.',
    priority: 'P2', status: 'resolved', category: 'technical',
    resolution: 'Fixed authentication token refresh logic',
    updates: [], createdAt: new Date(Date.now() - 604800000).toISOString(), updatedAt: new Date().toISOString(),
    resolvedAt: new Date(Date.now() - 172800000).toISOString(),
  },
];

export default ResolutionsPage;
