/**
 * Resolution Routes
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// In-memory storage for demo
const resolutions = new Map<string, any>();
const updates = new Map<string, any[]>();

// Initialize sample resolutions
function initSampleResolutions() {
  const res1 = {
    id: 'res_sample_1',
    conversationId: 'conv_sample_3',
    customerId: 'cust_3',
    title: 'Payment Processing Failure - $10,000 Transaction',
    description: 'Enterprise customer Bob Wilson experienced a stuck transaction during supplier payment. Transaction ID: TXN-2024011500123. Amount: $10,000 USD.',
    issueType: 'transaction_system_failure',
    priority: 'P0',
    status: 'fix_in_progress',
    assignedTeamId: 'team_engineering',
    assignedEngineerId: 'user_eng1',
    slackChannelId: 'C12345INCIDENT',
    slackChannelName: 'incident-txn-stuck-payment',
    rootCause: 'Database connection pool exhaustion during peak load caused transaction to hang in pending state',
    affectedSystems: ['payment-gateway', 'transaction-processor', 'database'],
    timeline: [
      {
        timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
        event: 'Issue reported via WhatsApp'
      },
      {
        timestamp: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
        event: 'Escalated to engineering'
      },
      {
        timestamp: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
        event: 'Slack swarm channel created'
      },
      {
        timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        event: 'Root cause identified: connection pool exhaustion'
      },
      {
        timestamp: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
        event: 'Fix deployed to staging'
      }
    ],
    customerLastUpdatedAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    nextUpdateDueAt: new Date(Date.now() + 40 * 60 * 1000).toISOString(),
    estimatedResolutionAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString()
  };

  resolutions.set(res1.id, res1);

  // Sample updates for resolution
  updates.set('res_sample_1', [
    {
      id: 'update_1',
      resolutionId: 'res_sample_1',
      type: 'status_change',
      previousStatus: 'investigating',
      newStatus: 'fix_in_progress',
      content: 'Root cause identified. Engineering team is deploying a fix to increase connection pool size.',
      isCustomerFacing: true,
      sentToCustomer: true,
      sentToCustomerAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
      authorId: 'user_eng1',
      authorName: 'Engineering Team',
      createdAt: new Date(Date.now() - 20 * 60 * 1000).toISOString()
    },
    {
      id: 'update_2',
      resolutionId: 'res_sample_1',
      type: 'internal_note',
      content: 'Connection pool increased from 50 to 200. Monitoring for 30 minutes before releasing stuck transaction.',
      isCustomerFacing: false,
      authorId: 'user_eng1',
      authorName: 'Mike Engineer',
      createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString()
    }
  ]);
}

initSampleResolutions();

// GET /api/resolutions
router.get('/', (req: Request, res: Response) => {
  const { status, priority, assignedEngineerId, page = '1', pageSize = '20' } = req.query;

  let result = Array.from(resolutions.values());

  // Apply filters
  if (status) {
    const statuses = (status as string).split(',');
    result = result.filter(r => statuses.includes(r.status));
  }

  if (priority) {
    const priorities = (priority as string).split(',');
    result = result.filter(r => priorities.includes(r.priority));
  }

  if (assignedEngineerId) {
    result = result.filter(r => r.assignedEngineerId === assignedEngineerId);
  }

  // Sort by priority and creation time
  result.sort((a, b) => {
    const priorityOrder: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };
    const priDiff = (priorityOrder[a.priority] || 3) - (priorityOrder[b.priority] || 3);
    if (priDiff !== 0) return priDiff;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
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
      totalPages: Math.ceil(result.length / size)
    }
  });
});

// GET /api/resolutions/:id
router.get('/:id', (req: Request, res: Response) => {
  const resolution = resolutions.get(req.params.id);

  if (!resolution) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Resolution not found' }
    });
  }

  const resolutionUpdates = updates.get(req.params.id) || [];

  res.json({
    success: true,
    data: {
      ...resolution,
      updates: resolutionUpdates
    }
  });
});

// POST /api/resolutions
router.post('/', (req: Request, res: Response) => {
  const {
    conversationId,
    customerId,
    title,
    description,
    issueType,
    priority,
    assignedTeamId,
    assignedEngineerId
  } = req.body;

  const id = `res_${uuidv4().slice(0, 8)}`;
  const now = new Date().toISOString();

  const resolution = {
    id,
    conversationId: conversationId || null,
    customerId: customerId || null,
    title: title || 'New Resolution',
    description: description || '',
    issueType: issueType || 'unknown',
    priority: priority || 'P2',
    status: 'investigating',
    assignedTeamId: assignedTeamId || null,
    assignedEngineerId: assignedEngineerId || null,
    slackChannelId: null,
    slackChannelName: null,
    rootCause: null,
    affectedSystems: [],
    timeline: [
      {
        timestamp: now,
        event: 'Resolution created'
      }
    ],
    customerLastUpdatedAt: null,
    nextUpdateDueAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
    estimatedResolutionAt: null,
    createdAt: now,
    updatedAt: now
  };

  resolutions.set(id, resolution);
  updates.set(id, []);

  res.status(201).json({
    success: true,
    data: resolution
  });
});

// POST /api/resolutions/:id/updates
router.post('/:id/updates', (req: Request, res: Response) => {
  const resolution = resolutions.get(req.params.id);

  if (!resolution) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Resolution not found' }
    });
  }

  const { type, content, isCustomerFacing, sendToCustomer } = req.body;
  const now = new Date().toISOString();

  const update = {
    id: `update_${uuidv4().slice(0, 8)}`,
    resolutionId: req.params.id,
    type: type || 'note',
    content: content || '',
    isCustomerFacing: isCustomerFacing || false,
    sentToCustomer: sendToCustomer || false,
    sentToCustomerAt: sendToCustomer ? now : null,
    authorId: 'user_current', // Would come from auth
    authorName: 'Current User',
    createdAt: now
  };

  const resolutionUpdates = updates.get(req.params.id) || [];
  resolutionUpdates.push(update);
  updates.set(req.params.id, resolutionUpdates);

  // Add to timeline
  resolution.timeline.push({
    timestamp: now,
    event: `Update added: ${content.substring(0, 50)}...`
  });

  if (sendToCustomer) {
    resolution.customerLastUpdatedAt = now;
    resolution.nextUpdateDueAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
  }

  resolution.updatedAt = now;

  res.status(201).json({
    success: true,
    data: update
  });
});

// PATCH /api/resolutions/:id/status
router.patch('/:id/status', (req: Request, res: Response) => {
  const resolution = resolutions.get(req.params.id);

  if (!resolution) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Resolution not found' }
    });
  }

  const { status, rootCause, affectedSystems, estimatedResolutionAt } = req.body;
  const now = new Date().toISOString();

  const previousStatus = resolution.status;

  if (status) {
    resolution.status = status;
    resolution.timeline.push({
      timestamp: now,
      event: `Status changed from ${previousStatus} to ${status}`
    });
  }

  if (rootCause) resolution.rootCause = rootCause;
  if (affectedSystems) resolution.affectedSystems = affectedSystems;
  if (estimatedResolutionAt) resolution.estimatedResolutionAt = estimatedResolutionAt;

  resolution.updatedAt = now;

  // Add status change update
  const resolutionUpdates = updates.get(req.params.id) || [];
  resolutionUpdates.push({
    id: `update_${uuidv4().slice(0, 8)}`,
    resolutionId: req.params.id,
    type: 'status_change',
    previousStatus,
    newStatus: status,
    content: `Status changed from ${previousStatus} to ${status}`,
    isCustomerFacing: false,
    authorId: 'user_current',
    authorName: 'Current User',
    createdAt: now
  });
  updates.set(req.params.id, resolutionUpdates);

  res.json({
    success: true,
    data: resolution
  });
});

// POST /api/resolutions/:id/slack-swarm
router.post('/:id/slack-swarm', (req: Request, res: Response) => {
  const resolution = resolutions.get(req.params.id);

  if (!resolution) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Resolution not found' }
    });
  }

  const now = new Date().toISOString();

  // Simulate Slack channel creation
  const channelName = `incident-${resolution.id.slice(-8)}-${resolution.title.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 20)}`;
  const channelId = `C${uuidv4().slice(0, 10).toUpperCase()}`;

  resolution.slackChannelId = channelId;
  resolution.slackChannelName = channelName;
  resolution.updatedAt = now;

  resolution.timeline.push({
    timestamp: now,
    event: `Slack swarm channel created: #${channelName}`
  });

  res.json({
    success: true,
    data: {
      channelId,
      channelName,
      channelUrl: `https://slack.com/app_redirect?channel=${channelId}`
    }
  });
});

// POST /api/resolutions/:id/resolve
router.post('/:id/resolve', (req: Request, res: Response) => {
  const resolution = resolutions.get(req.params.id);

  if (!resolution) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Resolution not found' }
    });
  }

  const { resolutionNotes, preventionMeasures } = req.body;
  const now = new Date().toISOString();

  resolution.status = 'resolved';
  resolution.resolvedAt = now;
  resolution.updatedAt = now;

  resolution.timeline.push({
    timestamp: now,
    event: 'Resolution marked as resolved'
  });

  // Add final update
  const resolutionUpdates = updates.get(req.params.id) || [];
  resolutionUpdates.push({
    id: `update_${uuidv4().slice(0, 8)}`,
    resolutionId: req.params.id,
    type: 'resolved',
    content: resolutionNotes || 'Issue has been resolved.',
    isCustomerFacing: true,
    sentToCustomer: true,
    sentToCustomerAt: now,
    authorId: 'user_current',
    authorName: 'Current User',
    createdAt: now
  });
  updates.set(req.params.id, resolutionUpdates);

  res.json({
    success: true,
    data: resolution
  });
});

export default router;
