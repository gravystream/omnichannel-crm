/**
 * Conversation View Component
 * Displays the full conversation timeline with messages, notes, and actions
 */

import React, { useState, useRef, useEffect } from 'react';
import { formatDistanceToNow, format } from 'date-fns';

interface Message {
  id: string;
  channel: string;
  direction: 'inbound' | 'outbound' | 'internal';
  senderType: 'customer' | 'agent' | 'system' | 'ai';
  senderId?: string;
  senderName?: string;
  content: string;
  contentHtml?: string;
  attachments: Array<{
    id: string;
    filename: string;
    contentType: string;
    url: string;
  }>;
  aiAnnotations?: {
    intent?: string;
    sentiment?: string;
    suggestedResponse?: string;
    suggestedKbArticles?: string[];
  };
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  createdAt: string;
}

interface InternalNote {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  createdAt: string;
}

interface Conversation {
  id: string;
  customerId: string;
  customerName: string;
  state: string;
  severity: string;
  sentiment?: string;
  currentChannel: string;
  channelsUsed: string[];
  intent?: string;
  assignedAgentId?: string;
  assignedAgentName?: string;
  resolutionId?: string;
  tags: string[];
  sla: {
    firstResponseDueAt?: string;
    resolutionDueAt?: string;
    breached: boolean;
  };
  createdAt: string;
}

interface ConversationViewProps {
  conversation: Conversation;
  messages: Message[];
  notes: InternalNote[];
  onSendMessage: (content: string, channel: string, attachments?: File[]) => Promise<void>;
  onAddNote: (content: string) => Promise<void>;
  onEscalate: () => void;
  onResolve: () => void;
  isTyping?: boolean;
  agentTyping?: boolean;
}

