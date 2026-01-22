/**
 * Omnichannel CRM - Combined Server + Test Runner
 * Run with: node test-all.js
 */

const http = require('http');
const crypto = require('crypto');
const { URL } = require('url');

// =============================================================================
// IN-MEMORY DATA STORES
// =============================================================================

const users = new Map([
  ['admin@company.com', { id: 'user_admin1', password: 'admin123', role: 'admin', name: 'Admin User' }],
  ['agent@company.com', { id: 'user_agent1', password: 'agent123', role: 'agent', name: 'Sarah Support' }],
  ['engineer@company.com', { id: 'user_eng1', password: 'engineer123', role: 'engineer', name: 'Mike Engineer' }],
]);

const conversations = new Map();
const messages = new Map();
const customers = new Map();
const resolutions = new Map();
const tokens = new Map();

// Initialize sample data
function initSampleData() {
  customers.set('cust_1', {
    id: 'cust_1', name: 'John Doe', email: 'john@example.com',
    company: 'Acme Corp', tier: 'standard',
    createdAt: new Date(Date.now() - 730 * 24 * 60 * 60 * 1000).toISOString(),
  });
  customers.set('cust_2', {
    id: 'cust_2', name: 'Jane Smith', email: 'jane@example.com',
    company: 'Tech Startup Inc', tier: 'standard',
    createdAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
  });
  customers.set('cust_3', {
    id: 'cust_3', name: 'Bob Wilson', email: 'bob@enterprise.com',
    company: 'Enterprise Global Ltd', tier: 'enterprise',
    createdAt: new Date(Date.now() - 1825 * 24 * 60 * 60 * 1000).toISOString(),
  });

  const conv1 = {
    id: 'conv_sample_1', customerId: 'cust_1', customerName: 'John Doe',
    customerEmail: 'john@example.com', state: 'awaiting_agent', severity: 'P1',
    sentiment: 'negative', intent: 'account_access_issue', currentChannel: 'web_chat',
    channelsUsed: ['web_chat'], assignedAgentId: null, assignedTeamId: 'team_support',
    subject: 'Cannot login to my account', tags: ['login', 'authentication'],
    sla: { firstResponseDueAt: new Date(Date.now() + 30*60*1000).toISOString(),
           resolutionDueAt: new Date(Date.now() + 4*60*60*1000).toISOString(), breached: false },
    messageCount: 2, createdAt: new Date(Date.now() - 10*60*1000).toISOString(),
    updatedAt: new Date().toISOString(), lastMessageAt: new Date().toISOString(),
  };

  const conv2 = {
    id: 'conv_sample_2', customerId: 'cust_2', customerName: 'Jane Smith',
    customerEmail: 'jane@example.com', state: 'open', severity: 'P2',
    sentiment: 'neutral', intent: 'how_to_guidance', currentChannel: 'email',
    channelsUsed: ['email'], assignedAgentId: null, assignedTeamId: 'team_support',
    subject: 'How to export my data?', tags: ['export', 'data'],
    sla: { firstResponseDueAt: new Date(Date.now() + 60*60*1000).toISOString(),
           resolutionDueAt: new Date(Date.now() + 8*60*60*1000).toISOString(), breached: false },
    messageCount: 1, createdAt: new Date(Date.now() - 5*60*1000).toISOString(),
    updatedAt: new Date().toISOString(), lastMessageAt: new Date().toISOString(),
  };

  const conv3 = {
    id: 'conv_sample_3', customerId: 'cust_3', customerName: 'Bob Wilson',
    customerEmail: 'bob@enterprise.com', state: 'escalated', severity: 'P0',
    sentiment: 'angry', intent: 'transaction_system_failure', currentChannel: 'whatsapp',
    channelsUsed: ['whatsapp', 'email'], assignedAgentId: 'user_agent1',
    assignedTeamId: 'team_support', resolutionId: 'res_sample_1',
    subject: 'Payment failed - $10,000 transaction stuck!', tags: ['payment', 'urgent', 'enterprise'],
    sla: { firstResponseDueAt: new Date(Date.now() - 5*60*1000).toISOString(),
           resolutionDueAt: new Date(Date.now() + 60*60*1000).toISOString(), breached: true },
    messageCount: 8, createdAt: new Date(Date.now() - 45*60*1000).toISOString(),
    updatedAt: new Date().toISOString(), lastMessageAt: new Date().toISOString(),
  };

  conversations.set(conv1.id, conv1);
  conversations.set(conv2.id, conv2);
  conversations.set(conv3.id, conv3);

  messages.set('conv_sample_1', [
    { id: 'msg_1_1', conversationId: 'conv_sample_1', channel: 'web_chat', direction: 'inbound',
      senderType: 'customer', senderName: 'John Doe',
      content: "I can't login to my account!", contentType: 'text',
      aiAnnotations: { intent: 'account_access_issue', severity: 'P1', sentiment: 'negative' },
      status: 'delivered', createdAt: new Date(Date.now() - 10*60*1000).toISOString() },
  ]);

  messages.set('conv_sample_3', [
    { id: 'msg_3_1', conversationId: 'conv_sample_3', channel: 'whatsapp', direction: 'inbound',
      senderType: 'customer', senderName: 'Bob Wilson',
      content: "URGENT! Transaction stuck!", contentType: 'text',
      aiAnnotations: { intent: 'transaction_system_failure', severity: 'P0', sentiment: 'angry' },
      status: 'delivered', createdAt: new Date(Date.now() - 45*60*1000).toISOString() },
  ]);

  resolutions.set('res_sample_1', {
    id: 'res_sample_1', conversationId: 'conv_sample_3', customerId: 'cust_3',
    title: 'Payment Processing Failure', description: 'Stuck transaction',
    issueType: 'transaction_system_failure', priority: 'P0', status: 'fix_in_progress',
    assignedTeamId: 'team_engineering', assignedEngineerId: 'user_eng1',
    slackChannelId: 'C12345', slackChannelName: 'incident-payment',
    rootCause: 'Connection pool exhaustion', affectedSystems: ['payment-gateway'],
    timeline: [
      { timestamp: new Date(Date.now() - 45*60*1000).toISOString(), event: 'Issue reported' },
      { timestamp: new Date(Date.now() - 40*60*1000).toISOString(), event: 'Escalated' },
      { timestamp: new Date(Date.now() - 35*60*1000).toISOString(), event: 'Slack created' },
      { timestamp: new Date(Date.now() - 30*60*1000).toISOString(), event: 'Root cause found' },
    ],
    customerLastUpdatedAt: new Date(Date.now() - 20*60*1000).toISOString(),
    createdAt: new Date(Date.now() - 45*60*1000).toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

function generateId(prefix) { return `${prefix}_${crypto.randomBytes(4).toString('hex')}`; }
function generateToken() { return crypto.randomBytes(32).toString('hex'); }

function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => { try { resolve(body ? JSON.parse(body) : {}); } catch (e) { resolve({}); } });
  });
}

