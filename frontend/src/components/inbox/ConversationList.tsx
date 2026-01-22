/**
 * Conversation List Component
 * Unified inbox showing all conversations assigned to the agent
 */

import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

interface Conversation {
  id: string;
  customerId: string;
  customerName: string;
  customerAvatar?: string;
  state: string;
  severity: string;
  sentiment?: string;
  currentChannel: string;
  subject?: string;
  lastMessage: {
    content: string;
    senderType: string;
    createdAt: string;
  };
  unreadCount: number;
  slaStatus: {
    dueAt: string;
    minutesRemaining: number;
    status: 'ok' | 'warning' | 'breached';
  };
  tags: string[];
  createdAt: string;
}

interface ConversationListProps {
  conversations: Conversation[];
  selectedId?: string;
  onSelect: (id: string) => void;
  isLoading?: boolean;
}

type FilterState = 'all' | 'open' | 'awaiting_agent' | 'awaiting_customer' | 'escalated';
type SortOption = 'sla' | 'newest' | 'oldest' | 'severity';

const ConversationList: React.FC<ConversationListProps> = ({
  conversations,
  selectedId,
  onSelect,
  isLoading,
}) => {
  const [filter, setFilter] = useState<FilterState>('all');
  const [sort, setSort] = useState<SortOption>('sla');
  const [search, setSearch] = useState('');

  // Filter and sort conversations
  const filteredConversations = useMemo(() => {
    let result = [...conversations];

    // Filter by state
    if (filter !== 'all') {
      result = result.filter((c) => c.state === filter);
    }

    // Search
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.customerName?.toLowerCase().includes(searchLower) ||
          c.subject?.toLowerCase().includes(searchLower) ||
          c.lastMessage.content.toLowerCase().includes(searchLower)
      );
    }

    // Sort
    switch (sort) {
      case 'sla':
        result.sort((a, b) => a.slaStatus.minutesRemaining - b.slaStatus.minutesRemaining);
        break;
      case 'newest':
        result.sort(
          (a, b) =>
            new Date(b.lastMessage.createdAt).getTime() -
            new Date(a.lastMessage.createdAt).getTime()
        );
        break;
      case 'oldest':
        result.sort(
          (a, b) =>
            new Date(a.lastMessage.createdAt).getTime() -
            new Date(b.lastMessage.createdAt).getTime()
        );
        break;
      case 'severity':
        const severityOrder = { P0: 0, P1: 1, P2: 2, P3: 3 };
        result.sort(
          (a, b) =>
            severityOrder[a.severity as keyof typeof severityOrder] -
            severityOrder[b.severity as keyof typeof severityOrder]
        );
        break;
    }

    return result;
  }, [conversations, filter, sort, search]);

  const getChannelIcon = (channel: string) => {
    const icons: Record<string, string> = {
      web_chat: '💬',
      email: '📧',
      whatsapp: '📱',
      facebook: '👤',
      instagram: '📸',
      twitter: '🐦',
      voice: '📞',
      sms: '📱',
    };
    return icons[channel] || '💬';
  };

  const getSeverityColor = (severity: string) => {
    const colors: Record<string, string> = {
      P0: 'bg-red-100 text-red-800 border-red-200',
      P1: 'bg-orange-100 text-orange-800 border-orange-200',
      P2: 'bg-blue-100 text-blue-800 border-blue-200',
      P3: 'bg-gray-100 text-gray-800 border-gray-200',
    };
    return colors[severity] || colors.P2;
  };

  const getSLAStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      ok: 'text-green-600',
      warning: 'text-yellow-600',
      breached: 'text-red-600',
    };
    return colors[status] || colors.ok;
  };

  const getSentimentIndicator = (sentiment?: string) => {
    if (!sentiment) return null;
    const indicators: Record<string, { icon: string; color: string }> = {
      positive: { icon: '😊', color: 'text-green-500' },
      neutral: { icon: '😐', color: 'text-gray-500' },
      negative: { icon: '😟', color: 'text-yellow-500' },
      angry: { icon: '😠', color: 'text-red-500' },
    };
    return indicators[sentiment];
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-white">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Inbox</h2>

        {/* Search */}
        <div className="mb-3">
          <input
            type="text"
            placeholder="Search conversations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-3">
          {(['all', 'awaiting_agent', 'awaiting_customer', 'escalated'] as FilterState[]).map(
            (f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  filter === f
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {f === 'all'
                  ? 'All'
                  : f === 'awaiting_agent'
                    ? 'Needs Reply'
                    : f === 'awaiting_customer'
                      ? 'Waiting'
                      : 'Escalated'}
              </button>
            )
          )}
        </div>

        {/* Sort */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">{filteredConversations.length} conversations</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortOption)}
            className="text-sm border-none bg-transparent text-gray-600 focus:ring-0 cursor-pointer"
          >
            <option value="sla">Sort by SLA</option>
            <option value="severity">Sort by Severity</option>
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
          </select>
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto">
        {filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <svg
              className="w-12 h-12 mb-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
              />
            </svg>
            <p>No conversations found</p>
          </div>
        ) : (
          filteredConversations.map((conversation) => {
            const sentimentIndicator = getSentimentIndicator(conversation.sentiment);

            return (
              <div
                key={conversation.id}
                onClick={() => onSelect(conversation.id)}
                className={`p-4 border-b border-gray-100 cursor-pointer transition-colors ${
                  selectedId === conversation.id
                    ? 'bg-blue-50 border-l-4 border-l-blue-600'
                    : 'hover:bg-gray-50'
                }`}
              >
                {/* Top row: Customer info + SLA */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center">
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-white font-medium mr-3">
                      {conversation.customerAvatar ? (
                        <img
                          src={conversation.customerAvatar}
                          alt={conversation.customerName}
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        conversation.customerName?.charAt(0).toUpperCase() || '?'
                      )}
                    </div>

                    <div>
                      <div className="flex items-center">
                        <span className="font-medium text-gray-900">
                          {conversation.customerName || 'Unknown Customer'}
                        </span>
                        {sentimentIndicator && (
                          <span className={`ml-2 ${sentimentIndicator.color}`}>
                            {sentimentIndicator.icon}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center text-xs text-gray-500">
                        <span className="mr-2">{getChannelIcon(conversation.currentChannel)}</span>
                        <span>
                          {formatDistanceToNow(new Date(conversation.lastMessage.createdAt), {
                            addSuffix: true,
                          })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* SLA indicator */}
                  <div className="text-right">
                    <span
                      className={`text-xs font-medium px-2 py-1 rounded border ${getSeverityColor(conversation.severity)}`}
                    >
                      {conversation.severity}
                    </span>
                    {conversation.slaStatus && (
                      <div
                        className={`text-xs mt-1 ${getSLAStatusColor(conversation.slaStatus.status)}`}
                      >
                        {conversation.slaStatus.status === 'breached' ? (
                          <span className="font-medium">SLA Breached</span>
                        ) : (
                          <span>
                            {conversation.slaStatus.minutesRemaining}m left
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Subject */}
                {conversation.subject && (
                  <p className="text-sm font-medium text-gray-800 mb-1 truncate">
                    {conversation.subject}
                  </p>
                )}

                {/* Last message preview */}
                <p className="text-sm text-gray-600 truncate">
                  {conversation.lastMessage.senderType === 'agent' && (
                    <span className="text-gray-400">You: </span>
                  )}
                  {conversation.lastMessage.content}
                </p>

                {/* Bottom row: Tags + unread */}
                <div className="flex items-center justify-between mt-2">
                  <div className="flex flex-wrap gap-1">
                    {conversation.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded"
                      >
                        {tag}
                      </span>
                    ))}
                    {conversation.tags.length > 3 && (
                      <span className="text-xs text-gray-400">
                        +{conversation.tags.length - 3}
                      </span>
                    )}
                  </div>

                  {conversation.unreadCount > 0 && (
                    <span className="bg-blue-600 text-white text-xs font-medium px-2 py-0.5 rounded-full">
                      {conversation.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ConversationList;
