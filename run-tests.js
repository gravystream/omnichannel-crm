/**
 * Omnichannel CRM - Real-World Test Scenarios
 * Run with: node run-tests.js
 */

const http = require('http');

const BASE_URL = 'http://localhost:3000';
let authToken = null;

// =============================================================================
// HTTP CLIENT
// =============================================================================

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    if (authToken) {
      options.headers['Authorization'] = `Bearer ${authToken}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

const get = (path) => request('GET', path);
const post = (path, body) => request('POST', path, body);
const patch = (path, body) => request('PATCH', path, body);

// =============================================================================
// TEST UTILITIES
// =============================================================================

let testsPassed = 0;
let testsFailed = 0;

function log(msg, type = 'info') {
  const prefix = {
    info: '  ',
    success: '✅',
    error: '❌',
    header: '\n📋',
    section: '\n  📌',
  };
  console.log(`${prefix[type] || ''} ${msg}`);
}

function assert(condition, testName) {
  if (condition) {
    log(`${testName}`, 'success');
    testsPassed++;
  } else {
    log(`${testName}`, 'error');
    testsFailed++;
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// =============================================================================
// TEST SCENARIOS
// =============================================================================

async function testHealthCheck() {
  log('Health Check Tests', 'header');

  const res = await get('/health');
  assert(res.status === 200, 'Health endpoint returns 200');
  assert(res.data.success === true, 'Health check is successful');
  assert(res.data.data.status === 'healthy', 'Status is healthy');
}

async function testAuthentication() {
  log('Authentication Tests', 'header');

  // Test invalid credentials
  const invalid = await post('/api/auth/login', {
    email: 'wrong@email.com',
    password: 'wrongpass'
  });
  assert(invalid.status === 401, 'Invalid credentials return 401');

  // Test valid admin login
  const admin = await post('/api/auth/login', {
    email: 'admin@company.com',
    password: 'admin123'
  });
  assert(admin.status === 200, 'Admin login successful');
  assert(admin.data.data.token !== undefined, 'Token is returned');
  assert(admin.data.data.user.role === 'admin', 'User role is admin');
  authToken = admin.data.data.token;

  // Test agent login
  const agent = await post('/api/auth/login', {
    email: 'agent@company.com',
    password: 'agent123'
  });
  assert(agent.status === 200, 'Agent login successful');
  assert(agent.data.data.user.role === 'agent', 'User role is agent');

  // Test engineer login
  const engineer = await post('/api/auth/login', {
    email: 'engineer@company.com',
    password: 'engineer123'
  });
  assert(engineer.status === 200, 'Engineer login successful');
  assert(engineer.data.data.user.role === 'engineer', 'User role is engineer');
}

async function testConversationWorkflow() {
  log('Conversation Workflow Tests', 'header');

  log('Scenario: New Customer Creates Web Chat Conversation', 'section');

  // Create new conversation
  const newConv = await post('/api/conversations', {
    customerName: 'Alice Test',
    customerEmail: 'alice@test.com',
    channel: 'web_chat',
    subject: 'Need help with billing',
    initialMessage: 'Hi, I have a question about my latest invoice. Can you help?'
  });

  assert(newConv.status === 201, 'New conversation created');
  assert(newConv.data.data.state === 'open', 'Initial state is open');
  assert(newConv.data.data.currentChannel === 'web_chat', 'Channel is web_chat');
  assert(newConv.data.data.messageCount === 1, 'Has initial message');

  const convId = newConv.data.data.id;

  // Agent responds
  const agentReply = await post(`/api/conversations/${convId}/messages`, {
    content: 'Hello Alice! I\'d be happy to help with your billing question. Can you tell me more about the issue?',
    direction: 'outbound',
    senderType: 'agent',
    senderId: 'user_agent1'
  });

  assert(agentReply.status === 201, 'Agent message created');
  assert(agentReply.data.data.direction === 'outbound', 'Message is outbound');

  // Check conversation state changed
  const convAfterReply = await get(`/api/conversations/${convId}`);
  assert(convAfterReply.data.data.state === 'awaiting_customer', 'State changed to awaiting_customer');
  assert(convAfterReply.data.data.messageCount === 2, 'Message count updated');

  // Customer responds
  const customerReply = await post(`/api/conversations/${convId}/messages`, {
    content: 'Yes, I was charged twice for my subscription this month.',
    direction: 'inbound',
    senderType: 'customer'
  });

  assert(customerReply.status === 201, 'Customer message created');

  // Check state changed back
  const convAfterCustomer = await get(`/api/conversations/${convId}`);
  assert(convAfterCustomer.data.data.state === 'awaiting_agent', 'State changed back to awaiting_agent');

  // Resolve conversation
  const resolved = await post(`/api/conversations/${convId}/resolve`, {
    resolutionNotes: 'Refund processed for duplicate charge'
  });

  assert(resolved.status === 200, 'Conversation resolved');
  assert(resolved.data.data.state === 'resolved', 'State is resolved');
  assert(resolved.data.data.resolvedAt !== undefined, 'Resolution time recorded');
}

async function testEscalationWorkflow() {
  log('Escalation Workflow Tests', 'header');

  log('Scenario: P0 Incident - Customer Payment Stuck', 'section');

  // Check existing P0 conversation
  const p0Conv = await get('/api/conversations/conv_sample_3');
  assert(p0Conv.status === 200, 'P0 conversation exists');
  assert(p0Conv.data.data.severity === 'P0', 'Severity is P0');
  assert(p0Conv.data.data.state === 'escalated', 'State is escalated');
  assert(p0Conv.data.data.sla.breached === true, 'SLA is breached');

  // Check resolution was created
  const resolution = await get('/api/resolutions/res_sample_1');
  assert(resolution.status === 200, 'Resolution exists');
  assert(resolution.data.data.priority === 'P0', 'Resolution priority is P0');
  assert(resolution.data.data.status === 'fix_in_progress', 'Fix is in progress');
  assert(resolution.data.data.slackChannelName !== undefined, 'Slack channel created');
  assert(resolution.data.data.timeline.length >= 4, 'Timeline has events');

  log('Scenario: Create New Escalation', 'section');

  // Create a new conversation that needs escalation
  const newConv = await post('/api/conversations', {
    customerName: 'Urgent Customer',
    customerEmail: 'urgent@enterprise.com',
    channel: 'email',
    subject: 'Production system down!',
    initialMessage: 'Our entire production environment is down! We need immediate help!'
  });

  const convId = newConv.data.data.id;

  // Escalate with resolution creation
  const escalated = await post(`/api/conversations/${convId}/escalate`, {
    reason: 'Production outage affecting enterprise customer',
    createResolution: true,
    priority: 'P0'
  });

  assert(escalated.status === 200, 'Escalation successful');
  assert(escalated.data.data.resolutionId !== undefined, 'Resolution created');

  // Verify resolution
  const newResolution = await get(`/api/resolutions/${escalated.data.data.resolutionId}`);
  assert(newResolution.status === 200, 'New resolution exists');
  assert(newResolution.data.data.status === 'investigating', 'Initial status is investigating');
}

async function testResolutionWorkflow() {
  log('Resolution Workflow Tests', 'header');

  log('Scenario: Engineer Works on P0 Incident', 'section');

  // Get the P0 resolution
  const resolution = await get('/api/resolutions/res_sample_1');
  assert(resolution.status === 200, 'Resolution retrieved');

  // Update status - fix ready for deploy
  const updated = await patch('/api/resolutions/res_sample_1/status', {
    status: 'awaiting_deploy',
    rootCause: 'Database connection pool exhaustion during peak load caused transaction to hang in pending state'
  });

  assert(updated.status === 200, 'Status updated');
  assert(updated.data.data.status === 'awaiting_deploy', 'Status is awaiting_deploy');

  // Update to monitoring
  const monitoring = await patch('/api/resolutions/res_sample_1/status', {
    status: 'monitoring'
  });

  assert(monitoring.status === 200, 'Status updated to monitoring');

  // Resolve
  const resolved = await post('/api/resolutions/res_sample_1/resolve', {
    resolutionNotes: 'Increased connection pool size from 50 to 200. Stuck transaction released.',
    preventionMeasures: 'Added connection pool monitoring and auto-scaling'
  });

  assert(resolved.status === 200, 'Resolution marked resolved');
  assert(resolved.data.data.status === 'resolved', 'Status is resolved');
  assert(resolved.data.data.resolvedAt !== undefined, 'Resolution time recorded');
}

async function testCustomerManagement() {
  log('Customer Management Tests', 'header');

  // List customers
  const customers = await get('/api/customers');
  assert(customers.status === 200, 'Customers listed');
  assert(customers.data.data.length >= 3, 'Sample customers exist');

  // Get enterprise customer
  const enterprise = await get('/api/customers/cust_3');
  assert(enterprise.status === 200, 'Enterprise customer retrieved');
  assert(enterprise.data.data.tier === 'enterprise', 'Customer tier is enterprise');
  assert(enterprise.data.data.name === 'Bob Wilson', 'Customer name is correct');
}

async function testAnalytics() {
  log('Analytics Tests', 'header');

  const dashboard = await get('/api/analytics/dashboard');
  assert(dashboard.status === 200, 'Dashboard data retrieved');
  assert(dashboard.data.data.overview !== undefined, 'Overview section exists');
  assert(dashboard.data.data.conversationsByChannel !== undefined, 'Channel breakdown exists');
  assert(dashboard.data.data.slaCompliance !== undefined, 'SLA compliance data exists');
}

async function testSLATracking() {
  log('SLA Tracking Tests', 'header');

  // Get conversations by severity
  const p0Convs = await get('/api/conversations?severity=P0');
  assert(p0Convs.status === 200, 'P0 conversations retrieved');

  const p1Convs = await get('/api/conversations?severity=P1');
  assert(p1Convs.status === 200, 'P1 conversations retrieved');

  // Check SLA fields
  const conv = await get('/api/conversations/conv_sample_1');
  assert(conv.data.data.sla !== undefined, 'SLA object exists');
  assert(conv.data.data.sla.firstResponseDueAt !== undefined, 'First response deadline exists');
  assert(conv.data.data.sla.resolutionDueAt !== undefined, 'Resolution deadline exists');
}

async function testEdgeCases() {
  log('Edge Case Tests', 'header');

  // Non-existent conversation
  const notFound = await get('/api/conversations/conv_nonexistent');
  assert(notFound.status === 404, 'Returns 404 for non-existent conversation');

  // Non-existent customer
  const noCustomer = await get('/api/customers/cust_nonexistent');
  assert(noCustomer.status === 404, 'Returns 404 for non-existent customer');

  // Non-existent resolution
  const noResolution = await get('/api/resolutions/res_nonexistent');
  assert(noResolution.status === 404, 'Returns 404 for non-existent resolution');
}

async function testAdminEndpoints() {
  log('Admin Endpoint Tests', 'header');

  const health = await get('/api/admin/health');
  assert(health.status === 200, 'Admin health check works');

  const users = await get('/api/admin/users');
  assert(users.status === 200, 'Users list retrieved');
  assert(users.data.data.length >= 3, 'Sample users exist');
}

// =============================================================================
// RUN ALL TESTS
// =============================================================================

async function runAllTests() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('     Omnichannel CRM - Real-World Test Scenarios');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  try {
    await testHealthCheck();
    await testAuthentication();
    await testConversationWorkflow();
    await testEscalationWorkflow();
    await testResolutionWorkflow();
    await testCustomerManagement();
    await testAnalytics();
    await testSLATracking();
    await testEdgeCases();
    await testAdminEndpoints();

    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`     Results: ${testsPassed} passed, ${testsFailed} failed`);
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');

    if (testsFailed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Test runner error:', error);
    process.exit(1);
  }
}

runAllTests();
