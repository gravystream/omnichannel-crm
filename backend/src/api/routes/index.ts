/**
 * API Routes Index
 */

import { Router } from 'express';
import authRoutes from './auth';
import conversationsRoutes from './conversations';
import customersRoutes from './customers';
import resolutionsRoutes from './resolutions';
import analyticsRoutes from './analytics';
import webhooksRoutes from './webhooks';
import adminRoutes from './admin';
import aiRoutes from './ai';
import integrationsRoutes from './integrations';
import agentsRoutes from './agents';

const router = Router();

// Mount routes
router.use('/auth', authRoutes);
router.use('/conversations', conversationsRoutes);
router.use('/customers', customersRoutes);
router.use('/resolutions', resolutionsRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/webhooks', webhooksRoutes);
router.use('/admin', adminRoutes);
router.use('/ai', aiRoutes);
router.use('/integrations', integrationsRoutes);
router.use('/agents', agentsRoutes);

export default router;
