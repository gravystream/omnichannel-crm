/**
 * AI Routes - Configuration, Training Data, and Templates
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// In-memory storage for AI configuration
const aiConfig = new Map<string, any>();
const trainingData = new Map<string, any>();
const templates = new Map<string, any>();

// Initialize default AI configuration
function initAIData() {
  // Default AI config
  aiConfig.set('provider', 'openai');
  aiConfig.set('apiKey', '');
  aiConfig.set('model', 'gpt-4');
  aiConfig.set('autoResponse', false);
  aiConfig.set('confidenceThreshold', 0.7);
  aiConfig.set('maxTokens', 1000);
  aiConfig.set('temperature', 0.7);

  // Default templates
  templates.set('greeting', {
    id: 'greeting',
    name: 'Greeting',
    content: 'Hello! How can I help you today?',
    category: 'general',
    createdAt: new Date().toISOString()
  });

  templates.set('closing', {
    id: 'closing',
    name: 'Closing',
    content: 'Is there anything else I can help you with?',
    category: 'general',
    createdAt: new Date().toISOString()
  });
}

initAIData();

// =============================================================================
// AI CONFIGURATION
// =============================================================================

// GET /api/ai/config
router.get('/config', (req: Request, res: Response) => {
  const config: any = {};
  aiConfig.forEach((value, key) => {
    config[key] = value;
  });
  res.json({ success: true, data: config });
});

// POST /api/ai/config
router.post('/config', (req: Request, res: Response) => {
  const { provider, apiKey, model, autoResponse, confidenceThreshold, maxTokens, temperature } = req.body;

  if (provider !== undefined) aiConfig.set('provider', provider);
  if (apiKey !== undefined) aiConfig.set('apiKey', apiKey);
  if (model !== undefined) aiConfig.set('model', model);
  if (autoResponse !== undefined) aiConfig.set('autoResponse', autoResponse);
  if (confidenceThreshold !== undefined) aiConfig.set('confidenceThreshold', confidenceThreshold);
  if (maxTokens !== undefined) aiConfig.set('maxTokens', maxTokens);
  if (temperature !== undefined) aiConfig.set('temperature', temperature);

  aiConfig.set('updatedAt', new Date().toISOString());

  console.log('AI Config saved:', Object.fromEntries(aiConfig));

  res.json({
    success: true,
    message: 'AI configuration saved successfully',
    data: Object.fromEntries(aiConfig)
  });
});

// =============================================================================
// TRAINING DATA / KNOWLEDGE BASE
// =============================================================================

// GET /api/ai/training
router.get('/training', (req: Request, res: Response) => {
  const data = Array.from(trainingData.values());
  res.json({ success: true, data });
});

// POST /api/ai/training
router.post('/training', (req: Request, res: Response) => {
  const { question, answer, category, tags } = req.body;

  if (!question || !answer) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Question and answer are required' }
    });
  }

  const id = `training_${uuidv4().slice(0, 8)}`;
  const item = {
    id,
    question,
    answer,
    category: category || 'general',
    tags: tags || [],
    createdAt: new Date().toISOString()
  };

  trainingData.set(id, item);

  res.status(201).json({ success: true, data: item });
});

// POST /api/ai/training/bulk - Bulk add training data
router.post('/training/bulk', (req: Request, res: Response) => {
  const { items } = req.body;

  if (!items || !Array.isArray(items)) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Items array is required' }
    });
  }

  const added: any[] = [];
  for (const item of items) {
    if (item.question && item.answer) {
      const id = `training_${uuidv4().slice(0, 8)}`;
      const newItem = {
        id,
        question: item.question,
        answer: item.answer,
        category: item.category || 'general',
        tags: item.tags || [],
        createdAt: new Date().toISOString()
      };
      trainingData.set(id, newItem);
      added.push(newItem);
    }
  }

  res.status(201).json({
    success: true,
    message: `Added ${added.length} training items`,
    data: added
  });
});

// PUT /api/ai/training/:id
router.put('/training/:id', (req: Request, res: Response) => {
  const item = trainingData.get(req.params.id);
  if (!item) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Training data not found' }
    });
  }

  const { question, answer, category, tags } = req.body;

  if (question !== undefined) item.question = question;
  if (answer !== undefined) item.answer = answer;
  if (category !== undefined) item.category = category;
  if (tags !== undefined) item.tags = tags;
  item.updatedAt = new Date().toISOString();

  res.json({ success: true, data: item });
});

// DELETE /api/ai/training/:id
router.delete('/training/:id', (req: Request, res: Response) => {
  if (!trainingData.has(req.params.id)) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Training data not found' }
    });
  }

  trainingData.delete(req.params.id);
  res.json({ success: true, message: 'Training data deleted' });
});

// DELETE /api/ai/training - Clear all training data
router.delete('/training', (req: Request, res: Response) => {
  trainingData.clear();
  res.json({ success: true, message: 'All training data cleared' });
});

// =============================================================================
// RESPONSE TEMPLATES
// =============================================================================

// GET /api/ai/templates
router.get('/templates', (req: Request, res: Response) => {
  const data = Array.from(templates.values());
  res.json({ success: true, data });
});

// POST /api/ai/templates
router.post('/templates', (req: Request, res: Response) => {
  const { name, content, category } = req.body;

  if (!name || !content) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Name and content are required' }
    });
  }

  const id = `template_${uuidv4().slice(0, 8)}`;
  const template = {
    id,
    name,
    content,
    category: category || 'general',
    createdAt: new Date().toISOString()
  };

  templates.set(id, template);

  res.status(201).json({ success: true, data: template });
});

// PUT /api/ai/templates/:id
router.put('/templates/:id', (req: Request, res: Response) => {
  const template = templates.get(req.params.id);
  if (!template) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Template not found' }
    });
  }

  const { name, content, category } = req.body;

  if (name !== undefined) template.name = name;
  if (content !== undefined) template.content = content;
  if (category !== undefined) template.category = category;
  template.updatedAt = new Date().toISOString();

  res.json({ success: true, data: template });
});

// DELETE /api/ai/templates/:id
router.delete('/templates/:id', (req: Request, res: Response) => {
  if (!templates.has(req.params.id)) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Template not found' }
    });
  }

  templates.delete(req.params.id);
  res.json({ success: true, message: 'Template deleted' });
});

// =============================================================================
// AI INFERENCE - Test AI responses
// =============================================================================

// POST /api/ai/test
router.post('/test', async (req: Request, res: Response) => {
  const { message } = req.body;
  const provider = aiConfig.get('provider');
  const apiKey = aiConfig.get('apiKey');

  if (!apiKey) {
    return res.status(400).json({
      success: false,
      error: { code: 'CONFIG_ERROR', message: 'API key not configured' }
    });
  }

  // Search training data for relevant answers
  const trainItems = Array.from(trainingData.values());
  const relevantItems = trainItems.filter(item =>
    message.toLowerCase().includes(item.question.toLowerCase().split(' ')[0]) ||
    item.question.toLowerCase().includes(message.toLowerCase().split(' ')[0])
  );

  try {
    if (provider === 'anthropic') {
      // Call Anthropic Claude API
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: aiConfig.get('model') || 'claude-3-sonnet-20240229',
          max_tokens: aiConfig.get('maxTokens') || 1000,
          system: `You are a helpful customer support assistant. Use the following knowledge base to answer questions:\n\n${relevantItems.map(i => `Q: ${i.question}\nA: ${i.answer}`).join('\n\n')}`,
          messages: [
            { role: 'user', content: message }
          ]
        })
      });

      const data = await response.json();

      if (!response.ok) {
        return res.status(response.status).json({
          success: false,
          error: { code: 'API_ERROR', message: data.error?.message || 'API request failed' }
        });
      }

      res.json({
        success: true,
        data: {
          response: data.content?.[0]?.text || 'No response generated',
          provider: 'anthropic',
          model: aiConfig.get('model'),
          knowledgeUsed: relevantItems.length
        }
      });
    } else {
      // Default: OpenAI
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: aiConfig.get('model') || 'gpt-4',
          max_tokens: aiConfig.get('maxTokens') || 1000,
          temperature: aiConfig.get('temperature') || 0.7,
          messages: [
            {
              role: 'system',
              content: `You are a helpful customer support assistant. Use the following knowledge base to answer questions:\n\n${relevantItems.map(i => `Q: ${i.question}\nA: ${i.answer}`).join('\n\n')}`
            },
            { role: 'user', content: message }
          ]
        })
      });

      const data = await response.json();

      if (!response.ok) {
        return res.status(response.status).json({
          success: false,
          error: { code: 'API_ERROR', message: data.error?.message || 'API request failed' }
        });
      }

      res.json({
        success: true,
        data: {
          response: data.choices?.[0]?.message?.content || 'No response generated',
          provider: 'openai',
          model: aiConfig.get('model'),
          knowledgeUsed: relevantItems.length
        }
      });
    }
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    });
  }
});

export default router;
