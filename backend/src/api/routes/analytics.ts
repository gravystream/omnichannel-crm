/**
 * Analytics Routes
 */

import { Router, Request, Response } from 'express';

const router = Router();

// GET /api/analytics/dashboard
router.get('/dashboard', (req: Request, res: Response) => {
  // Mock dashboard data
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  res.json({
    success: true,
    data: {
      overview: {
        totalConversationsToday: 47,
        totalConversationsYesterday: 52,
        changePercent: -9.6,
        activeConversations: 12,
        awaitingAgent: 5,
        awaitingCustomer: 7,
        resolvedToday: 35,
        avgFirstResponseTime: 180, // seconds
        avgResolutionTime: 3600, // seconds
        csat: 4.2,
        aiDeflectionRate: 0.32
      },
      conversationsByChannel: [
        { channel: 'web_chat', count: 25, percentage: 53.2 },
        { channel: 'email', count: 12, percentage: 25.5 },
        { channel: 'whatsapp', count: 8, percentage: 17.0 },
        { channel: 'voice', count: 2, percentage: 4.3 }
      ],
      conversationsBySeverity: [
        { severity: 'P0', count: 2, percentage: 4.3 },
        { severity: 'P1', count: 8, percentage: 17.0 },
        { severity: 'P2', count: 25, percentage: 53.2 },
        { severity: 'P3', count: 12, percentage: 25.5 }
      ],
      slaCompliance: {
        firstResponseCompliance: 94.5,
        resolutionCompliance: 87.2,
        atRiskConversations: 3,
        breachedConversations: 1
      },
      aiMetrics: {
        totalClassified: 47,
        correctClassifications: 44,
        accuracy: 93.6,
        deflectedByKnowledge: 15,
        escalatedToHuman: 32,
        avgConfidenceScore: 0.84
      },
      topIntents: [
        { intent: 'how_to_guidance', count: 18, percentage: 38.3 },
        { intent: 'account_access_issue', count: 12, percentage: 25.5 },
        { intent: 'transaction_system_failure', count: 8, percentage: 17.0 },
        { intent: 'bug_technical_defect', count: 5, percentage: 10.6 },
        { intent: 'urgent_high_risk', count: 3, percentage: 6.4 },
        { intent: 'noise_low_intent', count: 1, percentage: 2.1 }
      ],
      agentPerformance: [
        {
          agentId: 'user_agent1',
          agentName: 'Sarah Support',
          conversationsHandled: 15,
          avgResponseTime: 120,
          avgResolutionTime: 2400,
          csat: 4.5
        },
        {
          agentId: 'user_agent2',
          agentName: 'Mike Agent',
          conversationsHandled: 12,
          avgResponseTime: 180,
          avgResolutionTime: 3200,
          csat: 4.1
        }
      ],
      hourlyVolume: Array.from({ length: 24 }, (_, hour) => ({
        hour,
        count: Math.floor(Math.random() * 10) + (hour >= 9 && hour <= 17 ? 5 : 0)
      })),
      generatedAt: new Date().toISOString()
    }
  });
});

// GET /api/analytics/conversations
router.get('/conversations', (req: Request, res: Response) => {
  const { startDate, endDate, groupBy = 'day' } = req.query;

  // Generate mock time series data
  const data = [];
  const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const end = endDate ? new Date(endDate as string) : new Date();

  let current = new Date(start);
  while (current <= end) {
    data.push({
      date: current.toISOString().split('T')[0],
      total: Math.floor(Math.random() * 50) + 30,
      resolved: Math.floor(Math.random() * 40) + 20,
      escalated: Math.floor(Math.random() * 5) + 1,
      deflected: Math.floor(Math.random() * 15) + 5
    });
    current.setDate(current.getDate() + 1);
  }

  res.json({
    success: true,
    data: {
      timeSeries: data,
      summary: {
        totalConversations: data.reduce((sum, d) => sum + d.total, 0),
        totalResolved: data.reduce((sum, d) => sum + d.resolved, 0),
        totalEscalated: data.reduce((sum, d) => sum + d.escalated, 0),
        totalDeflected: data.reduce((sum, d) => sum + d.deflected, 0),
        avgPerDay: Math.round(data.reduce((sum, d) => sum + d.total, 0) / data.length)
      }
    }
  });
});

// GET /api/analytics/resolutions
router.get('/resolutions', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      overview: {
        activeResolutions: 3,
        resolvedThisWeek: 12,
        avgTimeToResolve: 28800, // 8 hours in seconds
        mttr: 14400, // Mean Time To Resolve: 4 hours
        recurrenceRate: 0.08
      },
      byStatus: [
        { status: 'investigating', count: 1 },
        { status: 'awaiting_fix', count: 0 },
        { status: 'fix_in_progress', count: 1 },
        { status: 'awaiting_deploy', count: 1 },
        { status: 'monitoring', count: 0 },
        { status: 'resolved', count: 12 }
      ],
      byPriority: [
        { priority: 'P0', count: 1, avgResolutionTime: 7200 },
        { priority: 'P1', count: 2, avgResolutionTime: 14400 },
        { priority: 'P2', count: 8, avgResolutionTime: 28800 },
        { priority: 'P3', count: 4, avgResolutionTime: 86400 }
      ],
      topIssueTypes: [
        { issueType: 'transaction_system_failure', count: 4 },
        { issueType: 'bug_technical_defect', count: 3 },
        { issueType: 'account_access_issue', count: 3 },
        { issueType: 'performance_degradation', count: 2 },
        { issueType: 'data_integrity', count: 1 }
      ],
      slackSwarmMetrics: {
        totalSwarms: 8,
        avgParticipants: 4.5,
        avgTimeToFirstResponse: 180,
        successRate: 0.92
      }
    }
  });
});

