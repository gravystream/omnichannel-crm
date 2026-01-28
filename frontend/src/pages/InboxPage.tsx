import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  PaperAirplaneIcon,
  PaperClipIcon,
  FaceSmileIcon,
  EllipsisVerticalIcon,
  CheckCircleIcon,
  ClockIcon,
  UserCircleIcon,
  TagIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { conversationsApi } from '../services/api';
import { useSocket } from '../contexts/SocketContext';
import type { Conversation, Message } from '../types';

const channelIcons: Record<string, string> = {
  web_chat: '💬',
  email: '📧',
  whatsapp: '📱',
  sms: '📲',
  voice: '📞',
};

const priorityColors: Record<string, string> = {
  urgent: 'border-l-red-500',
  high: 'border-l-orange-500',
  normal: 'border-l-blue-500',
  low: 'border-l-gray-400',
};

const statusBadges: Record<string, { color: string; label: string }> = {
  open: { color: 'bg-green-100 text-green-800', label: 'Open' },
  pending: { color: 'bg-yellow-100 text-yellow-800', label: 'Pending' },
  resolved: { color: 'bg-blue-100 text-blue-800', label: 'Resolved' },
  closed: { color: 'bg-gray-100 text-gray-800', label: 'Closed' },
};

// Default fallback for unknown statuses or priorities
const defaultStatusBadge = { color: 'bg-gray-100 text-gray-800', label: 'Unknown' };
const defaultPriorityColor = 'border-l-gray-400';