function sendJson(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(data));
}

// =============================================================================
// ROUTES
// =============================================================================

const routes = {
  'GET /health': () => ({ success: true, data: { status: 'healthy', timestamp: new Date().toISOString() } }),

  'POST /api/auth/login': async (req) => {
    const { email, password } = await parseBody(req);
    const user = users.get(email);
    if (!user || user.password !== password) return { error: 'Invalid credentials', status: 401 };
    const token = generateToken();
    tokens.set(token, { userId: user.id, email, role: user.role, name: user.name });
    return { success: true, data: { token, user: { id: user.id, email, role: user.role, name: user.name } } };
  },

  'GET /api/conversations': (req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    let result = Array.from(conversations.values());
    const state = url.searchParams.get('state');
    const severity = url.searchParams.get('severity');
    if (state) result = result.filter(c => state.split(',').includes(c.state));
    if (severity) result = result.filter(c => severity.split(',').includes(c.severity));
    result.sort((a, b) => ({ P0: 0, P1: 1, P2: 2, P3: 3 }[a.severity] || 3) - ({ P0: 0, P1: 1, P2: 2, P3: 3 }[b.severity] || 3));
    return { success: true, data: result, pagination: { page: 1, pageSize: 20, totalItems: result.length } };
  },

  'GET /api/conversations/:id': (req, params) => {
    const conv = conversations.get(params.id);
    if (!conv) return { error: 'Conversation not found', status: 404 };
    return { success: true, data: { ...conv, messages: messages.get(params.id) || [] } };
  },

  'POST /api/conversations': async (req) => {
    const body = await parseBody(req);
    const id = generateId('conv');
    const now = new Date().toISOString();
    const conv = {
      id, customerId: body.customerId || generateId('cust'), customerName: body.customerName || 'Unknown',
      customerEmail: body.customerEmail, state: 'open', severity: 'P2', sentiment: 'neutral',
      currentChannel: body.channel || 'web_chat', channelsUsed: [body.channel || 'web_chat'],
      assignedAgentId: null, subject: body.subject || 'New conversation', tags: [],
      sla: { firstResponseDueAt: new Date(Date.now() + 60*60*1000).toISOString(),
             resolutionDueAt: new Date(Date.now() + 4*60*60*1000).toISOString(), breached: false },
      messageCount: body.initialMessage ? 1 : 0, createdAt: now, updatedAt: now, lastMessageAt: now,
    };
    conversations.set(id, conv);
    if (body.initialMessage) {
      messages.set(id, [{ id: generateId('msg'), conversationId: id, channel: body.channel || 'web_chat',
        direction: 'inbound', senderType: 'customer', senderName: body.customerName || 'Customer',
        content: body.initialMessage, contentType: 'text', status: 'delivered', createdAt: now }]);
    }
    return { success: true, data: conv, status: 201 };
  },

  'POST /api/conversations/:id/messages': async (req, params) => {
    const conv = conversations.get(params.id);
    if (!conv) return { error: 'Conversation not found', status: 404 };
    const body = await parseBody(req);
    const now = new Date().toISOString();
    const msg = { id: generateId('msg'), conversationId: params.id, channel: body.channel || conv.currentChannel,
      direction: body.direction || 'outbound', senderType: body.senderType || 'agent', senderId: body.senderId,
      senderName: body.senderType === 'agent' ? 'Support Agent' : conv.customerName,
      content: body.content, contentType: 'text', status: 'sent', createdAt: now };
    const convMsgs = messages.get(params.id) || [];
    convMsgs.push(msg);
    messages.set(params.id, convMsgs);
    conv.messageCount++;
    conv.lastMessageAt = now;
    conv.updatedAt = now;
    if (body.direction === 'outbound' && body.senderType === 'agent') conv.state = 'awaiting_customer';
    else if (body.direction === 'inbound' && body.senderType === 'customer') conv.state = 'awaiting_agent';
    return { success: true, data: msg, status: 201 };
  },

  'POST /api/conversations/:id/assign': async (req, params) => {
    const conv = conversations.get(params.id);
    if (!conv) return { error: 'Conversation not found', status: 404 };
    const body = await parseBody(req);
    conv.assignedAgentId = body.agentId;
    if (body.teamId) conv.assignedTeamId = body.teamId;
    conv.state = 'awaiting_agent';
    conv.updatedAt = new Date().toISOString();
    return { success: true, data: conv };
  },

  'POST /api/conversations/:id/escalate': async (req, params) => {
    const conv = conversations.get(params.id);
    if (!conv) return { error: 'Conversation not found', status: 404 };
    const body = await parseBody(req);
    const now = new Date().toISOString();
    conv.state = 'escalated';
    conv.updatedAt = now;
    let resolutionId = null;
    if (body.createResolution) {
      resolutionId = generateId('res');
      conv.resolutionId = resolutionId;
      resolutions.set(resolutionId, {
        id: resolutionId, conversationId: params.id, customerId: conv.customerId,
        title: conv.subject, description: body.reason || 'Escalated', issueType: conv.intent || 'unknown',
        priority: conv.severity, status: 'investigating', assignedTeamId: 'team_engineering',
        timeline: [{ timestamp: now, event: 'Resolution created' }], createdAt: now, updatedAt: now,
      });
    }
    const convMsgs = messages.get(params.id) || [];
    convMsgs.push({ id: generateId('msg'), conversationId: params.id, channel: 'internal',
      direction: 'internal', senderType: 'system', content: `Escalated: ${body.reason || 'No reason'}`,
      contentType: 'text', status: 'delivered', createdAt: now });
    messages.set(params.id, convMsgs);
    return { success: true, data: { conversation: conv, resolutionId } };
  },

  'POST /api/conversations/:id/resolve': async (req, params) => {
    const conv = conversations.get(params.id);
    if (!conv) return { error: 'Conversation not found', status: 404 };
    const body = await parseBody(req);
    const now = new Date().toISOString();
    conv.state = 'resolved';
    conv.resolvedAt = now;
    conv.updatedAt = now;
    const convMsgs = messages.get(params.id) || [];
    convMsgs.push({ id: generateId('msg'), conversationId: params.id, channel: 'internal',
      direction: 'internal', senderType: 'system', content: `Resolved${body.resolutionNotes ? ': ' + body.resolutionNotes : ''}`,
      contentType: 'text', status: 'delivered', createdAt: now });
    messages.set(params.id, convMsgs);
    return { success: true, data: conv };
  },

  'GET /api/customers': () => ({ success: true, data: Array.from(customers.values()), pagination: { page: 1, pageSize: 20, totalItems: customers.size } }),
  'GET /api/customers/:id': (req, params) => {
    const cust = customers.get(params.id);
    if (!cust) return { error: 'Customer not found', status: 404 };
    return { success: true, data: cust };
  },

  'GET /api/resolutions': () => ({ success: true, data: Array.from(resolutions.values()), pagination: { page: 1, pageSize: 20, totalItems: resolutions.size } }),
  'GET /api/resolutions/:id': (req, params) => {
    const res = resolutions.get(params.id);
    if (!res) return { error: 'Resolution not found', status: 404 };
    return { success: true, data: res };
  },

  'PATCH /api/resolutions/:id/status': async (req, params) => {
    const res = resolutions.get(params.id);
    if (!res) return { error: 'Resolution not found', status: 404 };
    const body = await parseBody(req);
    const now = new Date().toISOString();
    const prev = res.status;
    if (body.status) { res.status = body.status; res.timeline.push({ timestamp: now, event: `Status: ${prev} -> ${body.status}` }); }
    if (body.rootCause) res.rootCause = body.rootCause;
    res.updatedAt = now;
    return { success: true, data: res };
  },

  'POST /api/resolutions/:id/resolve': async (req, params) => {
    const res = resolutions.get(params.id);
    if (!res) return { error: 'Resolution not found', status: 404 };
    const now = new Date().toISOString();
    res.status = 'resolved';
    res.resolvedAt = now;
    res.updatedAt = now;
    res.timeline.push({ timestamp: now, event: 'Resolved' });
    return { success: true, data: res };
  },

  'GET /api/analytics/dashboard': () => ({
    success: true, data: {
      overview: { totalConversationsToday: 47, activeConversations: 12, resolvedToday: 35, csat: 4.2 },
      conversationsByChannel: [{ channel: 'web_chat', count: 25 }, { channel: 'email', count: 12 }],
      slaCompliance: { firstResponseCompliance: 94.5, resolutionCompliance: 87.2 },
    }
  }),

  'GET /api/admin/health': () => ({ success: true, data: { status: 'healthy', version: '1.0.0', uptime: process.uptime() } }),
  'GET /api/admin/users': () => ({ success: true, data: Array.from(users.values()).map(u => ({ id: u.id, email: u.email, name: u.name, role: u.role })) }),
  'GET /api': () => ({ name: 'Omnichannel CRM API', version: '1.0.0', endpoints: { auth: '/api/auth', conversations: '/api/conversations' } }),
};