// GET /api/analytics/ai-performance
router.get('/ai-performance', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      classification: {
        totalClassified: 1250,
        accuracy: 0.936,
        byIntent: [
          { intent: 'how_to_guidance', total: 475, correct: 458, accuracy: 0.964 },
          { intent: 'account_access_issue', total: 312, correct: 293, accuracy: 0.939 },
          { intent: 'transaction_system_failure', total: 188, correct: 179, accuracy: 0.952 },
          { intent: 'bug_technical_defect', total: 156, correct: 141, accuracy: 0.904 },
          { intent: 'urgent_high_risk', total: 75, correct: 71, accuracy: 0.947 },
          { intent: 'noise_low_intent', total: 44, correct: 38, accuracy: 0.864 }
        ]
      },
      deflection: {
        totalAttempted: 475,
        successfulDeflections: 152,
        deflectionRate: 0.32,
        byReason: [
          { reason: 'knowledge_base_answer', count: 98 },
          { reason: 'self_service_guide', count: 32 },
          { reason: 'faq_match', count: 22 }
        ]
      },
      sentiment: {
        accuracy: 0.89,
        distribution: [
          { sentiment: 'positive', count: 125 },
          { sentiment: 'neutral', count: 750 },
          { sentiment: 'negative', count: 312 },
          { sentiment: 'angry', count: 63 }
        ]
      },
      corrections: {
        totalCorrections: 80,
        byField: [
          { field: 'intent', count: 45 },
          { field: 'severity', count: 22 },
          { field: 'sentiment', count: 13 }
        ],
        correctionRate: 0.064
      },
      responseTime: {
        avgClassificationMs: 450,
        avgDeflectionMs: 1200,
        p95ClassificationMs: 850,
        p99ClassificationMs: 1500
      }
    }
  });
});

// GET /api/analytics/agents
router.get('/agents', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      agents: [
        {
          id: 'user_agent1',
          name: 'Sarah Support',
          status: 'online',
          currentLoad: 5,
          maxLoad: 8,
          metrics: {
            conversationsToday: 15,
            avgFirstResponseTime: 120,
            avgHandleTime: 1800,
            csat: 4.5,
            slaCompliance: 0.96
          },
          skillUtilization: [
            { skill: 'billing', utilization: 0.4 },
            { skill: 'technical', utilization: 0.3 },
            { skill: 'general', utilization: 0.3 }
          ]
        },
        {
          id: 'user_agent2',
          name: 'Mike Agent',
          status: 'online',
          currentLoad: 3,
          maxLoad: 6,
          metrics: {
            conversationsToday: 12,
            avgFirstResponseTime: 180,
            avgHandleTime: 2100,
            csat: 4.1,
            slaCompliance: 0.88
          },
          skillUtilization: [
            { skill: 'technical', utilization: 0.6 },
            { skill: 'general', utilization: 0.4 }
          ]
        }
      ],
      teamSummary: {
        totalAgents: 5,
        onlineAgents: 2,
        totalCapacity: 30,
        currentLoad: 8,
        utilization: 0.27
      }
    }
  });
});

// GET /api/analytics/sla
router.get('/sla', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      overall: {
        firstResponseCompliance: 0.945,
        resolutionCompliance: 0.872,
        totalTracked: 250,
        breached: 18
      },
      byPriority: [
        {
          priority: 'P0',
          firstResponseTarget: 900, // 15 min
          resolutionTarget: 14400, // 4 hours
          firstResponseCompliance: 0.92,
          resolutionCompliance: 0.85,
          count: 12
        },
        {
          priority: 'P1',
          firstResponseTarget: 1800, // 30 min
          resolutionTarget: 28800, // 8 hours
          firstResponseCompliance: 0.94,
          resolutionCompliance: 0.88,
          count: 45
        },
        {
          priority: 'P2',
          firstResponseTarget: 3600, // 1 hour
          resolutionTarget: 86400, // 24 hours
          firstResponseCompliance: 0.96,
          resolutionCompliance: 0.92,
          count: 125
        },
        {
          priority: 'P3',
          firstResponseTarget: 14400, // 4 hours
          resolutionTarget: 259200, // 72 hours
          firstResponseCompliance: 0.98,
          resolutionCompliance: 0.95,
          count: 68
        }
      ],
      atRisk: [
        {
          conversationId: 'conv_sample_1',
          priority: 'P1',
          minutesRemaining: 15,
          slaType: 'first_response'
        }
      ],
      breached: [
        {
          conversationId: 'conv_sample_3',
          priority: 'P0',
          breachedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
          slaType: 'first_response',
          breachDuration: 300
        }
      ]
    }
  });
});

export default router;