const ConversationView: React.FC<ConversationViewProps> = ({
  conversation,
  messages,
  notes,
  onSendMessage,
  onAddNote,
  onEscalate,
  onResolve,
  isTyping,
  agentTyping,
}) => {
  const [messageInput, setMessageInput] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [selectedChannel, setSelectedChannel] = useState(conversation.currentChannel);
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [showAISuggestion, setShowAISuggestion] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<File[]>([]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Combine messages and notes into timeline
  const timeline = React.useMemo(() => {
    const items = [
      ...messages.map((m) => ({ ...m, type: 'message' as const })),
      ...notes.map((n) => ({ ...n, type: 'note' as const })),
    ];

    return items.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }, [messages, notes]);

  const handleSendMessage = async () => {
    if (!messageInput.trim() && attachments.length === 0) return;

    setIsSending(true);
    try {
      await onSendMessage(messageInput, selectedChannel, attachments);
      setMessageInput('');
      setAttachments([]);
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsSending(false);
    }
  };

  const handleAddNote = async () => {
    if (!noteInput.trim()) return;

    try {
      await onAddNote(noteInput);
      setNoteInput('');
      setShowNoteInput(false);
    } catch (error) {
      console.error('Failed to add note:', error);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachments([...attachments, ...files]);
  };

  const removeAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

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
      internal: '📝',
    };
    return icons[channel] || '💬';
  };

  const getMessageBubbleClass = (item: { direction?: string; type: string }) => {
    if (item.type === 'note') {
      return 'bg-yellow-50 border border-yellow-200';
    }
    if (item.direction === 'inbound') {
      return 'bg-gray-100';
    }
    if (item.direction === 'outbound') {
      return 'bg-blue-600 text-white';
    }
    return 'bg-gray-50 border border-gray-200 italic'; // System messages
  };

  // Get AI suggestion from latest customer message
  const latestAISuggestion = messages
    .filter((m) => m.direction === 'inbound' && m.aiAnnotations?.suggestedResponse)
    .slice(-1)[0]?.aiAnnotations?.suggestedResponse;

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {conversation.customerName || 'Unknown Customer'}
            </h2>
            <div className="flex items-center text-sm text-gray-500 mt-1">
              <span className="mr-3">
                {getChannelIcon(conversation.currentChannel)} via{' '}
                {conversation.currentChannel.replace('_', ' ')}
              </span>
              <span
                className={`px-2 py-0.5 rounded text-xs font-medium ${
                  conversation.state === 'resolved'
                    ? 'bg-green-100 text-green-800'
                    : conversation.state === 'escalated'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-blue-100 text-blue-800'
                }`}
              >
                {conversation.state.replace('_', ' ')}
              </span>
              {conversation.severity && (
                <span
                  className={`ml-2 px-2 py-0.5 rounded text-xs font-medium ${
                    conversation.severity === 'P0'
                      ? 'bg-red-100 text-red-800'
                      : conversation.severity === 'P1'
                        ? 'bg-orange-100 text-orange-800'
                        : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {conversation.severity}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {conversation.state !== 'resolved' && (
              <>
                <button
                  onClick={onEscalate}
                  className="px-3 py-1.5 text-sm font-medium text-orange-700 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors"
                >
                  Escalate
                </button>
                <button
                  onClick={onResolve}
                  className="px-3 py-1.5 text-sm font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                >
                  Resolve
                </button>
              </>
            )}
          </div>
        </div>

        {/* Channel indicators */}
        <div className="flex items-center mt-3 text-xs text-gray-500">
          <span className="mr-2">Channels used:</span>
          {conversation.channelsUsed.map((channel) => (
            <span key={channel} className="mr-2" title={channel}>
              {getChannelIcon(channel)}
            </span>
          ))}
        </div>

        {/* SLA warning */}
        {conversation.sla.breached && (
          <div className="mt-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            ⚠️ SLA Breached - Please prioritize this conversation
          </div>
        )}

        {/* Resolution link */}
        {conversation.resolutionId && (
          <div className="mt-2 px-3 py-2 bg-purple-50 border border-purple-200 rounded-lg text-sm text-purple-700">
            🔗 Linked to Resolution:{' '}
            <a
              href={`/resolutions/${conversation.resolutionId}`}
              className="font-medium underline"
            >
              View Resolution
            </a>
          </div>
        )}
      </div>

      {/* Messages Timeline */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {timeline.map((item) => {
          if (item.type === 'note') {
            const note = item as InternalNote & { type: 'note' };
            return (
              <div key={`note-${note.id}`} className="flex justify-center">
                <div className={`max-w-lg p-3 rounded-lg ${getMessageBubbleClass(item)}`}>
                  <div className="flex items-center text-xs text-yellow-700 mb-1">
                    <span className="font-medium">📝 Internal Note</span>
                    <span className="mx-2">•</span>
                    <span>{note.authorName}</span>
                  </div>
                  <p className="text-sm text-gray-700">{note.content}</p>
                  <span className="text-xs text-gray-400 mt-1 block">
                    {format(new Date(note.createdAt), 'MMM d, h:mm a')}
                  </span>
                </div>
              </div>
            );
          }

          const message = item as Message & { type: 'message' };
          const isInbound = message.direction === 'inbound';
          const isSystem = message.senderType === 'system';

          if (isSystem) {
            return (
              <div key={`msg-${message.id}`} className="flex justify-center">
                <div className={`max-w-lg p-2 rounded-lg ${getMessageBubbleClass(item)}`}>
                  <p className="text-sm text-gray-500">{message.content}</p>
                  <span className="text-xs text-gray-400">
                    {format(new Date(message.createdAt), 'MMM d, h:mm a')}
                  </span>
                </div>
              </div>
            );
          }

          return (
            <div
              key={`msg-${message.id}`}
              className={`flex ${isInbound ? 'justify-start' : 'justify-end'}`}
            >
              <div className={`max-w-lg ${isInbound ? 'pr-12' : 'pl-12'}`}>
                <div className={`p-3 rounded-lg ${getMessageBubbleClass(item)}`}>
                  {/* Sender info for inbound */}
                  {isInbound && (
                    <div className="flex items-center text-xs text-gray-500 mb-1">
                      <span>{getChannelIcon(message.channel)}</span>
                      <span className="ml-1">{message.senderName || 'Customer'}</span>
                    </div>
                  )}

                  {/* Message content */}
                  {message.contentHtml ? (
                    <div
                      className="text-sm prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: message.contentHtml }}
                    />
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  )}

                  {/* Attachments */}
                  {message.attachments.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {message.attachments.map((att) => (
                        <a
                          key={att.id}
                          href={att.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center text-xs text-blue-600 hover:underline"
                        >
                          📎 {att.filename}
                        </a>
                      ))}
                    </div>
                  )}

                  {/* AI annotations for inbound */}
                  {isInbound && message.aiAnnotations && (
                    <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-500">
                      {message.aiAnnotations.intent && (
                        <span className="mr-2">
                          Intent: <span className="font-medium">{message.aiAnnotations.intent}</span>
                        </span>
                      )}
                      {message.aiAnnotations.sentiment && (
                        <span>
                          Sentiment:{' '}
                          <span className="font-medium">{message.aiAnnotations.sentiment}</span>
                        </span>
                      )}
                    </div>
                  )}

                  {/* Timestamp and status */}
                  <div
                    className={`flex items-center justify-between mt-1 text-xs ${
                      isInbound ? 'text-gray-400' : 'text-blue-200'
                    }`}
                  >
                    <span>{format(new Date(message.createdAt), 'h:mm a')}</span>
                    {!isInbound && (
                      <span className="ml-2">
                        {message.status === 'read'
                          ? '✓✓'
                          : message.status === 'delivered'
                            ? '✓✓'
                            : message.status === 'sent'
                              ? '✓'
                              : message.status === 'failed'
                                ? '⚠️'
                                : '○'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Outbound channel indicator */}
                {!isInbound && (
                  <div className="text-right text-xs text-gray-400 mt-1">
                    {getChannelIcon(message.channel)} via {message.channel.replace('_', ' ')}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Typing indicator */}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-gray-100 p-3 rounded-lg">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200"></div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* AI Suggestion */}
      {latestAISuggestion && !showAISuggestion && (
        <div className="px-6 py-2 bg-purple-50 border-t border-purple-100">
          <button
            onClick={() => setShowAISuggestion(true)}
            className="text-sm text-purple-700 hover:text-purple-900"
          >
            💡 AI has a suggested response...
          </button>
        </div>
      )}

      {showAISuggestion && latestAISuggestion && (
        <div className="px-6 py-3 bg-purple-50 border-t border-purple-100">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-xs text-purple-600 font-medium mb-1">AI Suggested Response:</p>
              <p className="text-sm text-gray-700">{latestAISuggestion}</p>
            </div>
            <div className="flex items-center space-x-2 ml-4">
              <button
                onClick={() => {
                  setMessageInput(latestAISuggestion);
                  setShowAISuggestion(false);
                }}
                className="px-2 py-1 text-xs font-medium text-purple-700 bg-purple-100 rounded hover:bg-purple-200"
              >
                Use
              </button>
              <button
                onClick={() => setShowAISuggestion(false)}
                className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Note input */}
      {showNoteInput && (
        <div className="px-6 py-3 bg-yellow-50 border-t border-yellow-100">
          <div className="flex items-end space-x-2">
            <textarea
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              placeholder="Add internal note..."
              className="flex-1 px-3 py-2 text-sm border border-yellow-200 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent resize-none"
              rows={2}
            />
            <button
              onClick={handleAddNote}
              disabled={!noteInput.trim()}
              className="px-4 py-2 text-sm font-medium text-yellow-700 bg-yellow-100 rounded-lg hover:bg-yellow-200 disabled:opacity-50"
            >
              Add Note
            </button>
            <button
              onClick={() => setShowNoteInput(false)}
              className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Message Input */}
      {conversation.state !== 'resolved' && (
        <div className="px-6 py-4 border-t border-gray-200 bg-white">
          {/* Attachments preview */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {attachments.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center bg-gray-100 px-2 py-1 rounded text-sm"
                >
                  <span className="truncate max-w-xs">{file.name}</span>
                  <button
                    onClick={() => removeAttachment(index)}
                    className="ml-2 text-gray-500 hover:text-red-500"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-end space-x-3">
            {/* Channel selector */}
            <select
              value={selectedChannel}
              onChange={(e) => setSelectedChannel(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {conversation.channelsUsed.map((channel) => (
                <option key={channel} value={channel}>
                  {getChannelIcon(channel)} {channel.replace('_', ' ')}
                </option>
              ))}
            </select>

            {/* Message input */}
            <div className="flex-1 relative">
              <textarea
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="Type your message..."
                className="w-full px-4 py-2 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                rows={2}
              />
            </div>

            {/* Actions */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                title="Attach file"
              >
                📎
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />

              <button
                onClick={() => setShowNoteInput(!showNoteInput)}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                title="Add note"
              >
                📝
              </button>

              <button
                onClick={handleSendMessage}
                disabled={isSending || (!messageInput.trim() && attachments.length === 0)}
                className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSending ? (
                  <span className="flex items-center">
                    <svg
                      className="animate-spin -ml-1 mr-2 h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    Sending...
                  </span>
                ) : (
                  'Send'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConversationView;
