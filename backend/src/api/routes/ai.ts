/**
 * AI Routes - Configuration, Training Data, and Claude Integration
 * The nerve center of the CRM - connects to Claude Opus 4 for intelligent automation
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getPool } from '../../utils/database';
import { knowledgeBaseService } from '../../services/KnowledgeBaseService';

const router = Router();

// =============================================================================
// AI CONFIGURATION (PostgreSQL)
// =============================================================================

// GET /api/ai/config
router.get('/config', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const result = await pool.query('SELECT key, value FROM ai_config');

    const config: Record<string, any> = {
      provider: 'anthropic',
      model: 'claude-opus-4-20250514',
      maxTokens: 4096,
      temperature: 0.3,
      autoResponse: true,
      confidenceThreshold: 0.7,
      enableKnowledgeDeflection: true,
      maxDeflectionAttempts: 2,
      slackEscalationEnabled: true,
      slackChannel: '#support-escalations'
    };

    // Override with database values
    result.rows.forEach(row => {
      try {
        config[row.key] = JSON.parse(row.value);
      } catch {
        config[row.key] = row.value;
      }
    });

    res.json({ success: true, data: config });
  } catch (error: any) {
    console.error('[AI] Error fetching config:', error);
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_ERROR', message: error.message }
    });
  }
});

// POST /api/ai/config
router.post('/config', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const updates = req.body;

    for (const [key, value] of Object.entries(updates)) {
      const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);

      await pool.query(`
        INSERT INTO ai_config (key, value, updated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()
      `, [key, stringValue]);
    }

    // Return updated config
    const result = await pool.query('SELECT key, value FROM ai_config');
    const config: Record<string, any> = {};
    result.rows.forEach(row => {
      try {
        config[row.key] = JSON.parse(row.value);
      } catch {
        config[row.key] = row.value;
      }
    });

    console.log('[AI] Config updated:', Object.keys(updates));

    res.json({
      success: true,
      message: 'AI configuration saved successfully',
      data: config
    });
  } catch (error: any) {
    console.error('[AI] Error saving config:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SAVE_ERROR', message: error.message }
    });
  }
});

// =============================================================================
// AI PROCESSING - The Nerve Center
// =============================================================================

// POST /api/ai/classify - Classify a message (main AI function)
router.post('/classify', async (req: Request, res: Response) => {
  try {
    const { message, conversationId, customerId, channel } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Message is required' }
      });
    }

    const pool = getPool();

    // Get AI config
    const configResult = await pool.query('SELECT key, value FROM ai_config');
    const config: Record<string, any> = {
      provider: 'anthropic',
      model: 'claude-opus-4-20250514',
      maxTokens: 4096,
      temperature: 0.3
    };
    configResult.rows.forEach(row => {
      try { config[row.key] = JSON.parse(row.value); } catch { config[row.key] = row.value; }
    });

    const apiKey = config.apiKey;
    if (!apiKey) {
      return res.status(400).json({
        success: false,
        error: { code: 'CONFIG_ERROR', message: 'Anthropic API key not configured' }
      });
    }

    // Get relevant KB articles for context
    const kbArticles = await knowledgeBaseService.search(message, { limit: 3 });
    const kbContext = kbArticles.length > 0
      ? `\n\nKnowledge Base Articles:\n${kbArticles.map(a => `- ${a.title}: ${a.summary || a.content.substring(0, 200)}`).join('\n')}`
      : '';

    // Build classification prompt
    const systemPrompt = `You are an AI assistant that classifies customer support messages.
Analyze the message and return a JSON response with the following fields:

{
  "intent": "HOW_TO_GUIDANCE" | "ACCOUNT_ACCESS_ISSUE" | "TRANSACTION_SYSTEM_FAILURE" | "BUG_TECHNICAL_DEFECT" | "URGENT_HIGH_RISK" | "NOISE_LOW_INTENT",
  "intentConfidence": 0.0-1.0,
  "severity": "P0" | "P1" | "P2" | "P3",
  "sentiment": "ANGRY" | "NEGATIVE" | "NEUTRAL" | "POSITIVE",
  "sentimentScore": -1.0 to 1.0,
  "suggestedAction": "deflect" | "route" | "escalate" | "resolve",
  "escalationRecommended": boolean,
  "suggestedSkills": ["skill1", "skill2"],
  "suggestedResponse": "Brief helpful response if deflectable",
  "reasoning": "Brief explanation of classification"
}

Guidelines:
- P0 = Critical (security breach, fraud, legal, system down)
- P1 = High (payment failures, account locked, major bugs)
- P2 = Normal (general questions, minor issues)
- P3 = Low (feedback, feature requests, noise)
- Always recommend escalation for ANGRY sentiment or P0/P1 severity
- For HOW_TO_GUIDANCE with matching KB articles, suggest deflection with a helpful response
${kbContext}`;

    // Call Claude API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: config.model || 'claude-opus-4-20250514',
        max_tokens: config.maxTokens || 4096,
        temperature: config.temperature || 0.3,
        system: systemPrompt,
        messages: [{ role: 'user', content: `Classify this customer message:\n\n"${message}"` }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[AI] Claude API error:', data);
      return res.status(response.status).json({
        success: false,
        error: { code: 'API_ERROR', message: data.error?.message || 'Claude API request failed' }
      });
    }

    // Parse Claude's response
    let classification;
    try {
      const content = data.content?.[0]?.text || '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      classification = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch (parseError) {
      console.error('[AI] Parse error:', parseError);
      classification = {
        intent: 'UNKNOWN',
        intentConfidence: 0,
        severity: 'P2',
        sentiment: 'NEUTRAL',
        suggestedAction: 'route',
        escalationRecommended: true,
        reasoning: 'Could not parse AI response'
      };
    }

    // Add KB article suggestions
    if (kbArticles.length > 0 && classification.suggestedAction === 'deflect') {
      classification.suggestedKbArticles = kbArticles.map(a => a.id);
    }

    // Log the AI action
    await pool.query(`
      INSERT INTO ai_actions (conversation_id, action_type, action_data, result, created_at)
      VALUES ($1, 'classify', $2, $3, NOW())
    `, [
      conversationId ? parseInt(conversationId.replace('conv_', '')) : null,
      JSON.stringify({ message: message.substring(0, 500), channel }),
      JSON.stringify(classification)
    ]);

    res.json({
      success: true,
      data: {
        ...classification,
        modelUsed: config.model,
        kbArticlesFound: kbArticles.length
      }
    });
  } catch (error: any) {
    console.error('[AI] Classification error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'CLASSIFICATION_ERROR', message: error.message }
    });
  }
});

// POST /api/ai/respond - Generate AI response
router.post('/respond', async (req: Request, res: Response) => {
  try {
    const { message, conversationId, context, intent } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Message is required' }
      });
    }

    const pool = getPool();

    // Get AI config
    const configResult = await pool.query('SELECT key, value FROM ai_config');
    const config: Record<string, any> = {};
    configResult.rows.forEach(row => {
      try { config[row.key] = JSON.parse(row.value); } catch { config[row.key] = row.value; }
    });

    const apiKey = config.apiKey;
    if (!apiKey) {
      return res.status(400).json({
        success: false,
        error: { code: 'CONFIG_ERROR', message: 'Anthropic API key not configured' }
      });
    }

    // Get relevant KB articles
    const kbArticles = await knowledgeBaseService.search(message, { limit: 5 });

    const systemPrompt = `You are a helpful customer support assistant for GravyStream.
Your role is to help customers with their questions and issues.

Guidelines:
- Be friendly, professional, and concise
- If you can answer from the knowledge base, provide step-by-step guidance
- If you cannot help, offer to connect them with a human agent
- Never make up information or fake solutions
- Always offer escalation as an option at the end

Knowledge Base:
${kbArticles.map(a => `## ${a.title}\n${a.content}`).join('\n\n')}

${context ? `Conversation Context: ${context}` : ''}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: config.model || 'claude-opus-4-20250514',
        max_tokens: config.maxTokens || 2048,
        temperature: 0.7,
        system: systemPrompt,
        messages: [{ role: 'user', content: message }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: { code: 'API_ERROR', message: data.error?.message || 'API request failed' }
      });
    }

    const aiResponse = data.content?.[0]?.text || 'I apologize, but I was unable to generate a response. Let me connect you with a human agent.';

    // Log the action
    await pool.query(`
      INSERT INTO ai_actions (conversation_id, action_type, action_data, result, created_at)
      VALUES ($1, 'respond', $2, $3, NOW())
    `, [
      conversationId ? parseInt(conversationId.replace('conv_', '')) : null,
      JSON.stringify({ message: message.substring(0, 500), intent }),
      JSON.stringify({ response: aiResponse.substring(0, 1000) })
    ]);

    res.json({
      success: true,
      data: {
        response: aiResponse,
        kbArticlesUsed: kbArticles.map(a => a.id)
      }
    });
  } catch (error: any) {
    console.error('[AI] Response generation error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'RESPONSE_ERROR', message: error.message }
    });
  }
});

// POST /api/ai/assign - Auto-assign conversation to agent
router.post('/assign', async (req: Request, res: Response) => {
  try {
    const { conversationId, intent, severity, skills } = req.body;

    const pool = getPool();

    // Find best available agent based on skills and workload
    // This is a simplified matching algorithm
    const agentResult = await pool.query(`
      SELECT a.* FROM agents a
      WHERE a.status = 'online'
      AND a.current_chats < a.max_chats
      ORDER BY a.current_chats ASC
      LIMIT 1
    `);

    let assignedAgent = null;
    if (agentResult.rows.length > 0) {
      assignedAgent = agentResult.rows[0];

      // Update conversation with assigned agent
      if (conversationId) {
        const convId = parseInt(conversationId.replace('conv_', ''));
        await pool.query(`
          UPDATE conversations
          SET assigned_agent_id = $1, status = 'pending', updated_at = NOW()
          WHERE id = $2
        `, [assignedAgent.id, convId]);

        // Update agent's current chat count
        await pool.query(`
          UPDATE agents SET current_chats = current_chats + 1 WHERE id = $1
        `, [assignedAgent.id]);
      }
    }

    // Log the action
    await pool.query(`
      INSERT INTO ai_actions (conversation_id, action_type, action_data, result, created_at)
      VALUES ($1, 'assign', $2, $3, NOW())
    `, [
      conversationId ? parseInt(conversationId.replace('conv_', '')) : null,
      JSON.stringify({ intent, severity, skills }),
      JSON.stringify({ assignedAgentId: assignedAgent?.id, assignedAgentName: assignedAgent?.name })
    ]);

    res.json({
      success: true,
      data: {
        assigned: !!assignedAgent,
        agent: assignedAgent ? {
          id: assignedAgent.id,
          name: assignedAgent.name,
          email: assignedAgent.email
        } : null
      }
    });
  } catch (error: any) {
    console.error('[AI] Assignment error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'ASSIGN_ERROR', message: error.message }
    });
  }
});

// POST /api/ai/escalate-slack - Escalate to Slack
router.post('/escalate-slack', async (req: Request, res: Response) => {
  try {
    const { conversationId, title, description, severity, channel } = req.body;

    const pool = getPool();

    // Get Slack webhook from config
    const configResult = await pool.query("SELECT value FROM ai_config WHERE key = 'slackWebhookUrl'");
    const slackWebhook = configResult.rows[0]?.value;

    if (!slackWebhook) {
      return res.status(400).json({
        success: false,
        error: { code: 'CONFIG_ERROR', message: 'Slack webhook not configured' }
      });
    }

    const severityEmoji = {
      P0: ':rotating_light:',
      P1: ':warning:',
      P2: ':information_source:',
      P3: ':speech_balloon:'
    }[severity] || ':information_source:';

    const slackMessage = {
      text: `${severityEmoji} *${severity} - ${title}*`,
      blocks: [
        {
          type: 'header',
          text: { type: 'plain_text', text: `${severity} - ${title}` }
        },
        {
          type: 'section',
          text: { type: 'mrkdwn', text: description }
        },
        {
          type: 'context',
          elements: [
            { type: 'mrkdwn', text: `*Conversation:* ${conversationId}` },
            { type: 'mrkdwn', text: `*Channel:* ${channel || 'Unknown'}` }
          ]
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: { type: 'plain_text', text: 'View in CRM' },
              url: `https://desk.gravystream.io/inbox/${conversationId}`
            }
          ]
        }
      ]
    };

    const response = await fetch(slackWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(slackMessage)
    });

    if (!response.ok) {
      throw new Error('Slack webhook failed');
    }

    // Log the action
    await pool.query(`
      INSERT INTO ai_actions (conversation_id, action_type, action_data, result, created_at)
      VALUES ($1, 'slack_escalate', $2, $3, NOW())
    `, [
      conversationId ? parseInt(conversationId.replace('conv_', '')) : null,
      JSON.stringify({ title, severity, channel }),
      JSON.stringify({ sent: true })
    ]);

    res.json({
      success: true,
      message: 'Escalated to Slack successfully'
    });
  } catch (error: any) {
    console.error('[AI] Slack escalation error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SLACK_ERROR', message: error.message }
    });
  }
});

// =============================================================================
// AI STATS & MONITORING
// =============================================================================

// GET /api/ai/stats - Get AI performance stats
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const pool = getPool();

    const result = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE action_type = 'classify') as classifications,
        COUNT(*) FILTER (WHERE action_type = 'respond') as responses,
        COUNT(*) FILTER (WHERE action_type = 'assign') as assignments,
        COUNT(*) FILTER (WHERE action_type = 'slack_escalate') as slack_escalations,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as actions_today
      FROM ai_actions
    `);

    const stats = result.rows[0];

    // Get KB article count
    const kbCount = await knowledgeBaseService.getArticleCount();

    res.json({
      success: true,
      data: {
        totalClassifications: parseInt(stats.classifications) || 0,
        totalResponses: parseInt(stats.responses) || 0,
        totalAssignments: parseInt(stats.assignments) || 0,
        slackEscalations: parseInt(stats.slack_escalations) || 0,
        actionsToday: parseInt(stats.actions_today) || 0,
        knowledgeBaseArticles: kbCount
      }
    });
  } catch (error: any) {
    console.error('[AI] Stats error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'STATS_ERROR', message: error.message }
    });
  }
});

// GET /api/ai/actions - Get recent AI actions
router.get('/actions', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const { limit = '50', type } = req.query;

    let query = 'SELECT * FROM ai_actions';
    const values: any[] = [];

    if (type) {
      query += ' WHERE action_type = $1';
      values.push(type);
    }

    query += ' ORDER BY created_at DESC LIMIT $' + (values.length + 1);
    values.push(parseInt(limit as string) || 50);

    const result = await pool.query(query, values);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error: any) {
    console.error('[AI] Actions fetch error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_ERROR', message: error.message }
    });
  }
});

// =============================================================================
// LEGACY ENDPOINTS (backwards compatibility)
// =============================================================================

// POST /api/ai/test - Test AI response (legacy)
router.post('/test', async (req: Request, res: Response) => {
  // Redirect to new respond endpoint
  req.body.context = 'Test message';
  const { message } = req.body;

  const pool = getPool();
  const configResult = await pool.query('SELECT key, value FROM ai_config');
  const config: Record<string, any> = {};
  configResult.rows.forEach(row => {
    try { config[row.key] = JSON.parse(row.value); } catch { config[row.key] = row.value; }
  });

  if (!config.apiKey) {
    return res.status(400).json({
      success: false,
      error: { code: 'CONFIG_ERROR', message: 'API key not configured' }
    });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: config.model || 'claude-opus-4-20250514',
        max_tokens: 1024,
        messages: [{ role: 'user', content: message }]
      })
    });

    const data = await response.json();

    res.json({
      success: true,
      data: {
        response: data.content?.[0]?.text || 'No response',
        provider: 'anthropic',
        model: config.model
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: 'TEST_ERROR', message: error.message }
    });
  }
});

// Training data endpoints (legacy - kept for backwards compatibility)
const trainingData = new Map<string, any>();

router.get('/training', (req: Request, res: Response) => {
  res.json({ success: true, data: Array.from(trainingData.values()) });
});

router.post('/training', (req: Request, res: Response) => {
  const { question, answer, category, tags } = req.body;
  if (!question || !answer) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Question and answer are required' }
    });
  }
  const id = `training_${uuidv4().slice(0, 8)}`;
  const item = { id, question, answer, category: category || 'general', tags: tags || [], createdAt: new Date().toISOString() };
  trainingData.set(id, item);
  res.status(201).json({ success: true, data: item });
});

router.delete('/training/:id', (req: Request, res: Response) => {
  trainingData.delete(req.params.id);
  res.json({ success: true, message: 'Training data deleted' });
});

// Templates endpoints (legacy)
const templates = new Map<string, any>();
templates.set('greeting', { id: 'greeting', name: 'Greeting', content: 'Hello! How can I help you today?', category: 'general' });
templates.set('closing', { id: 'closing', name: 'Closing', content: 'Is there anything else I can help you with?', category: 'general' });

router.get('/templates', (req: Request, res: Response) => {
  res.json({ success: true, data: Array.from(templates.values()) });
});

router.post('/templates', (req: Request, res: Response) => {
  const { name, content, category } = req.body;
  if (!name || !content) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Name and content are required' }
    });
  }
  const id = `template_${uuidv4().slice(0, 8)}`;
  const template = { id, name, content, category: category || 'general', createdAt: new Date().toISOString() };
  templates.set(id, template);
  res.status(201).json({ success: true, data: template });
});

export default router;
