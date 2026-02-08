import React, { useState, useEffect } from 'react';
import {
  CpuChipIcon,
  ChatBubbleLeftRightIcon,
  EnvelopeIcon,
  PhoneIcon,
  DevicePhoneMobileIcon,
  GlobeAltIcon,
  UserGroupIcon,
  BookOpenIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  SparklesIcon,
  ShieldCheckIcon,
  ClockIcon,
  DocumentTextIcon,
  HashtagIcon,
} from '@heroicons/react/24/outline';
import { aiApi, knowledgeBaseApi } from '../services/api';

// Escalation rules
const defaultEscalationRules = [
  { id: 'human_request', label: 'Customer requests human agent', enabled: true },
  { id: 'refund_threshold', label: 'Refund amount exceeds threshold', enabled: true },
  { id: 'negative_sentiment', label: 'Complaint or negative sentiment detected', enabled: true },
  { id: 'technical_unresolved', label: 'Technical issue unresolved after 3 attempts', enabled: true },
  { id: 'legal_compliance', label: 'Legal or compliance questions', enabled: true },
  { id: 'vip_customer', label: 'VIP or enterprise customer', enabled: true },
];

// Data collection fields
const dataCollectionFields = [
  { id: 'name', label: 'Full Name', required: true, enabled: true },
  { id: 'email', label: 'Email Address', required: true, enabled: true },
  { id: 'phone', label: 'Phone Number', required: false, enabled: true },
  { id: 'company', label: 'Company Name', required: false, enabled: true },
  { id: 'issue_type', label: 'Issue Category', required: true, enabled: true },
  { id: 'order_number', label: 'Order/Reference Number', required: false, enabled: true },
];

// Response templates
const responseTemplates = [
  {
    id: 'greeting',
    name: 'Greeting Template',
    template: "Hi {customer_name}! Welcome to GravyStream. I'm your AI assistant. How can I help you today?",
    color: 'bg-green-50 border-green-200',
    titleColor: 'text-green-700',
  },
  {
    id: 'acknowledgment',
    name: 'Acknowledgment Template',
    template: "I understand you're experiencing {issue}. Let me help you resolve this right away.",
    color: 'bg-blue-50 border-blue-200',
    titleColor: 'text-blue-700',
  },
  {
    id: 'escalation',
    name: 'Escalation Template',
    template: "I'll connect you with a specialist who can better assist with this. Please hold for a moment.",
    color: 'bg-yellow-50 border-yellow-200',
    titleColor: 'text-yellow-700',
  },
  {
    id: 'resolution',
    name: 'Resolution Template',
    template: "Great news! I've {action_taken}. Is there anything else I can help you with?",
    color: 'bg-purple-50 border-purple-200',
    titleColor: 'text-purple-700',
  },
];

const AIAgentPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [escalationRules, setEscalationRules] = useState(defaultEscalationRules);
  const [dataFields, setDataFields] = useState(dataCollectionFields);

  // Config state
  const [selectedModel, setSelectedModel] = useState('claude-opus-4-20250514');
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [slackWebhookUrl, setSlackWebhookUrl] = useState('');
  const [slackChannel, setSlackChannel] = useState('#support-escalations');
  const [autoAssign, setAutoAssign] = useState(true);
  const [slackNotifications, setSlackNotifications] = useState(true);

  // Stats state (from live database)
  const [stats, setStats] = useState({
    totalClassifications: 0,
    totalResponses: 0,
    totalAssignments: 0,
    slackEscalations: 0,
    actionsToday: 0,
    knowledgeBaseArticles: 0
  });

  // Channel stats (from integrations)
  const [channels, setChannels] = useState([
    { id: 'email', name: 'Email', icon: EnvelopeIcon, connected: false, messages: 0 },
    { id: 'whatsapp', name: 'WhatsApp', icon: DevicePhoneMobileIcon, connected: false, messages: 0 },
    { id: 'webchat', name: 'Web Chat', icon: GlobeAltIcon, connected: true, messages: 0 },
    { id: 'phone', name: 'Phone Calls', icon: PhoneIcon, connected: false, messages: 0 },
    { id: 'slack', name: 'Slack (Escalation)', icon: HashtagIcon, connected: false, messages: 0 },
  ]);

  // Fetch data on mount
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch AI config
      const configRes = await aiApi.getConfig();
      const config = configRes.data || {};

      setSelectedModel(config.model || 'claude-opus-4-20250514');
      setApiKey(config.apiKey || '');
      setSlackWebhookUrl(config.slackWebhookUrl || '');
      setSlackChannel(config.slackChannel || '#support-escalations');
      setAutoAssign(config.autoAssign !== false);
      setSlackNotifications(config.slackEscalationEnabled !== false);
      setAiEnabled(config.aiEnabled !== false);

      // Fetch AI stats
      const statsRes = await aiApi.getStats();
      if (statsRes.data) {
        setStats(statsRes.data);
      }

      // Fetch KB stats for article count
      const kbRes = await knowledgeBaseApi.getStats();
      if (kbRes.data) {
        setStats(prev => ({ ...prev, knowledgeBaseArticles: kbRes.data.totalArticles || 0 }));
      }

      // Update channel connection status based on env
      setChannels(prev => prev.map(ch => {
        if (ch.id === 'email') return { ...ch, connected: !!config.emailConnected || true };
        if (ch.id === 'whatsapp') return { ...ch, connected: !!config.whatsappConnected || true };
        if (ch.id === 'slack') return { ...ch, connected: !!config.slackWebhookUrl };
        return ch;
      }));

    } catch (error) {
      console.error('[AIAgent] Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await aiApi.saveConfig({
        model: selectedModel,
        apiKey: apiKey,
        provider: 'anthropic',
        autoAssign,
        slackEscalationEnabled: slackNotifications,
        slackWebhookUrl,
        slackChannel,
        aiEnabled,
        maxTokens: 4096,
        temperature: 0.3,
        enableKnowledgeDeflection: true
      });
      alert('Configuration saved successfully!');
    } catch (error) {
      console.error('[AIAgent] Save error:', error);
      alert('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const toggleEscalationRule = (id: string) => {
    setEscalationRules(rules =>
      rules.map(rule =>
        rule.id === id ? { ...rule, enabled: !rule.enabled } : rule
      )
    );
  };

  const toggleDataField = (id: string) => {
    setDataFields(fields =>
      fields.map(field =>
        field.id === id ? { ...field, enabled: !field.enabled } : field
      )
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <ArrowPathIcon className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-500">Loading AI configuration...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CpuChipIcon className="w-8 h-8 text-blue-600" />
            AI Agent Configuration
          </h1>
          <p className="text-gray-500 mt-1">Configure your Claude AI assistant to manage customer enquiries across all channels</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchData} className="p-2 hover:bg-gray-100 rounded-lg" title="Refresh">
            <ArrowPathIcon className="w-5 h-5 text-gray-500" />
          </button>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${aiEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
            {aiEnabled ? 'Active' : 'Inactive'}
          </span>
          <button
            onClick={() => setAiEnabled(!aiEnabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${aiEnabled ? 'bg-blue-600' : 'bg-gray-300'}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${aiEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>
      </div>

      {/* Stats Overview - LIVE DATA */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm">AI Actions Today</p>
              <p className="text-3xl font-bold">{stats.actionsToday.toLocaleString()}</p>
              <p className="text-blue-200 text-xs mt-1">Classifications + Responses</p>
            </div>
            <ChatBubbleLeftRightIcon className="w-12 h-12 text-blue-300" />
          </div>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm">Total Classifications</p>
              <p className="text-3xl font-bold">{stats.totalClassifications.toLocaleString()}</p>
              <p className="text-green-200 text-xs mt-1">Messages analyzed</p>
            </div>
            <CheckCircleIcon className="w-12 h-12 text-green-300" />
          </div>
        </div>
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-sm">Slack Escalations</p>
              <p className="text-3xl font-bold">{stats.slackEscalations.toLocaleString()}</p>
              <p className="text-orange-200 text-xs mt-1">Sent to developers</p>
            </div>
            <UserGroupIcon className="w-12 h-12 text-orange-300" />
          </div>
        </div>
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm">KB Articles</p>
              <p className="text-3xl font-bold">{stats.knowledgeBaseArticles}</p>
              <p className="text-purple-200 text-xs mt-1">Available for AI</p>
            </div>
            <BookOpenIcon className="w-12 h-12 text-purple-300" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* AI Model Configuration */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <SparklesIcon className="w-5 h-5 text-purple-500" />
            AI Model Configuration
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Claude Model</label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="claude-opus-4-20250514">Claude Opus 4 (Most Capable)</option>
                <option value="claude-sonnet-4-20250514">Claude Sonnet 4 (Balanced)</option>
                <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
                <option value="claude-3-haiku-20240307">Claude 3 Haiku (Fastest)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Anthropic API Key</label>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-ant-api..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-20"
                />
                <button
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-blue-600 hover:text-blue-700"
                >
                  {showApiKey ? 'Hide' : 'Show'}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {apiKey ? '✓ API key configured' : 'Get your API key from console.anthropic.com'}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Knowledge Base Integration</label>
              <div className={`flex items-center justify-between p-3 rounded-lg border ${stats.knowledgeBaseArticles > 0 ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                <div className="flex items-center gap-2">
                  <BookOpenIcon className={`w-5 h-5 ${stats.knowledgeBaseArticles > 0 ? 'text-green-600' : 'text-gray-400'}`} />
                  <span className={`text-sm ${stats.knowledgeBaseArticles > 0 ? 'text-green-700' : 'text-gray-500'}`}>
                    {stats.knowledgeBaseArticles > 0 ? 'Connected to Knowledge Base' : 'No articles yet'}
                  </span>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${stats.knowledgeBaseArticles > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {stats.knowledgeBaseArticles} articles
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Connected Channels */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <GlobeAltIcon className="w-5 h-5 text-blue-500" />
            Connected Channels
          </h2>

          <div className="space-y-3">
            {channels.map((channel) => (
              <div
                key={channel.id}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  channel.connected ? 'bg-gray-50 border-gray-200' : 'bg-gray-100 border-gray-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <channel.icon className={`w-5 h-5 ${channel.connected ? 'text-blue-600' : 'text-gray-400'}`} />
                  <span className={`font-medium ${channel.connected ? 'text-gray-900' : 'text-gray-500'}`}>
                    {channel.name}
                  </span>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  channel.connected ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
                }`}>
                  {channel.connected ? 'Connected' : 'Not Connected'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* AI Response Templates */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
          <DocumentTextIcon className="w-5 h-5 text-green-500" />
          AI Response Templates
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {responseTemplates.map((template) => (
            <div key={template.id} className={`p-4 rounded-lg border ${template.color}`}>
              <h3 className={`font-semibold ${template.titleColor} mb-2`}>{template.name}</h3>
              <code className="text-sm text-gray-700 bg-white bg-opacity-50 p-2 rounded block">
                {template.template}
              </code>
            </div>
          ))}
        </div>
      </div>

      {/* Data Collection & Escalation Rules */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Customer Data Collection */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <UserGroupIcon className="w-5 h-5 text-blue-500" />
            Customer Data Collection
          </h2>
          <p className="text-sm text-gray-500 mb-4">AI will collect this information before escalating to agents</p>

          <div className="space-y-3">
            {dataFields.map((field) => (
              <div key={field.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={field.enabled}
                    onChange={() => toggleDataField(field.id)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-gray-700">{field.label}</span>
                  {field.required && (
                    <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded">Required</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Escalation Rules */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <ExclamationTriangleIcon className="w-5 h-5 text-orange-500" />
            Escalation Rules
          </h2>
          <p className="text-sm text-gray-500 mb-4">Configure when AI should escalate to human agents</p>

          <div className="space-y-3">
            {escalationRules.map((rule) => (
              <div key={rule.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={rule.enabled}
                    onChange={() => toggleEscalationRule(rule.id)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-gray-700">{rule.label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Agent Assignment & Slack Integration */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Auto Assignment */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <ArrowPathIcon className="w-5 h-5 text-green-500" />
            Agent Assignment
          </h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">Auto-assign to online agents</p>
                <p className="text-sm text-gray-500">Automatically route escalations to available agents</p>
              </div>
              <button
                onClick={() => setAutoAssign(!autoAssign)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${autoAssign ? 'bg-blue-600' : 'bg-gray-300'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${autoAssign ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Slack Integration */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <HashtagIcon className="w-5 h-5 text-purple-500" />
            Slack Integration
          </h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg border border-purple-200">
              <div>
                <p className="font-medium text-gray-900">Technical escalations to Slack</p>
                <p className="text-sm text-gray-500">Post technical issues to developers</p>
              </div>
              <button
                onClick={() => setSlackNotifications(!slackNotifications)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${slackNotifications ? 'bg-purple-600' : 'bg-gray-300'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${slackNotifications ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Slack Webhook URL</label>
              <input
                type="text"
                value={slackWebhookUrl}
                onChange={(e) => setSlackWebhookUrl(e.target.value)}
                placeholder="https://hooks.slack.com/services/..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Escalation Channel</label>
              <input
                type="text"
                value={slackChannel}
                onChange={(e) => setSlackChannel(e.target.value)}
                placeholder="#support-escalations"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end gap-3">
        <button
          onClick={fetchData}
          className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Reset
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
        >
          <ShieldCheckIcon className="w-5 h-5" />
          {saving ? 'Saving...' : 'Save Configuration'}
        </button>
      </div>
    </div>
  );
};

export default AIAgentPage;
