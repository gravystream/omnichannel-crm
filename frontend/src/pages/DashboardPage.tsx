import React, { useEffect, useState } from 'react';
import {
  ChatBubbleLeftRightIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  UserGroupIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
} from '@heroicons/react/24/outline';
import { analyticsApi, conversationsApi } from '../services/api';
import type { Conversation, AnalyticsMetrics } from '../types';

interface StatCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, change, icon: Icon, color }) => (
  <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-gray-500 font-medium">{title}</p>
        <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
        {change !== undefined && (
          <div className={`flex items-center mt-2 text-sm ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {change >= 0 ? (
              <ArrowTrendingUpIcon className="w-4 h-4 mr-1" />
            ) : (
              <ArrowTrendingDownIcon className="w-4 h-4 mr-1" />
            )}
            <span>{Math.abs(change)}% vs last week</span>
          </div>
        )}
      </div>
      <div className={`p-4 rounded-xl ${color}`}>
        <Icon className="w-8 h-8 text-white" />
      </div>
    </div>
  </div>
);

const priorityColors: Record<string, string> = {
  urgent: 'bg-red-100 text-red-800',
  high: 'bg-orange-100 text-orange-800',
  normal: 'bg-blue-100 text-blue-800',
  low: 'bg-gray-100 text-gray-800',
};

const channelIcons: Record<string, string> = {
  web_chat: '💬',
  email: '📧',
  whatsapp: '📱',
  sms: '📲',
  voice: '📞',
};

export const DashboardPage: React.FC = () => {
  const [metrics, setMetrics] = useState<AnalyticsMetrics | null>(null);
  const [recentConversations, setRecentConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [metricsRes, convsRes] = await Promise.all([
          analyticsApi.getOverview(),
          conversationsApi.list({ limit: 5 }),
        ]);
        if (metricsRes.success && metricsRes.data) {
          setMetrics(metricsRes.data);
        }
        if (convsRes.success && convsRes.data) {
          setRecentConversations(convsRes.data);
        }
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Mock data for display
  const mockMetrics = metrics || {
    conversations: { total: 156, open: 23, resolved: 133, avgResolutionTime: 4.2, firstResponseTime: 12 },
    channels: { web_chat: 45, email: 78, whatsapp: 23, sms: 5, voice: 5 },
    satisfaction: { average: 4.5, responses: 89 },
    agents: { online: 5, busy: 3, avgHandleTime: 8.5 },
  };

  const mockConversations: Conversation[] = recentConversations.length > 0 ? recentConversations : [
    {
      id: '1',
      customerId: 'cust_1',
      channel: 'email',
      status: 'open',
      priority: 'high',
      subject: 'Unable to process refund',
      tags: ['billing', 'urgent'],
      lastMessageAt: new Date().toISOString(),
      messageCount: 5,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: '2',
      customerId: 'cust_2',
      channel: 'web_chat',
      status: 'pending',
      priority: 'normal',
      subject: 'Product availability question',
      tags: ['sales'],
      lastMessageAt: new Date().toISOString(),
      messageCount: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: '3',
      customerId: 'cust_3',
      channel: 'whatsapp',
      status: 'open',
      priority: 'urgent',
      subject: 'Service outage report',
      tags: ['technical', 'p0'],
      lastMessageAt: new Date().toISOString(),
      messageCount: 12,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Overview of your support operations</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Open Conversations"
          value={mockMetrics.conversations.open}
          change={-12}
          icon={ChatBubbleLeftRightIcon}
          color="bg-blue-500"
        />
        <StatCard
          title="Avg. Response Time"
          value={`${mockMetrics.conversations.firstResponseTime}m`}
          change={-8}
          icon={ClockIcon}
          color="bg-green-500"
        />
        <StatCard
          title="Resolved Today"
          value={mockMetrics.conversations.resolved}
          change={15}
          icon={CheckCircleIcon}
          color="bg-purple-500"
        />
        <StatCard
          title="Active Agents"
          value={mockMetrics.agents.online}
          icon={UserGroupIcon}
          color="bg-orange-500"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Conversations */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Recent Conversations</h2>
            <a href="/conversations" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
              View all
            </a>
          </div>
          <div className="divide-y divide-gray-100">
            {mockConversations.map(conv => (
              <div key={conv.id} className="p-4 hover:bg-gray-50 transition-colors cursor-pointer">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <span className="text-xl">{channelIcons[conv.channel] || '💬'}</span>
                    <div>
                      <p className="font-medium text-gray-900">{conv.subject || 'No subject'}</p>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {conv.messageCount} messages · {new Date(conv.lastMessageAt).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${priorityColors[conv.priority]}`}>
                    {conv.priority}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-2 ml-9">
                  {conv.tags.map(tag => (
                    <span key={tag} className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Channel Breakdown */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Channels</h2>
          </div>
          <div className="p-4 space-y-4">
            {Object.entries(mockMetrics.channels).map(([channel, count]) => {
              const total = Object.values(mockMetrics.channels).reduce((a, b) => a + b, 0);
              const percentage = Math.round((count / total) * 100);
              return (
                <div key={channel}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700 capitalize flex items-center">
                      <span className="mr-2">{channelIcons[channel] || '💬'}</span>
                      {channel.replace('_', ' ')}
                    </span>
                    <span className="text-sm text-gray-500">{count}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className="bg-primary-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* SLA & Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SLA Breaches */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-4 border-b border-gray-100 flex items-center">
            <ExclamationTriangleIcon className="w-5 h-5 text-yellow-500 mr-2" />
            <h2 className="font-semibold text-gray-900">SLA Alerts</h2>
          </div>
          <div className="p-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100">
                <div>
                  <p className="font-medium text-red-800">3 conversations</p>
                  <p className="text-sm text-red-600">First response SLA breached</p>
                </div>
                <span className="text-red-600 font-semibold">Overdue</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-100">
                <div>
                  <p className="font-medium text-yellow-800">7 conversations</p>
                  <p className="text-sm text-yellow-600">Resolution SLA at risk</p>
                </div>
                <span className="text-yellow-600 font-semibold">&lt; 1 hour</span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Quick Actions</h2>
          </div>
          <div className="p-4 grid grid-cols-2 gap-3">
            <a
              href="/inbox"
              className="p-4 text-center rounded-lg border border-gray-200 hover:border-primary-300 hover:bg-primary-50 transition-colors"
            >
              <ChatBubbleLeftRightIcon className="w-8 h-8 mx-auto text-primary-600 mb-2" />
              <span className="font-medium text-gray-900">Open Inbox</span>
            </a>
            <a
              href="/resolutions"
              className="p-4 text-center rounded-lg border border-gray-200 hover:border-primary-300 hover:bg-primary-50 transition-colors"
            >
              <ClockIcon className="w-8 h-8 mx-auto text-primary-600 mb-2" />
              <span className="font-medium text-gray-900">Resolutions</span>
            </a>
            <a
              href="/customers"
              className="p-4 text-center rounded-lg border border-gray-200 hover:border-primary-300 hover:bg-primary-50 transition-colors"
            >
              <UserGroupIcon className="w-8 h-8 mx-auto text-primary-600 mb-2" />
              <span className="font-medium text-gray-900">Customers</span>
            </a>
            <a
              href="/analytics"
              className="p-4 text-center rounded-lg border border-gray-200 hover:border-primary-300 hover:bg-primary-50 transition-colors"
            >
              <ArrowTrendingUpIcon className="w-8 h-8 mx-auto text-primary-600 mb-2" />
              <span className="font-medium text-gray-900">Analytics</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
