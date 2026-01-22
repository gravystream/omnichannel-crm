/**
 * Conversation Routes
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// In-memory storage for demo
const conversations = new Map<string, any>();
const messages = new Map<string, any[]>();

// Initialize with sample data
function initSampleData() {
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

  // Sample messages for conv1
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
        entities: { errorCodes: [] },
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
      content: 'AI Classification: Account Access Issue (P1) - Customer is experiencing login problems. Sentiment: Negative. Suggested action: Route to authentication specialist.',
      contentType: 'text',
      status: 'delivered',
      createdAt: new Date(Date.now() - 9 * 60 * 1000).toISOString(),
    },
  ]);

  // Sample messages for conv3
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
    {
      id: 'msg_3_4',
      conversationId: 'conv_sample_3',
      channel: 'email',
      direction: 'outbound',
      senderType: 'system',
      content: "Update on your issue (Case #RES123): We've identified the issue and our engineering team is actively working on it. Expected resolution: within 1 hour. We'll keep you updated.",
      contentType: 'text',
      status: 'delivered',
      createdAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    },
  ]);
}

initSampleData();

// GET /api/conversations
router.get('/', (req: Request, res: Response) => {
  const { state, severity, assignedAgentId, page = '1', pageSize = '20' } = req.query;

  let result = Array.from(conversations.values());

  // Apply filters
  if (state) {
    const states = (state as string).split(',');
    result = result.filter((c) => states.includes(c.state));
  }

  if (severity) {
    const severities = (severity as string).split(',');
    result = result.filter((c) => severities.includes(c.severity));
  }

  if (assignedAgentId) {
    result = result.filter((c) => c.assignedAgentId === assignedAgentId);
  }

  // Sort by urgency (SLA, severity)
  result.sort((a, b) => {
    // P0 first
    const severityOrder: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };
    const sevDiff = (severityOrder[a.severity] || 3) - (severityOrder[b.severity] || 3);
    if (sevDiff !== 0) return sevDiff;

    // Then by SLA breach
    if (a.sla?.breached && !b.sla?.breached) return -1;
    if (!a.sla?.breached && b.sla?.breached) return 1;

    // Then by last message
    return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
  });

  // Pagination
  const pageNum = parseInt(page as string, 10);
  const size = parseInt(pageSize as string, 10);
  const start = (pageNum - 1) * size;
  const paginatedResult = result.slice(start, start + size);

  res.json({
    success: true,
    data: paginatedResult,
    pagination: {
      page: pageNum,
      pageSize: size,
      totalItems: result.length,
      totalPages: Math.ceil(result.length / size),
    },
  });
});

// GET /api/conversations/:id
router.get('/:id', (req: Request, res: Response) => {
  const conversation = conversations.get(req.params.id);

  if (!conversation) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Conversation not found' },
    });
  }

  const conversationMessages = messages.get(req.params.id) || [];

  res.json({
    success: true,
    data: {
      ...conversation,
      messages: conversationMessages,
    },
  });
});

// POST /api/conversations
router.post('/', (req: Request, res: Response) => {
  const { customerId, customerName, customerEmail, channel, subject, initialMessage } = req.body;

  const id = `conv_${uuidv4().slice(0, 8)}`;
  const now = new Date().toISOString();

  const conversation = {
    id,
    customerId: customerId || `cust_${uuidv4().slice(0, 8)}`,
    customerName: customerName || 'Unknown Customer',
    customerEmail: customerEmail || null,
    state: 'open',
    severity: 'P2',
    sentiment: 'neutral',
    intent: null,
    currentChannel: channel || 'web_chat',
    channelsUsed: [channel || 'web_chat'],
    assignedAgentId: null,
    assignedTeamId: 'team_support',
    subject: subject || 'New conversation',
    tags: [],
    sla: {
      firstResponseDueAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      resolutionDueAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
      breached: false,
    },
    messageCount: initialMessage ? 1 : 0,
    createdAt: now,
    updatedAt: now,
    lastMessageAt: now,
  };

  conversations.set(id, conversation);

  // Add initial message if provided
  if (initialMessage) {
    const msgId = `msg_${uuidv4().slice(0, 8)}`;
    const msg = {
      id: msgId,
      conversationId: id,
      channel: channel || 'web_chat',
      direction: 'inbound',
      senderType: 'customer',
      senderName: customerName || 'Customer',
      content: initialMessage,
      contentType: 'text',
      status: 'delivered',
      createdAt: now,
    };
    messages.set(id, [msg]);
  }

  res.status(201).json({
    success: true,
    data: conversation,
  });
});

// POST /api/conversations/:id/messages
router.post('/:id/messages', (req: Request, res: Response) => {
  const conversation = conversations.get(req.params.id);

  if (!conversation) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Conversation not found' },
    });
  }

  const { content, channel, direction = 'outbound', senderType = 'agent', senderId } = req.body;

  const msgId = `msg_${uuidv4().slice(0, 8)}`;
  const now = new Date().toISOString();

  const message = {
    id: msgId,
    conversationId: req.params.id,
    channel: channel || conversation.currentChannel,
    direction,
    senderType,
    senderId,
    senderName: senderType === 'agent' ? 'Support Agent' : conversation.customerName,
    content,
    contentType: 'text',
    status: 'sent',
    createdAt: now,
  };

  const convMessages = messages.get(req.params.id) || [];
  convMessages.push(message);
  messages.set(req.params.id, convMessages);

  // Update conversation
  conversation.messageCount++;
  conversation.lastMessageAt = now;
  conversation.updatedAt = now;

  if (direction === 'outbound' && senderType === 'agent') {
    conversation.state = 'awaiting_customer';
  } else if (direction === 'inbound' && senderType === 'customer') {
    conversation.state = 'awaiting_agent';
  }

  res.status(201).json({
    success: true,
    data: message,
  });
});

// POST /api/conversations/:id/assign
router.post('/:id/assign', (req: Request, res: Response) => {
  const conversation = conversations.get(req.params.id);

  if (!conversation) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Conversation not found' },
    });
  }

  const { agentId, teamId } = req.body;

  conversation.assignedAgentId = agentId;
  if (teamId) conversation.assignedTeamId = teamId;
  conversation.state = 'awaiting_agent';
  conversation.updatedAt = new Date().toISOString();

  res.json({
    success: true,
    data: conversation,
  });
});

// POST /api/conversations/:id/escalate
router.post('/:id/escalate', (req: Request, res: Response) => {
  const conversation = conversations.get(req.params.id);

  if (!conversation) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Conversation not found' },
    });
  }

  const { reason, createResolution, issueType, priority } = req.body;

  conversation.state = 'escalated';
  conversation.updatedAt = new Date().toISOString();

  let resolutionId = null;
  if (createResolution) {
    resolutionId = `res_${uuidv4().slice(0, 8)}`;
    conversation.resolutionId = resolutionId;
  }

  // Add system message
  const convMessages = messages.get(req.params.id) || [];
  convMessages.push({
    id: `msg_${uuidv4().slice(0, 8)}`,
    conversationId: req.params.id,
    channel: 'internal',
    direction: 'internal',
    senderType: 'system',
    content: `Conversation escalated. Reason: ${reason}${resolutionId ? `. Resolution created: ${resolutionId}` : ''}`,
    contentType: 'text',
    status: 'delivered',
    createdAt: new Date().toISOString(),
  });
  messages.set(req.params.id, convMessages);

  res.json({
    success: true,
    data: {
      conversation,
      resolutionId,
    },
  });
});

// POST /api/conversations/:id/resolve
router.post('/:id/resolve', (req: Request, res: Response) => {
  const conversation = conversations.get(req.params.id);

  if (!conversation) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Conversation not found' },
    });
  }

  const { resolutionNotes } = req.body;

  conversation.state = 'resolved';
  conversation.resolvedAt = new Date().toISOString();
  conversation.updatedAt = new Date().toISOString();

  // Add system message
  const convMessages = messages.get(req.params.id) || [];
  convMessages.push({
    id: `msg_${uuidv4().slice(0, 8)}`,
    conversationId: req.params.id,
    channel: 'internal',
    direction: 'internal',
    senderType: 'system',
    content: `Conversation resolved.${resolutionNotes ? ` Notes: ${resolutionNotes}` : ''}`,
    contentType: 'text',
    status: 'delivered',
    createdAt: new Date().toISOString(),
  });
  messages.set(req.params.id, convMessages);

  res.json({
    success: true,
    data: conversation,
  });
});

export default router;
