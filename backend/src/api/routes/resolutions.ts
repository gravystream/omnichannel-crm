import { Router, Request, Response } from 'express';
import { resolutionRepository } from '../../repositories/ResolutionRepository';
import { swarmRepository } from '../../repositories/SwarmRepository';
import { getSlackService } from '../../services/SlackService';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const { status, priority, owningTeam, ownerId, page = '1', pageSize = '20' } = req.query;
    const result = await resolutionRepository.find({
      status: status as string,
      priority: priority as string,
      owningTeam: owningTeam as string,
      ownerId: ownerId as string,
      page: parseInt(page as string, 10),
      pageSize: parseInt(pageSize as string, 10),
    });
    res.json({
      success: true,
      data: result.data,
      pagination: {
        page: parseInt(page as string, 10),
        pageSize: parseInt(pageSize as string, 10),
        totalItems: result.total,
        totalPages: Math.ceil(result.total / parseInt(pageSize as string, 10)),
      },
    });
  } catch (error: any) {
    console.error('[Resolutions] Error fetching:', error);
    res.status(500).json({ success: false, error: { code: 'FETCH_ERROR', message: error.message } });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const resolution = await resolutionRepository.getById(req.params.id);
    if (!resolution) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Resolution not found' } });
    }
    const swarm = await swarmRepository.getByResolution(resolution.id);
    const updates = await resolutionRepository.getUpdates(resolution.id);
    res.json({ success: true, data: { ...resolution, swarm, updates } });
  } catch (error: any) {
    console.error('[Resolutions] Error fetching by ID:', error);
    res.status(500).json({ success: false, error: { code: 'FETCH_ERROR', message: error.message } });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { conversationId, issueType, owningTeam, ownerId, priority, title, description, initialNotes } = req.body;
    if (!issueType || !owningTeam || !priority) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'issueType, owningTeam, and priority are required' } });
    }
    const resolution = await resolutionRepository.create({ conversationId, issueType, owningTeam, ownerId, priority, title, description });
    if (initialNotes) {
      await resolutionRepository.addUpdate(resolution.id, 'note', initialNotes, 'system', 'internal', 'app');
    }
    res.status(201).json({ success: true, data: resolution });
  } catch (error: any) {
    console.error('[Resolutions] Error creating:', error);
    res.status(500).json({ success: false, error: { code: 'CREATE_ERROR', message: error.message } });
  }
});

router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const resolution = await resolutionRepository.update(req.params.id, req.body);
    if (!resolution) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Resolution not found' } });
    }
    res.json({ success: true, data: resolution });
  } catch (error: any) {
    console.error('[Resolutions] Error updating:', error);
    res.status(500).json({ success: false, error: { code: 'UPDATE_ERROR', message: error.message } });
  }
});

router.post('/:id/updates', async (req: Request, res: Response) => {
  try {
    const { content, type = 'note', visibility = 'internal', authorId = 'system' } = req.body;
    if (!content) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'content is required' } });
    }
    const resolution = await resolutionRepository.getById(req.params.id);
    if (!resolution) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Resolution not found' } });
    }
    const update = await resolutionRepository.addUpdate(req.params.id, type, content, authorId, visibility, 'app');
    const swarm = await swarmRepository.getByResolution(req.params.id);
    if (swarm) {
      const slackService = getSlackService();
      await slackService.postResolutionUpdate(swarm.slackChannelId, {
        resolutionId: resolution.id,
        status: resolution.status,
        message: content,
        author: authorId,
        isCustomerFacing: visibility === 'customer',
      });
    }
    res.status(201).json({ success: true, data: update });
  } catch (error: any) {
    console.error('[Resolutions] Error adding update:', error);
    res.status(500).json({ success: false, error: { code: 'UPDATE_ERROR', message: error.message } });
  }
});

router.get('/:id/updates', async (req: Request, res: Response) => {
  try {
    const updates = await resolutionRepository.getUpdates(req.params.id);
    res.json({ success: true, data: updates });
  } catch (error: any) {
    console.error('[Resolutions] Error fetching updates:', error);
    res.status(500).json({ success: false, error: { code: 'FETCH_ERROR', message: error.message } });
  }
});

router.post('/:id/slack-swarm', async (req: Request, res: Response) => {
  try {
    const resolution = await resolutionRepository.getById(req.params.id);
    if (!resolution) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Resolution not found' } });
    }
    const existingSwarm = await swarmRepository.getByResolution(resolution.id);
    if (existingSwarm) {
      return res.json({ success: true, data: existingSwarm });
    }
    const slackService = getSlackService();
    const channel = await slackService.createSwarmChannel(
      resolution.id,
      resolution.title || 'Resolution ' + resolution.id,
      resolution.description || resolution.issueType + ' issue - ' + resolution.owningTeam,
      resolution.priority
    );
    if (!channel) {
      return res.status(500).json({ success: false, error: { code: 'SLACK_ERROR', message: 'Failed to create Slack channel' } });
    }
    const swarm = await swarmRepository.create({
      resolutionId: resolution.id,
      slackChannelId: channel.id,
      slackChannelName: channel.name,
      slackChannelUrl: channel.url,
    });
    res.status(201).json({ success: true, data: swarm });
  } catch (error: any) {
    console.error('[Resolutions] Error creating swarm:', error);
    res.status(500).json({ success: false, error: { code: 'SWARM_ERROR', message: error.message } });
  }
});

router.post('/:id/resolve', async (req: Request, res: Response) => {
  try {
    const { resolution: resolutionText, rootCause } = req.body;
    const resolution = await resolutionRepository.update(req.params.id, {
      status: 'resolved',
      resolution: resolutionText,
      rootCause,
      actualResolutionAt: new Date(),
    });
    if (!resolution) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Resolution not found' } });
    }
    await resolutionRepository.addUpdate(req.params.id, 'status_change', 'Resolution marked as resolved', 'system', 'internal', 'app');
    const swarm = await swarmRepository.getByResolution(req.params.id);
    if (swarm) {
      const slackService = getSlackService();
      await slackService.postMessage(swarm.slackChannelId, { text: 'This resolution has been marked as resolved. Channel will be archived.' });
      await slackService.archiveChannel(swarm.slackChannelId);
      await swarmRepository.update(swarm.id, { status: 'archived', archivedAt: new Date() });
    }
    res.json({ success: true, data: resolution });
  } catch (error: any) {
    console.error('[Resolutions] Error resolving:', error);
    res.status(500).json({ success: false, error: { code: 'RESOLVE_ERROR', message: error.message } });
  }
});

export default router;
