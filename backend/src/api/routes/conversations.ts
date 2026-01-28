import { Router, Request, Response } from 'express';
import { resolutionRepository } from '../../repositories/ResolutionRepository';
import { swarmRepository } from '../../repositories/SwarmRepository';
import { getSlackService } from '../../services/SlackService';

const router = Router();

const sampleConversations = [
  { id: 'conv_sample_1', customerId: 'cust_1', channel: 'email', status: 'active', subject: 'Payment issue', createdAt: new Date() },
  { id: 'conv_sample_2', customerId: 'cust_2', channel: 'chat', status: 'active', subject: 'Technical support', createdAt: new Date() },
];

router.get('/', (req: Request, res: Response) => {
  res.json({ success: true, data: sampleConversations });
});

router.get('/:id', (req: Request, res: Response) => {
  const conversation = sampleConversations.find(c => c.id === req.params.id);
  if (!conversation) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Conversation not found' } });
  }
  res.json({ success: true, data: conversation });
});

router.post('/:id/escalate', async (req: Request, res: Response) => {
  try {
    const conversationId = req.params.id;
    const { reason, issueType = 'technical', owningTeam = 'engineering', priority = 'P2', createSwarm = false } = req.body;

    const conversation = sampleConversations.find(c => c.id === conversationId);
    if (!conversation) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Conversation not found' } });
    }

    const existingResolution = await resolutionRepository.getByConversationId(conversationId);
    if (existingResolution) {
      return res.status(409).json({
        success: false,
        error: { code: 'ALREADY_ESCALATED', message: 'Conversation already has an active resolution' },
        data: existingResolution,
      });
    }

    const resolution = await resolutionRepository.create({
      conversationId,
      issueType,
      owningTeam,
      priority,
      title: reason || conversation.subject || 'Escalated issue',
      description: 'Escalated from conversation ' + conversationId,
    });

    await resolutionRepository.addUpdate(resolution.id, 'escalation', 'Escalated from conversation: ' + (reason || 'No reason provided'), 'system', 'internal', 'app');

    let swarm = null;

    if (createSwarm) {
      const slackService = getSlackService();
      const channel = await slackService.createSwarmChannel(
        resolution.id,
        resolution.title || 'Resolution ' + resolution.id,
        resolution.description || issueType + ' issue - ' + owningTeam,
        priority
      );

      if (channel) {
        swarm = await swarmRepository.create({
          resolutionId: resolution.id,
          slackChannelId: channel.id,
          slackChannelName: channel.name,
          slackChannelUrl: channel.url,
        });
      }
    }

    res.status(201).json({ success: true, data: { resolution, swarm } });
  } catch (error: any) {
    console.error('[Conversations] Error escalating:', error);
    res.status(500).json({ success: false, error: { code: 'ESCALATE_ERROR', message: error.message } });
  }
});

export default router;
