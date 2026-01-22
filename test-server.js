/**
 * Omnichannel CRM - Standalone Test Server
 * A lightweight test server using only Node.js built-in modules
 * Run with: node test-server.js
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
  // Customers
  customers.set('cust_1', {
    id: 'cust_1',
    name: 'John Doe',
    email: 'john@example.com',
    company: 'Acme Corp',
    tier: 'standard',
    createdAt: new Date(Date.now() - 730 * 24 * 60 * 60 * 1000).toISOString(),
  });

  customers.set('cust_2', {
    id: 'cust_2',
    name: 'Jane Smith',
    email: 'jane@example.com',
    company: 'Tech Startup Inc',
    tier: 'standard',
    createdAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
  });

  customers.set('cust_3', {
    id: 'cust_3',
    name: 'Bob Wilson',
    email: 'bob@enterprise.com',
    company: 'Enterprise Global Ltd',
    tier: 'enterprise',
    createdAt: new Date(Date.now() - 1825 * 24 * 60 * 60 * 1000).toISOString(),
  });

  // Conversations
  const conv1 = {
    id: 'conv_sample_1',
    customerId: 'cust_1',
    customerName: 'John Doe',
    customerEmail: 'john@example.com',
    state: 'awaiting_agent',
    severity: 'P1',
    sentiment: 'negative',
    intent: 'account_access_issue',
    currentChannel: 'web_chat',
    channelsUsed: ['web_chat'],
    assignedAgentId: null,
    assignedTeamId: 'team_support',
    subject: 'Cannot login to my account',
    tags: ['login', 'authentication'],
    sla: {
      firstResponseDueAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      resolutionDueAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
      breached: false,
    },
    messageCount: 2,
    createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
    lastMessageAt: new Date().toISOString(),
  };

  const conv2 = {
    id: 'conv_sample_2',
    customerId: 'cust_2',
    customerName: 'Jane Smith',
    customerEmail: 'jane@example.com',
    state: 'open',
    severity: 'P2',
    sentiment: 'neutral',
    intent: 'how_to_guidance',
    currentChannel: 'email',
    channelsUsed: ['email'],
    assignedAgentId: null,
    assignedTeamId: 'team_support',
    subject: 'How to export my data?',
    tags: ['export', 'data'],
    sla: {
      firstResponseDueAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      resolutionDueAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
      breached: false,
    },
    messageCount: 1,
    createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
    lastMessageAt: new Date().toISOString(),
  };

  const conv3 = {
    id: 'conv_sample_3',
    customerId: 'cust_3',
    customerName: 'Bob Wilson',
    customerEmail: 'bob@enterprise.com',
    state: 'escalated',
    severity: 'P0',
    sentiment: 'angry',
    intent: 'transaction_system_failure',
    currentChannel: 'whatsapp',
    channelsUsed: ['whatsapp', 'email'],
    assignedAgentId: 'user_agent1',
    assignedTeamId: 'team_support',
    resolutionId: 'res_sample_1',
    subject: 'Payment failed - $10,000 transaction stuck!',
    tags: ['payment', 'urgent', 'enterprise'],
    sla: {
      firstResponseDueAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      resolutionDueAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      breached: true,
    },
    messageCount: 8,
    createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
    lastMessageAt: new Date().toISOString(),
  };

  conversations.set(conv1.id, conv1);
  conversations.set(conv2.id, conv2);
  conversations.set(conv3.id, conv3);

  // Messages for conv1
  messages.set('conv_sample_1', [
    {
      id: 'msg_1_1',
      conversationId: 'conv_sample_1',
      channel: 'web_chat',
      direction: 'inbound',
      senderType: 'customer',
      senderName: 'John Doe',
      content: "I can't login to my account! I've tried resetting my password 3 times but it's not working. This is really frustrating!",
      contentType: 'text',
      aiAnnotations: {
        intent: 'account_access_issue',
        severity: 'P1',
        sentiment: 'negative',
      },
      status: 'delivered',
      createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    },
    {
      id: 'msg_1_2',
      conversationId: 'conv_sample_1',
      channel: 'web_chat',
      direction: 'internal',
      senderType: 'system',
      content: 'AI Classification: Account Access Issue (P1) - Customer is experiencing login problems. Sentiment: Negative.',
      contentType: 'text',
      status: 'delivered',
      createdAt: new Date(Date.now() - 9 * 60 * 1000).toISOString(),
    },
  ]);

  // Messages for conv3
  messages.set('conv_sample_3', [
    {
      id: 'msg_3_1',
      conversationId: 'conv_sample_3',
      channel: 'whatsapp',
      direction: 'inbound',
      senderType: 'customer',
      senderName: 'Bob Wilson',
      content: "URGENT! I tried to transfer $10,000 to our supplier but the transaction has been stuck for 2 hours! We need this resolved NOW!",
      contentType: 'text',
      aiAnnotations: {
        intent: 'transaction_system_failure',
        severity: 'P0',
        sentiment: 'angry',
        entities: { amounts: [{ value: 10000, currency: 'USD' }] },
      },
      status: 'delivered',
      createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    },
    {
      id: 'msg_3_2',
      conversationId: 'conv_sample_3',
      channel: 'whatsapp',
      direction: 'outbound',
      senderType: 'agent',
      senderId: 'user_agent1',
      senderName: 'Support Agent',
      content: "I understand the urgency, Bob. I'm escalating this to our technical team immediately. Can you share the transaction ID?",
      contentType: 'text',
      status: 'delivered',
      createdAt: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
    },
    {
      id: 'msg_3_3',
      conversationId: 'conv_sample_3',
      channel: 'whatsapp',
      direction: 'inbound',
      senderType: 'customer',
      senderName: 'Bob Wilson',
      content: "TXN-2024011500123. Please hurry, our supplier is waiting!",
      contentType: 'text',
      aiAnnotations: {
        entities: { transactionIds: ['TXN-2024011500123'] },
      },
      status: 'delivered',
      createdAt: new Date(Date.now() - 38 * 60 * 1000).toISOString(),
    },
  ]);

  // Resolution for conv3
  resolutions.set('res_sample_1', {
    id: 'res_sample_1',
    conversationId: 'conv_sample_3',
    customerId: 'cust_3',
    title: 'Payment Processing Failure - $10,000 Transaction',
    description: 'Enterprise customer Bob Wilson experienced a stuck transaction during supplier payment.',
    issueType: 'transaction_system_failure',
    priority: 'P0',
    status: 'fix_in_progress',
    assignedTeamId: 'team_engineering',
    assignedEngineerId: 'user_eng1',
    slackChannelId: 'C12345INCIDENT',
    slackChannelName: 'incident-txn-stuck-payment',
    rootCause: 'Database connection pool exhaustion during peak load',
    affectedSystems: ['payment-gateway', 'transaction-processor', 'database'],
    timeline: [
      { timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(), event: 'Issue reported via WhatsApp' },
      { timestamp: new Date(Date.now() - 40 * 60 * 1000).toISOString(), event: 'Escalated to engineering' },
      { timestamp: new Date(Date.now() - 35 * 60 * 1000).toISOString(), event: 'Slack swarm channel created' },
      { timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(), event: 'Root cause identified' },
      { timestamp: new Date(Date.now() - 20 * 60 * 1000).toISOString(), event: 'Fix deployed to staging' },
    ],
    customerLastUpdatedAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    nextUpdateDueAt: new Date(Date.now() + 40 * 60 * 1000).toISOString(),
    estimatedResolutionAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  });

  console.log('✅ Sample data initialized');
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function generateId(prefix) {
  return `${prefix}_${crypto.randomBytes(4).toString('hex')}`;
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(data, null, 2));
}

function sendError(res, message, code = 'ERROR', status = 400) {
  sendJson(res, { success: false, error: { code, message } }, status);
}

function authenticateToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  return tokens.get(token);
}

// =============================================================================
// ROUTE HANDLERS
// =============================================================================

const routes = {
  // Health Check
  'GET /health': () => ({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0',
    }
  }),

  // Auth
  'POST /api/auth/login': async (req) => {
    const { email, password } = await parseBody(req);
    const user = users.get(email);
    if (!user || user.password !== password) {
      return { error: 'Invalid credentials', status: 401 };
    }
    const token = generateToken();
    tokens.set(token, { userId: user.id, email, role: user.role, name: user.name });
    return {
      success: true,
      data: {
        token,
        user: { id: user.id, email, role: user.role, name: user.name },
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      }
    };
  },

  // Conversations
  'GET /api/conversations': (req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const state = url.searchParams.get('state');
    const severity = url.searchParams.get('severity');

    let result = Array.from(conversations.values());

    if (state) {
      const states = state.split(',');
      result = result.filter(c => states.includes(c.state));
    }

    if (severity) {
      const severities = severity.split(',');
      result = result.filter(c => severities.includes(c.severity));
    }

    // Sort by priority
    result.sort((a, b) => {
      const order = { P0: 0, P1: 1, P2: 2, P3: 3 };
      return (order[a.severity] || 3) - (order[b.severity] || 3);
    });

    return { success: true, data: result, pagination: { page: 1, pageSize: 20, totalItems: result.length } };
  },

  'GET /api/conversations/:id': (req, params) => {
    const conversation = conversations.get(params.id);
    if (!conversation) {
      return { error: 'Conversation not found', status: 404 };
    }
    const conversationMessages = messages.get(params.id) || [];
    return { success: true, data: { ...conversation, messages: conversationMessages } };
  },

  'POST /api/conversations': async (req) => {
    const body = await parseBody(req);
    const id = generateId('conv');
    const now = new Date().toISOString();

    const conversation = {
      id,
      customerId: body.customerId || generateId('cust'),
      customerName: body.customerName || 'Unknown Customer',
      customerEmail: body.customerEmail || null,
      state: 'open',
      severity: 'P2',
      sentiment: 'neutral',
      intent: null,
      currentChannel: body.channel || 'web_chat',
      channelsUsed: [body.channel || 'web_chat'],
      assignedAgentId: null,
      assignedTeamId: 'team_support',
      subject: body.subject || 'New conversation',
      tags: [],
      sla: {
        firstResponseDueAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        resolutionDueAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
        breached: false,
      },
      messageCount: body.initialMessage ? 1 : 0,
      createdAt: now,
      updatedAt: now,
      lastMessageAt: now,
    };

    conversations.set(id, conversation);

    if (body.initialMessage) {
      messages.set(id, [{
        id: generateId('msg'),
        conversationId: id,
        channel: body.channel || 'web_chat',
        direction: 'inbound',
        senderType: 'customer',
        senderName: body.customerName || 'Customer',
        content: body.initialMessage,
        contentType: 'text',
        status: 'delivered',
        createdAt: now,
      }]);
    }

    return { success: true, data: conversation, status: 201 };
  },

  'POST /api/conversations/:id/messages': async (req, params) => {
    const conversation = conversations.get(params.id);
    if (!conversation) {
      return { error: 'Conversation not found', status: 404 };
    }

    const body = await parseBody(req);
    const now = new Date().toISOString();

    const message = {
      id: generateId('msg'),
      conversationId: params.id,
      channel: body.channel || conversation.currentChannel,
      direction: body.direction || 'outbound',
      senderType: body.senderType || 'agent',
      senderId: body.senderId,
      senderName: body.senderType === 'agent' ? 'Support Agent' : conversation.customerName,
      content: body.content,
      contentType: 'text',
      status: 'sent',
      createdAt: now,
    };

    const convMessages = messages.get(params.id) || [];
    convMessages.push(message);
    messages.set(params.id, convMessages);

    conversation.messageCount++;
    conversation.lastMessageAt = now;
    conversation.updatedAt = now;

    if (body.direction === 'outbound' && body.senderType === 'agent') {
      conversation.state = 'awaiting_customer';
    } else if (body.direction === 'inbound' && body.senderType === 'customer') {
      conversation.state = 'awaiting_agent';
    }

    return { success: true, data: message, status: 201 };
  },

  'POST /api/conversations/:id/assign': async (req, params) => {
    const conversation = conversations.get(params.id);
    if (!conversation) {
      return { error: 'Conversation not found', status: 404 };
    }

    const body = await parseBody(req);
    conversation.assignedAgentId = body.agentId;
    if (body.teamId) conversation.assignedTeamId = body.teamId;
    conversation.state = 'awaiting_agent';
    conversation.updatedAt = new Date().toISOString();

    return { success: true, data: conversation };
  },

  'POST /api/conversations/:id/escalate': async (req, params) => {
    const conversation = conversations.get(params.id);
    if (!conversation) {
      return { error: 'Conversation not found', status: 404 };
    }

    const body = await parseBody(req);
    const now = new Date().toISOString();

    conversation.state = 'escalated';
    conversation.updatedAt = now;

    let resolutionId = null;
    if (body.createResolution) {
      resolutionId = generateId('res');
      conversation.resolutionId = resolutionId;

      resolutions.set(resolutionId, {
        id: resolutionId,
        conversationId: params.id,
        customerId: conversation.customerId,
        title: conversation.subject,
        description: body.reason || 'Escalated from conversation',
        issueType: conversation.intent || 'unknown',
        priority: conversation.severity,
        status: 'investigating',
        assignedTeamId: 'team_engineering',
        assignedEngineerId: null,
        timeline: [{ timestamp: now, event: 'Resolution created from escalation' }],
        createdAt: now,
        updatedAt: now,
      });
    }

    const convMessages = messages.get(params.id) || [];
    convMessages.push({
      id: generateId('msg'),
      conversationId: params.id,
      channel: 'internal',
      direction: 'internal',
      senderType: 'system',
      content: `Conversation escalated. Reason: ${body.reason || 'No reason provided'}`,
      contentType: 'text',
      status: 'delivered',
      createdAt: now,
    });
    messages.set(params.id, convMessages);

    return { success: true, data: { conversation, resolutionId } };
  },

  'POST /api/conversations/:id/resolve': async (req, params) => {
    const conversation = conversations.get(params.id);
    if (!conversation) {
      return { error: 'Conversation not found', status: 404 };
    }

    const body = await parseBody(req);
    const now = new Date().toISOString();

    conversation.state = 'resolved';
    conversation.resolvedAt = now;
    conversation.updatedAt = now;

    const convMessages = messages.get(params.id) || [];
    convMessages.push({
      id: generateId('msg'),
      conversationId: params.id,
      channel: 'internal',
      direction: 'internal',
      senderType: 'system',
      content: `Conversation resolved.${body.resolutionNotes ? ` Notes: ${body.resolutionNotes}` : ''}`,
      contentType: 'text',
      status: 'delivered',
      createdAt: now,
    });
    messages.set(params.id, convMessages);

    return { success: true, data: conversation };
  },

  // Customers
  'GET /api/customers': (req) => {
    const result = Array.from(customers.values());
    return { success: true, data: result, pagination: { page: 1, pageSize: 20, totalItems: result.length } };
  },

  'GET /api/customers/:id': (req, params) => {
    const customer = customers.get(params.id);
    if (!customer) {
      return { error: 'Customer not found', status: 404 };
    }
    return { success: true, data: customer };
  },

  // Resolutions
  'GET /api/resolutions': (req) => {
    const result = Array.from(resolutions.values());
    return { success: true, data: result, pagination: { page: 1, pageSize: 20, totalItems: result.length } };
  },

  'GET /api/resolutions/:id': (req, params) => {
    const resolution = resolutions.get(params.id);
    if (!resolution) {
      return { error: 'Resolution not found', status: 404 };
    }
    return { success: true, data: resolution };
  },

  'PATCH /api/resolutions/:id/status': async (req, params) => {
    const resolution = resolutions.get(params.id);
    if (!resolution) {
      return { error: 'Resolution not found', status: 404 };
    }

    const body = await parseBody(req);
    const now = new Date().toISOString();

    const previousStatus = resolution.status;
    if (body.status) {
      resolution.status = body.status;
      resolution.timeline.push({ timestamp: now, event: `Status changed from ${previousStatus} to ${body.status}` });
    }
    if (body.rootCause) resolution.rootCause = body.rootCause;
    if (body.affectedSystems) resolution.affectedSystems = body.affectedSystems;
    resolution.updatedAt = now;

    return { success: true, data: resolution };
  },

  'POST /api/resolutions/:id/resolve': async (req, params) => {
    const resolution = resolutions.get(params.id);
    if (!resolution) {
      return { error: 'Resolution not found', status: 404 };
    }

    const body = await parseBody(req);
    const now = new Date().toISOString();

    resolution.status = 'resolved';
    resolution.resolvedAt = now;
    resolution.updatedAt = now;
    resolution.timeline.push({ timestamp: now, event: 'Resolution marked as resolved' });

    return { success: true, data: resolution };
  },

  // Analytics
  'GET /api/analytics/dashboard': () => ({
    success: true,
    data: {
      overview: {
        totalConversationsToday: 47,
        activeConversations: 12,
        awaitingAgent: 5,
        awaitingCustomer: 7,
        resolvedToday: 35,
        avgFirstResponseTime: 180,
        avgResolutionTime: 3600,
        csat: 4.2,
        aiDeflectionRate: 0.32,
      },
      conversationsByChannel: [
        { channel: 'web_chat', count: 25, percentage: 53.2 },
        { channel: 'email', count: 12, percentage: 25.5 },
        { channel: 'whatsapp', count: 8, percentage: 17.0 },
        { channel: 'voice', count: 2, percentage: 4.3 },
      ],
      slaCompliance: {
        firstResponseCompliance: 94.5,
        resolutionCompliance: 87.2,
        atRiskConversations: 3,
        breachedConversations: 1,
      },
      generatedAt: new Date().toISOString(),
    }
  }),

  // Admin
  'GET /api/admin/health': () => ({
    success: true,
    data: {
      status: 'healthy',
      version: '1.0.0',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      services: {
        database: 'in-memory',
        redis: 'not configured',
        kafka: 'not configured',
        ai: 'local',
      }
    }
  }),

  'GET /api/admin/users': () => {
    const result = Array.from(users.values()).map(u => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
    }));
    return { success: true, data: result };
  },

  // API Info
  'GET /api': () => ({
    name: 'Omnichannel CRM API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      conversations: '/api/conversations',
      customers: '/api/customers',
      resolutions: '/api/resolutions',
      analytics: '/api/analytics',
      admin: '/api/admin',
    },
  }),
};

// =============================================================================
// HTTP SERVER
// =============================================================================

function matchRoute(method, pathname) {
  const key = `${method} ${pathname}`;

  // Exact match
  if (routes[key]) {
    return { handler: routes[key], params: {} };
  }

  // Pattern match for :id
  for (const routeKey of Object.keys(routes)) {
    const [routeMethod, routePath] = routeKey.split(' ');
    if (routeMethod !== method) continue;

    const routeParts = routePath.split('/');
    const pathParts = pathname.split('/');

    if (routeParts.length !== pathParts.length) continue;

    const params = {};
    let matches = true;

    for (let i = 0; i < routeParts.length; i++) {
      if (routeParts[i].startsWith(':')) {
        params[routeParts[i].slice(1)] = pathParts[i];
      } else if (routeParts[i] !== pathParts[i]) {
        matches = false;
        break;
      }
    }

    if (matches) {
      return { handler: routes[routeKey], params };
    }
  }

  return null;
}

const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;
  const method = req.method;

  console.log(`${method} ${pathname}`);

  try {
    const match = matchRoute(method, pathname);

    if (!match) {
      return sendError(res, `Route ${method} ${pathname} not found`, 'NOT_FOUND', 404);
    }

    const result = await match.handler(req, match.params);

    if (result.error) {
      return sendError(res, result.error, result.code || 'ERROR', result.status || 400);
    }

    sendJson(res, result, result.status || 200);
  } catch (error) {
    console.error('Error:', error);
    sendError(res, error.message, 'INTERNAL_ERROR', 500);
  }
});

// =============================================================================
// START SERVER
// =============================================================================

const PORT = process.env.PORT || 3000;

initSampleData();

server.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('           Omnichannel CRM - Test Server');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔗 API: http://localhost:${PORT}/api`);
  console.log(`❤️  Health: http://localhost:${PORT}/health`);
  console.log('');
  console.log('📋 Test Credentials:');
  console.log('   - Admin: admin@company.com / admin123');
  console.log('   - Agent: agent@company.com / agent123');
  console.log('   - Engineer: engineer@company.com / engineer123');
  console.log('');
  console.log('📊 Sample Data Loaded:');
  console.log(`   - ${customers.size} customers`);
  console.log(`   - ${conversations.size} conversations`);
  console.log(`   - ${resolutions.size} resolutions`);
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
});