function matchRoute(method, pathname) {
  const key = `${method} ${pathname}`;
  if (routes[key]) return { handler: routes[key], params: {} };
  for (const routeKey of Object.keys(routes)) {
    const [rm, rp] = routeKey.split(' ');
    if (rm !== method) continue;
    const rParts = rp.split('/'), pParts = pathname.split('/');
    if (rParts.length !== pParts.length) continue;
    const params = {};
    let matches = true;
    for (let i = 0; i < rParts.length; i++) {
      if (rParts[i].startsWith(':')) params[rParts[i].slice(1)] = pParts[i];
      else if (rParts[i] !== pParts[i]) { matches = false; break; }
    }
    if (matches) return { handler: routes[routeKey], params };
  }
  return null;
}

// =============================================================================
// TEST RUNNER
// =============================================================================

let authToken = null;
let testsPassed = 0, testsFailed = 0;

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, 'http://localhost:3000');
    const options = { hostname: url.hostname, port: url.port, path: url.pathname + url.search, method,
      headers: { 'Content-Type': 'application/json' } };
    if (authToken) options.headers['Authorization'] = `Bearer ${authToken}`;
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => { try { resolve({ status: res.statusCode, data: JSON.parse(data) }); } catch (e) { resolve({ status: res.statusCode, data }); } });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

