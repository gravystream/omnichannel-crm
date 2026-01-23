import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowsUpDownIcon,
  EyeIcon,
  UserPlusIcon,
  TagIcon,
} from '@heroicons/react/24/outline';
import { conversationsApi } from '../services/api';
import type { Conversation } from '../types';

const channelIcons: Record<string, string> = {
  web_chat: '💬',
  email: '📧',
  whatsapp: '📱',
  sms: '📲',
  voice: '📞',
};

const statusColors: Record<string, string> = {
  open: 'bg-green-100 text-green-800',
  pending: 'bg-yellow-100 text-yellow-800',
  resolved: 'bg-blue-100 text-blue-800',
  closed: 'bg-gray-100 text-gray-800',
};

const priorityColors: Record<string, string> = {
  urgent: 'bg-red-100 text-red-800',
  high: 'bg-orange-100 text-orange-800',
  normal: 'bg-blue-100 text-blue-800',
  low: 'bg-gray-100 text-gray-800',
};

export const ConversationsPage: React.FC = () => {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: '',
    channel: '',
    priority: '',
    search: '',
  });
  const [sortBy, setSortBy] = useState<'recent' | 'priority' | 'oldest'>('recent');
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchConversations();
  }, [filters, sortBy, page]);

  const fetchConversations = async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page, limit: 20 };
      if (filters.status) params.status = filters.status;
      if (filters.channel) params.channel = filters.channel;

      const response = await conversationsApi.list(params);
      if (response.success && response.data) {
        setConversations(response.data);
      } else {
        setConversations(mockConversations);
      }
    } catch (error) {
      setConversations(mockConversations);
    } finally {
      setLoading(false);
    }
  };

  const filteredConversations = conversations
    .filter(conv => {
      if (filters.search) {
        const search = filters.search.toLowerCase();
        return (
          conv.subject?.toLowerCase().includes(search) ||
          conv.tags.some(t => t.toLowerCase().includes(search))
        );
      }
      return true;
    })
    .filter(conv => !filters.priority || conv.priority === filters.priority)
    .sort((a, b) => {
      if (sortBy === 'recent') return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
      if (sortBy === 'oldest') return new Date(a.lastMessageAt).getTime() - new Date(b.lastMessageAt).getTime();
      if (sortBy === 'priority') {
        const order = { urgent: 0, high: 1, normal: 2, low: 3 };
        return order[a.priority] - order[b.priority];
      }
      return 0;
    });

  const openConversation = (conv: Conversation) => {
    navigate(`/inbox/${conv.id}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Conversations</h1>
          <p className="text-gray-500 mt-1">Manage all customer conversations</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-2 border rounded-lg flex items-center gap-2 ${
              showFilters ? 'bg-primary-50 border-primary-200 text-primary-700' : 'border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <FunnelIcon className="w-5 h-5" />
            Filters
          </button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500"
              >
                <option value="">All Statuses</option>
                <option value="open">Open</option>
                <option value="pending">Pending</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Channel</label>
              <select
                value={filters.channel}
                onChange={(e) => setFilters({ ...filters, channel: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500"
              >
                <option value="">All Channels</option>
                <option value="email">Email</option>
                <option value="web_chat">Web Chat</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="sms">SMS</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <select
                value={filters.priority}
                onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500"
              >
                <option value="">All Priorities</option>
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="normal">Normal</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500"
              >
                <option value="recent">Most Recent</option>
                <option value="oldest">Oldest First</option>
                <option value="priority">Priority</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search conversations by subject or tags..."
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Subject</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Channel</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Priority</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Assigned</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Last Activity</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    Loading conversations...
                  </td>
                </tr>
              ) : filteredConversations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    No conversations found
                  </td>
                </tr>
              ) : (
                filteredConversations.map((conv) => (
                  <tr key={conv.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => openConversation(conv)}>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-900">{conv.subject || 'No subject'}</p>
                        <div className="flex gap-1 mt-1">
                          {conv.tags.slice(0, 3).map((tag) => (
                            <span key={tag} className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1 text-sm">
                        <span>{channelIcons[conv.channel] || '💬'}</span>
                        <span className="capitalize">{conv.channel.replace('_', ' ')}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[conv.status]}`}>
                        {conv.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${priorityColors[conv.priority]}`}>
                        {conv.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {conv.assignedAgent?.name || conv.assignedTo || 'Unassigned'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(conv.lastMessageAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); openConversation(conv); }}
                          className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg"
                          title="View"
                        >
                          <EyeIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => e.stopPropagation()}
                          className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg"
                          title="Assign"
                        >
                          <UserPlusIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => e.stopPropagation()}
                          className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg"
                          title="Add Tag"
                        >
                          <TagIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Showing {filteredConversations.length} conversations
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(p => p + 1)}
              className="px-3 py-1 border border-gray-200 rounded-lg text-sm hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Mock data
const mockConversations: Conversation[] = [
  {
    id: 'conv_1', customerId: 'cust_1', channel: 'email', status: 'open', priority: 'high',
    subject: 'Refund not processed after 5 days', tags: ['billing', 'refund'],
    lastMessageAt: new Date(Date.now() - 300000).toISOString(), messageCount: 8,
    createdAt: new Date(Date.now() - 86400000).toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: 'conv_2', customerId: 'cust_2', channel: 'web_chat', status: 'pending', priority: 'normal',
    subject: 'Cannot access premium features', tags: ['technical', 'access'],
    lastMessageAt: new Date(Date.now() - 600000).toISOString(), messageCount: 4,
    createdAt: new Date(Date.now() - 43200000).toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: 'conv_3', customerId: 'cust_3', channel: 'whatsapp', status: 'open', priority: 'urgent',
    subject: 'Service completely down', tags: ['outage', 'p0'],
    lastMessageAt: new Date(Date.now() - 60000).toISOString(), messageCount: 15,
    createdAt: new Date(Date.now() - 7200000).toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: 'conv_4', customerId: 'cust_4', channel: 'email', status: 'resolved', priority: 'low',
    subject: 'Question about pricing plans', tags: ['sales'],
    lastMessageAt: new Date(Date.now() - 172800000).toISOString(), messageCount: 3,
    createdAt: new Date(Date.now() - 259200000).toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: 'conv_5', customerId: 'cust_5', channel: 'sms', status: 'open', priority: 'normal',
    subject: 'Delivery tracking request', tags: ['shipping'],
    lastMessageAt: new Date(Date.now() - 1800000).toISOString(), messageCount: 6,
    createdAt: new Date(Date.now() - 14400000).toISOString(), updatedAt: new Date().toISOString(),
  },
];

export default ConversationsPage;
