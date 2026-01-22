/**
 * Customer Routes
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// In-memory storage for demo
const customers = new Map<string, any>();

// Initialize sample customers
function initSampleCustomers() {
  const cust1 = {
    id: 'cust_1',
    externalId: 'ext_johndoe_123',
    email: 'john@example.com',
    phone: '+1234567890',
    name: 'John Doe',
    avatarUrl: null,
    company: 'Acme Corp',
    tier: 'standard',
    metadata: {
      accountAge: '2 years',
      plan: 'pro',
      lastPurchase: '2024-01-10'
    },
    channelIdentities: [
      { channel: 'web_chat', identifier: 'session_abc123' },
      { channel: 'email', identifier: 'john@example.com' }
    ],
    conversationCount: 5,
    totalMessageCount: 42,
    firstContactAt: new Date(Date.now() - 730 * 24 * 60 * 60 * 1000).toISOString(),
    lastContactAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 730 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString()
  };

  const cust2 = {
    id: 'cust_2',
    externalId: 'ext_janesmith_456',
    email: 'jane@example.com',
    phone: '+0987654321',
    name: 'Jane Smith',
    avatarUrl: null,
    company: 'Tech Startup Inc',
    tier: 'standard',
    metadata: {
      accountAge: '6 months',
      plan: 'starter'
    },
    channelIdentities: [
      { channel: 'email', identifier: 'jane@example.com' }
    ],
    conversationCount: 2,
    totalMessageCount: 8,
    firstContactAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
    lastContactAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString()
  };

  const cust3 = {
    id: 'cust_3',
    externalId: 'ext_bobwilson_789',
    email: 'bob@enterprise.com',
    phone: '+1555123456',
    name: 'Bob Wilson',
    avatarUrl: null,
    company: 'Enterprise Global Ltd',
    tier: 'enterprise',
    metadata: {
      accountAge: '5 years',
      plan: 'enterprise',
      accountManager: 'Sarah',
      annualContractValue: 50000
    },
    channelIdentities: [
      { channel: 'whatsapp', identifier: '+1555123456' },
      { channel: 'email', identifier: 'bob@enterprise.com' }
    ],
    conversationCount: 15,
    totalMessageCount: 234,
    firstContactAt: new Date(Date.now() - 1825 * 24 * 60 * 60 * 1000).toISOString(),
    lastContactAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 1825 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString()
  };

  customers.set(cust1.id, cust1);
  customers.set(cust2.id, cust2);
  customers.set(cust3.id, cust3);
}

initSampleCustomers();

// GET /api/customers
router.get('/', (req: Request, res: Response) => {
  const { search, tier, page = '1', pageSize = '20' } = req.query;

  let result = Array.from(customers.values());

  // Search filter
  if (search) {
    const searchLower = (search as string).toLowerCase();
    result = result.filter(c =>
      c.name.toLowerCase().includes(searchLower) ||
      c.email.toLowerCase().includes(searchLower) ||
      (c.company && c.company.toLowerCase().includes(searchLower))
    );
  }

  // Tier filter
  if (tier) {
    result = result.filter(c => c.tier === tier);
  }

  // Sort by last contact
  result.sort((a, b) => new Date(b.lastContactAt).getTime() - new Date(a.lastContactAt).getTime());

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

// GET /api/customers/:id
router.get('/:id', (req: Request, res: Response) => {
  const customer = customers.get(req.params.id);

  if (!customer) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Customer not found' }
    });
  }

  res.json({
    success: true,
    data: customer
  });
});

// POST /api/customers
router.post('/', (req: Request, res: Response) => {
  const { email, phone, name, company, tier, metadata, channelIdentities } = req.body;

  const id = `cust_${uuidv4().slice(0, 8)}`;
  const now = new Date().toISOString();

  const customer = {
    id,
    externalId: null,
    email: email || null,
    phone: phone || null,
    name: name || 'Unknown Customer',
    avatarUrl: null,
    company: company || null,
    tier: tier || 'standard',
    metadata: metadata || {},
    channelIdentities: channelIdentities || [],
    conversationCount: 0,
    totalMessageCount: 0,
    firstContactAt: now,
    lastContactAt: now,
    createdAt: now,
    updatedAt: now
  };

  customers.set(id, customer);

  res.status(201).json({
    success: true,
    data: customer
  });
});

// PATCH /api/customers/:id
router.patch('/:id', (req: Request, res: Response) => {
  const customer = customers.get(req.params.id);

  if (!customer) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Customer not found' }
    });
  }

  const { email, phone, name, company, tier, metadata } = req.body;

  if (email !== undefined) customer.email = email;
  if (phone !== undefined) customer.phone = phone;
  if (name !== undefined) customer.name = name;
  if (company !== undefined) customer.company = company;
  if (tier !== undefined) customer.tier = tier;
  if (metadata !== undefined) customer.metadata = { ...customer.metadata, ...metadata };
  customer.updatedAt = new Date().toISOString();

  res.json({
    success: true,
    data: customer
  });
});

// GET /api/customers/:id/conversations
router.get('/:id/conversations', (req: Request, res: Response) => {
  const customer = customers.get(req.params.id);

  if (!customer) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Customer not found' }
    });
  }

  // Return empty array for now - in real app would query conversations
  res.json({
    success: true,
    data: [],
    pagination: {
      page: 1,
      pageSize: 20,
      totalItems: 0,
      totalPages: 0
    }
  });
});

// POST /api/customers/:id/merge
router.post('/:id/merge', (req: Request, res: Response) => {
  const primaryCustomer = customers.get(req.params.id);
  const { mergeCustomerId } = req.body;
  const secondaryCustomer = customers.get(mergeCustomerId);

  if (!primaryCustomer) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Primary customer not found' }
    });
  }

  if (!secondaryCustomer) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Secondary customer not found' }
    });
  }

  // Merge channel identities
  primaryCustomer.channelIdentities = [
    ...primaryCustomer.channelIdentities,
    ...secondaryCustomer.channelIdentities
  ];

  // Merge metadata
  primaryCustomer.metadata = { ...secondaryCustomer.metadata, ...primaryCustomer.metadata };

  // Update counts
  primaryCustomer.conversationCount += secondaryCustomer.conversationCount;
  primaryCustomer.totalMessageCount += secondaryCustomer.totalMessageCount;

  // Use earliest first contact
  if (new Date(secondaryCustomer.firstContactAt) < new Date(primaryCustomer.firstContactAt)) {
    primaryCustomer.firstContactAt = secondaryCustomer.firstContactAt;
  }

  primaryCustomer.updatedAt = new Date().toISOString();

  // Remove secondary customer
  customers.delete(mergeCustomerId);

  res.json({
    success: true,
    data: primaryCustomer
  });
});

export default router;