const get = (path) => request('GET', path);
const post = (path, body) => request('POST', path, body);
const patch = (path, body) => request('PATCH', path, body);

function log(msg, type = 'info') {
  const prefix = { info: '  ', success: '✅', error: '❌', header: '\n📋', section: '\n  📌' };
  console.log(`${prefix[type] || ''} ${msg}`);
}

function assert(condition, testName) {
  if (condition) { log(testName, 'success'); testsPassed++; }
  else { log(testName, 'error'); testsFailed++; }
}

async function runTests() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('     Omnichannel CRM - Real-World Test Scenarios');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Health Check
  log('Health Check Tests', 'header');
  let res = await get('/health');
  assert(res.status === 200, 'Health endpoint returns 200');
  assert(res.data.success === true, 'Health check successful');

  // Authentication
  log('Authentication Tests', 'header');
  res = await post('/api/auth/login', { email: 'wrong@email.com', password: 'wrong' });
  assert(res.status === 401, 'Invalid credentials return 401');
  res = await post('/api/auth/login', { email: 'admin@company.com', password: 'admin123' });
  assert(res.status === 200, 'Admin login successful');
  assert(res.data.data.token !== undefined, 'Token returned');
  authToken = res.data.data.token;

  // Conversation Workflow
  log('Conversation Workflow Tests', 'header');
  log('Scenario: New Customer Web Chat', 'section');
  res = await post('/api/conversations', { customerName: 'Alice Test', customerEmail: 'alice@test.com',
    channel: 'web_chat', subject: 'Need help with billing', initialMessage: 'Help with my invoice' });
  assert(res.status === 201, 'New conversation created');
  assert(res.data.data.state === 'open', 'Initial state is open');
  const convId = res.data.data.id;

  res = await post(`/api/conversations/${convId}/messages`, { content: 'Happy to help!', direction: 'outbound', senderType: 'agent' });
  assert(res.status === 201, 'Agent message created');

  res = await get(`/api/conversations/${convId}`);
  assert(res.data.data.state === 'awaiting_customer', 'State changed to awaiting_customer');

  res = await post(`/api/conversations/${convId}/messages`, { content: 'I was charged twice', direction: 'inbound', senderType: 'customer' });
  assert(res.status === 201, 'Customer message created');

  res = await post(`/api/conversations/${convId}/resolve`, { resolutionNotes: 'Refund processed' });
  assert(res.status === 200, 'Conversation resolved');
  assert(res.data.data.state === 'resolved', 'State is resolved');

  // Escalation Workflow
  log('Escalation Workflow Tests', 'header');
  log('Scenario: P0 Incident', 'section');
  res = await get('/api/conversations/conv_sample_3');
  assert(res.status === 200, 'P0 conversation exists');
  assert(res.data.data.severity === 'P0', 'Severity is P0');
  assert(res.data.data.state === 'escalated', 'State is escalated');

  res = await get('/api/resolutions/res_sample_1');
  assert(res.status === 200, 'Resolution exists');
  assert(res.data.data.priority === 'P0', 'Resolution priority is P0');

  log('Scenario: Create New Escalation', 'section');
  res = await post('/api/conversations', { customerName: 'Urgent Customer', subject: 'System down!', initialMessage: 'Help!' });
  const urgentId = res.data.data.id;
  res = await post(`/api/conversations/${urgentId}/escalate`, { reason: 'Production outage', createResolution: true });
  assert(res.status === 200, 'Escalation successful');
  assert(res.data.data.resolutionId !== undefined, 'Resolution created');

  // Resolution Workflow
  log('Resolution Workflow Tests', 'header');
  res = await patch('/api/resolutions/res_sample_1/status', { status: 'awaiting_deploy' });
  assert(res.status === 200, 'Status updated');
  assert(res.data.data.status === 'awaiting_deploy', 'Status is awaiting_deploy');

  res = await post('/api/resolutions/res_sample_1/resolve', { resolutionNotes: 'Fixed' });
  assert(res.status === 200, 'Resolution resolved');
  assert(res.data.data.status === 'resolved', 'Status is resolved');

  // Customer Management
  log('Customer Management Tests', 'header');
  res = await get('/api/customers');
  assert(res.status === 200, 'Customers listed');
  assert(res.data.data.length >= 3, 'Sample customers exist');

  res = await get('/api/customers/cust_3');
  assert(res.status === 200, 'Enterprise customer retrieved');
  assert(res.data.data.tier === 'enterprise', 'Customer tier is enterprise');

  // Analytics
  log('Analytics Tests', 'header');
  res = await get('/api/analytics/dashboard');
  assert(res.status === 200, 'Dashboard data retrieved');
  assert(res.data.data.overview !== undefined, 'Overview exists');

  // Edge Cases
  log('Edge Case Tests', 'header');
  res = await get('/api/conversations/conv_nonexistent');
  assert(res.status === 404, 'Returns 404 for non-existent conversation');
  res = await get('/api/customers/cust_nonexistent');
  assert(res.status === 404, 'Returns 404 for non-existent customer');

  // Admin
  log('Admin Tests', 'header');
  res = await get('/api/admin/health');
  assert(res.status === 200, 'Admin health works');
  res = await get('/api/admin/users');
  assert(res.status === 200, 'Users list retrieved');
  assert(res.data.data.length >= 3, 'Sample users exist');

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(`     Results: ${testsPassed} passed, ${testsFailed} failed`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  return testsFailed === 0;
}

// =============================================================================
// SERVER + TESTS
// =============================================================================

initSampleData();

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const match = matchRoute(req.method, url.pathname);
  if (!match) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: false, error: { code: 'NOT_FOUND', message: `Route not found` } }));
  }
  try {
    const result = await match.handler(req, match.params);
    if (result.error) {
      res.writeHead(result.status || 400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: { code: 'ERROR', message: result.error } }));
    }
    sendJson(res, result, result.status || 200);
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: { code: 'INTERNAL_ERROR', message: error.message } }));
  }
});

server.listen(3000, '0.0.0.0', async () => {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('           Omnichannel CRM - Test Server');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('\n🚀 Server running on port 3000');
  console.log('📋 Test Credentials: admin@company.com / admin123');
  console.log(`📊 Sample Data: ${customers.size} customers, ${conversations.size} conversations, ${resolutions.size} resolutions\n`);

  // Run tests after server starts
  setTimeout(async () => {
    const success = await runTests();
    server.close();
    process.exit(success ? 0 : 1);
  }, 500);
});
