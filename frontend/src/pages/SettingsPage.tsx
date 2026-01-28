import React, { useState, useEffect } from 'react';
import api from '../services/api';

interface Integration {
  id: string; name: string; description: string; icon: string; enabled: boolean; status: string;
  config: Record<string, any>;
}

const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'integrations' | 'slack-bot' | 'profile'>('integrations');
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [selected, setSelected] = useState<Integration | null>(null);
  const [showGuide, setShowGuide] = useState<string | null>(null);
  const [guide, setGuide] = useState<any>(null);
  const [slackBot, setSlackBot] = useState({ enabled: false, followUpIntervalHours: 5, escalationChannel: '#tech-escalations' });

  const defaultIntegrations: Integration[] = [
    { id: 'email', name: 'Email (SMTP/SendGrid)', description: 'Customer email support', icon: '', enabled: false, status: 'disconnected', config: { provider: 'sendgrid', apiKey: '', fromEmail: '' } },
    { id: 'webchat', name: 'WebChat Widget', description: 'Live chat on your website', icon: '', enabled: false, status: 'disconnected', config: { widgetColor: '#3B82F6', greeting: 'Hi! How can we help?' } },
    { id: 'whatsapp', name: 'WhatsApp Business', description: 'WhatsApp messaging', icon: '', enabled: false, status: 'disconnected', config: { phoneNumberId: '', accessToken: '' } },
    { id: 'phone', name: 'Phone Calls (Twilio)', description: 'Voice call support', icon: '', enabled: false, status: 'disconnected', config: { accountSid: '', authToken: '', phoneNumber: '' } },
    { id: 'twitter', name: 'X (Twitter) DMs', description: 'Twitter direct messages', icon: '', enabled: false, status: 'disconnected', config: { apiKey: '', accessToken: '' } },
    { id: 'instagram', name: 'Instagram DMs', description: 'Instagram messages', icon: '', enabled: false, status: 'disconnected', config: { pageId: '', accessToken: '' } },
    { id: 'slack', name: 'Slack Integration', description: 'Team escalations', icon: '', enabled: false, status: 'disconnected', config: { botToken: '', escalationChannel: '#tech-escalations' } },
  ];

  useEffect(() => {
    api.get('/api/v1/integrations').then(r => setIntegrations(r.data?.data || defaultIntegrations)).catch(() => setIntegrations(defaultIntegrations));
  }, []);

  const loadGuide = async (id: string) => {
    setShowGuide(id);
    try {
      const r = await api.get('/api/v1/integrations/' + id + '/guide');
      setGuide(r.data?.data || null);
    } catch { setGuide(null); }
  };

  const saveIntegration = async (i: Integration) => {
    try {
      await api.put('/api/v1/integrations/' + i.id, i);
      setIntegrations(prev => prev.map(x => x.id === i.id ? i : x));
      setSelected(null);
    } catch (e) { console.error(e); }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Settings</h1>
        <p className="text-gray-500 mb-6">Manage integrations and configure your CRM</p>

        <div className="bg-white rounded-lg shadow-sm mb-6">
          <div className="flex border-b">
            {[{ id: 'integrations', label: ' Integrations' }, { id: 'slack-bot', label: ' Slack Bot' }, { id: 'profile', label: ' Profile' }].map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id as any)} className={'px-6 py-4 font-medium ' + (activeTab === t.id ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500')}>{t.label}</button>
            ))}
          </div>
        </div>

        {activeTab === 'integrations' && (
          <div className="grid md:grid-cols-2 gap-4">
            {integrations.map(i => (
              <div key={i.id} onClick={() => setSelected(i)} className={'bg-white rounded-lg shadow-sm border-2 p-5 cursor-pointer hover:shadow-md ' + (i.enabled ? 'border-green-300' : 'border-gray-200')}>
                <div className="flex justify-between">
                  <div className="flex items-center">
                    <span className="text-3xl mr-3">{i.icon}</span>
                    <div><h3 className="font-semibold">{i.name}</h3><p className="text-sm text-gray-500">{i.description}</p></div>
                  </div>
                  <div className="text-right">
                    <span className={'px-2 py-1 rounded-full text-xs ' + (i.status === 'connected' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600')}>{i.status}</span>
                    <button onClick={e => { e.stopPropagation(); loadGuide(i.id); }} className="block text-blue-600 text-sm mt-2">Setup Guide </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'slack-bot' && (
          <div className="max-w-2xl bg-white rounded-lg shadow p-6">
            <div className="flex items-center mb-6"><span className="text-3xl mr-3"></span><div><h2 className="text-lg font-semibold">Slack Escalation Bot</h2><p className="text-sm text-gray-500">Automated 5-hour follow-ups for dev team</p></div></div>
            <div className="space-y-4">
              <div className="flex justify-between items-center"><span>Enable Bot</span><input type="checkbox" checked={slackBot.enabled} onChange={e => setSlackBot({...slackBot, enabled: e.target.checked})} className="w-5 h-5" /></div>
              <div><label className="block text-sm font-medium mb-1">Follow-Up Interval (Hours)</label><input type="number" value={slackBot.followUpIntervalHours} onChange={e => setSlackBot({...slackBot, followUpIntervalHours: parseInt(e.target.value) || 5})} className="w-24 px-3 py-2 border rounded-lg" /></div>
              <div><label className="block text-sm font-medium mb-1">Escalation Channel</label><input type="text" value={slackBot.escalationChannel} onChange={e => setSlackBot({...slackBot, escalationChannel: e.target.value})} className="w-full px-3 py-2 border rounded-lg" /></div>
              <button onClick={() => api.post('/api/v1/integrations/slack/bot/follow-up')} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Trigger Follow-Up Now</button>
            </div>
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="max-w-2xl bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Profile Settings</h2>
            <div className="space-y-4">
              <div><label className="block text-sm font-medium mb-1">Full Name</label><input type="text" defaultValue="Agent Name" className="w-full px-3 py-2 border rounded-lg" /></div>
              <div><label className="block text-sm font-medium mb-1">Email</label><input type="email" defaultValue="agent@gravystream.com" className="w-full px-3 py-2 border rounded-lg" /></div>
            </div>
          </div>
        )}

        {selected && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-y-auto p-6">
              <div className="flex justify-between mb-4">
                <div className="flex items-center"><span className="text-3xl mr-3">{selected.icon}</span><h2 className="text-xl font-bold">{selected.name}</h2></div>
                <button onClick={() => setSelected(null)} className="text-gray-400 text-2xl">&times;</button>
              </div>
              <div className="flex items-center justify-between mb-4 pb-4 border-b"><span>Enable Integration</span><input type="checkbox" checked={selected.enabled} onChange={e => setSelected({...selected, enabled: e.target.checked, status: e.target.checked ? 'connected' : 'disconnected'})} className="w-5 h-5" /></div>
              <div className="space-y-3">
                {Object.entries(selected.config).map(([k, v]) => (
                  <div key={k}><label className="block text-sm font-medium mb-1 capitalize">{k.replace(/([A-Z])/g, ' $1')}</label>
                    <input type={k.includes('Token') || k.includes('Secret') || k.includes('Key') ? 'password' : 'text'} value={String(v)} onChange={e => setSelected({...selected, config: {...selected.config, [k]: e.target.value}})} className="w-full px-3 py-2 border rounded-lg" />
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button onClick={() => loadGuide(selected.id)} className="px-4 py-2 border rounded-lg">View Guide</button>
                <button onClick={() => saveIntegration(selected)} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Save</button>
              </div>
            </div>
          </div>
        )}

        {showGuide && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6">
              <div className="flex justify-between mb-4">
                <h2 className="text-xl font-bold">{guide?.title || 'Setup Guide'}</h2>
                <button onClick={() => { setShowGuide(null); setGuide(null); }} className="text-gray-400 text-2xl">&times;</button>
              </div>
              {guide?.steps?.map((s: any, idx: number) => (
                <div key={idx} className="flex gap-3 mb-4"><div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold">{idx+1}</div><div><h3 className="font-semibold">{s.title}</h3><p className="text-gray-600">{s.content}</p></div></div>
              ))}
              {guide?.requirements && <div className="mt-4 p-4 bg-yellow-50 rounded-lg"><h4 className="font-semibold text-yellow-800 mb-2">Requirements:</h4><ul className="list-disc list-inside text-yellow-700">{guide.requirements.map((r: string, idx: number) => <li key={idx}>{r}</li>)}</ul></div>}
              {guide?.widgetCode && <div className="mt-4 p-4 bg-gray-900 rounded-lg"><p className="text-gray-400 text-sm mb-2">Widget Code:</p><code className="text-green-400 text-sm">{guide.widgetCode}</code></div>}
              <button onClick={() => { setShowGuide(null); setGuide(null); }} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg">Got it!</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsPage;