export const InboxPage: React.FC = () => {
  const navigate = useNavigate();
  const { conversationId } = useParams<{ conversationId?: string }>();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState<'all' | 'open' | 'pending' | 'mine'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { joinConversation, leaveConversation, sendTypingIndicator } = useSocket();

  useEffect(() => {
    fetchConversations();
  }, [filter]);

  useEffect(() => {
    if (conversationId) {
      const conv = conversations.find(c => c.id === conversationId);
      if (conv) {
        selectConversation(conv);
      }
    }
  }, [conversationId, conversations]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchConversations = async () => {
    setLoading(true);
    try {
      const params: { status?: string } = {};
      if (filter === 'open') params.status = 'open';
      if (filter === 'pending') params.status = 'pending';

      const response = await conversationsApi.list(params);
      if (response.success && response.data) {
        setConversations(response.data);
      } else {
        // Use mock data
        setConversations(mockConversations);
      }
    } catch (error) {
      setConversations(mockConversations);
    } finally {
      setLoading(false);
    }
  };

  const selectConversation = async (conv: Conversation) => {
    if (selectedConv) {
      leaveConversation(selectedConv.id);
    }
    setSelectedConv(conv);
    joinConversation(conv.id);
    navigate(`/inbox/${conv.id}`, { replace: true });

    try {
      const response = await conversationsApi.getMessages(conv.id);
      if (response.success && response.data) {
        setMessages(response.data);
      } else {
        setMessages(mockMessages);
      }
    } catch (error) {
      setMessages(mockMessages);
    }
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !selectedConv || sending) return;

    setSending(true);
    try {
      const response = await conversationsApi.sendMessage(selectedConv.id, messageText);
      if (response.success && response.data) {
        setMessages(prev => [...prev, response.data!]);
      } else {
        // Mock add message
        setMessages(prev => [
          ...prev,
          {
            id: `msg_${Date.now()}`,
            conversationId: selectedConv.id,
            direction: 'outbound',
            senderType: 'agent',
            content: messageText,
            contentType: 'text',
            attachments: [],
            createdAt: new Date().toISOString(),
          },
        ]);
      }
      setMessageText('');
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setSending(false);
    }
  };

  const handleResolve = async () => {
    if (!selectedConv) return;
    try {
      await conversationsApi.updateStatus(selectedConv.id, 'resolved');
      setSelectedConv({ ...selectedConv, status: 'resolved' });
      setConversations(prev =>
        prev.map(c => (c.id === selectedConv.id ? { ...c, status: 'resolved' as const } : c))
      );
    } catch (error) {
      console.error('Failed to resolve:', error);
    }
  };

  const filteredConversations = conversations.filter(conv => {
    if (searchQuery) {
      const search = searchQuery.toLowerCase();
      return (
        conv.subject?.toLowerCase().includes(search) ||
        conv.customer?.profile.name?.toLowerCase().includes(search)
      );
    }
    return true;
  });

  return (
    <div className="flex h-[calc(100vh-8rem)] bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Conversation List */}
      <div className="w-80 border-r border-gray-200 flex flex-col">
        {/* Search & Filters */}
        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <div className="flex gap-2 mt-3">
            {(['all', 'open', 'pending', 'mine'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 text-sm font-medium rounded-full capitalize ${
                  filter === f
                    ? 'bg-primary-100 text-primary-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-gray-500">Loading...</div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-4 text-center text-gray-500">No conversations found</div>
          ) : (
            filteredConversations.map(conv => (
              <div
                key={conv.id}
                onClick={() => selectConversation(conv)}
                className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors border-l-4 ${
                  priorityColors[conv.priority] || defaultPriorityColor
                } ${selectedConv?.id === conv.id ? 'bg-primary-50' : ''}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span>{channelIcons[conv.channel] || '💬'}</span>
                      <span className="font-medium text-gray-900 truncate">
                        {conv.subject || 'No subject'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 truncate mt-1">
                      {conv.customer?.profile.name || `Customer #${conv.customerId.slice(-4)}`}
                    </p>
                  </div>
                  <div className="text-right ml-2">
                    <span className={`px-2 py-0.5 text-xs rounded-full ${(statusBadges[conv.status] || defaultStatusBadge).color}`}>
                      {(statusBadges[conv.status] || defaultStatusBadge).label}
                    </span>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(conv.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 mt-2">
                  {conv.tags?.slice(0, 3).map(tag => (
                    <span key={tag} className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                      {tag}
                    </span>
                  ))}
                  <span className="text-xs text-gray-400 ml-auto">
                    {conv.messageCount} msgs
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Conversation View */}
      {selectedConv ? (
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-gray-600">
                <UserCircleIcon className="w-6 h-6" />
              </div>
              <div className="ml-3">
                <h2 className="font-semibold text-gray-900">{selectedConv.subject || 'No subject'}</h2>
                <p className="text-sm text-gray-500">
                  {selectedConv.customer?.profile.name || `Customer #${selectedConv.customerId.slice(-4)}`}
                  <span className="mx-2">•</span>
                  <span className="capitalize">{selectedConv.channel.replace('_', ' ')}</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleResolve}
                className="px-3 py-1.5 text-sm font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 flex items-center gap-1"
              >
                <CheckCircleIcon className="w-4 h-4" />
                Resolve
              </button>
              <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
                <TagIcon className="w-5 h-5" />
              </button>
              <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
                <EllipsisVerticalIcon className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {messages.map(msg => (
              <div
                key={msg.id}
                className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                    msg.direction === 'outbound'
                      ? 'bg-primary-600 text-white rounded-br-md'
                      : 'bg-white text-gray-900 rounded-bl-md shadow-sm border border-gray-100'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  <p className={`text-xs mt-1 ${msg.direction === 'outbound' ? 'text-primary-200' : 'text-gray-400'}`}>
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {msg.senderType === 'agent' && ' • Agent'}
                    {msg.senderType === 'bot' && ' • AI Bot'}
                  </p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Composer */}
          <div className="p-4 border-t border-gray-200 bg-white">
            <div className="flex items-end gap-2">
              <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
                <PaperClipIcon className="w-5 h-5" />
              </button>
              <div className="flex-1">
                <textarea
                  value={messageText}
                  onChange={(e) => {
                    setMessageText(e.target.value);
                    sendTypingIndicator(selectedConv.id, e.target.value.length > 0);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Type your message..."
                  rows={1}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl resize-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
                <FaceSmileIcon className="w-5 h-5" />
              </button>
              <button
                onClick={handleSendMessage}
                disabled={!messageText.trim() || sending}
                className="p-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <PaperAirplaneIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <ChatBubbleIcon className="w-16 h-16 text-gray-300 mx-auto" />
            <p className="mt-4 text-gray-500">Select a conversation to start</p>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper component
const ChatBubbleIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
    />
  </svg>
);

// Mock data
const mockConversations: Conversation[] = [
  {
    id: 'conv_1',
    customerId: 'cust_1',
    channel: 'email',
    status: 'open',
    priority: 'high',
    subject: 'Refund not processed after 5 days',
    tags: ['billing', 'refund'],
    lastMessageAt: new Date(Date.now() - 300000).toISOString(),
    messageCount: 8,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 300000).toISOString(),
  },
  {
    id: 'conv_2',
    customerId: 'cust_2',
    channel: 'web_chat',
    status: 'pending',
    priority: 'normal',
    subject: 'Cannot access premium features',
    tags: ['technical', 'access'],
    lastMessageAt: new Date(Date.now() - 600000).toISOString(),
    messageCount: 4,
    createdAt: new Date(Date.now() - 43200000).toISOString(),
    updatedAt: new Date(Date.now() - 600000).toISOString(),
  },
  {
    id: 'conv_3',
    customerId: 'cust_3',
    channel: 'whatsapp',
    status: 'open',
    priority: 'urgent',
    subject: 'Service completely down',
    tags: ['outage', 'p0'],
    lastMessageAt: new Date(Date.now() - 60000).toISOString(),
    messageCount: 15,
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    updatedAt: new Date(Date.now() - 60000).toISOString(),
  },
];

const mockMessages: Message[] = [
  {
    id: 'msg_1',
    conversationId: 'conv_1',
    direction: 'inbound',
    senderType: 'customer',
    content: 'Hi, I requested a refund 5 days ago but haven\'t received it yet. Order #12345.',
    contentType: 'text',
    attachments: [],
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'msg_2',
    conversationId: 'conv_1',
    direction: 'outbound',
    senderType: 'agent',
    content: 'Hello! I apologize for the delay. Let me check the status of your refund right away.',
    contentType: 'text',
    attachments: [],
    createdAt: new Date(Date.now() - 3500000).toISOString(),
  },
  {
    id: 'msg_3',
    conversationId: 'conv_1',
    direction: 'outbound',
    senderType: 'agent',
    content: 'I found your order. The refund was processed but there seems to be a delay with your bank. It should arrive within 2-3 business days.',
    contentType: 'text',
    attachments: [],
    createdAt: new Date(Date.now() - 3400000).toISOString(),
  },
  {
    id: 'msg_4',
    conversationId: 'conv_1',
    direction: 'inbound',
    senderType: 'customer',
    content: 'Thanks for checking. I\'ll wait a couple more days then.',
    contentType: 'text',
    attachments: [],
    createdAt: new Date(Date.now() - 300000).toISOString(),
  },
];

export default InboxPage;
