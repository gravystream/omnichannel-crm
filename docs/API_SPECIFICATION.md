# API Specification

## Overview

RESTful API with WebSocket support for real-time features. All endpoints require authentication except where noted.

**Base URL**: `https://api.yourcrm.com/v1`

**Authentication**: Bearer token (JWT) in Authorization header

---

## Common Response Formats

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "requestId": "uuid",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human readable message",
    "details": [ ... ]
  },
  "meta": {
    "requestId": "uuid",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

### Pagination
```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "totalItems": 150,
    "totalPages": 8,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

---

## Authentication

### POST /auth/login
Login with email/password.

**Request:**
```json
{
  "email": "agent@company.com",
  "password": "securepassword"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbG...",
    "refreshToken": "eyJhbG...",
    "expiresIn": 3600,
    "user": {
      "id": "uuid",
      "email": "agent@company.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "agent",
      "teamId": "uuid"
    }
  }
}
```

### POST /auth/refresh
Refresh access token.

### POST /auth/logout
Invalidate refresh token.

### GET /auth/me
Get current user profile.

---

## Customers

### GET /customers
List customers with filtering and pagination.

**Query Parameters:**
- `page` (int): Page number
- `pageSize` (int): Items per page (max 100)
- `search` (string): Search in name, email, phone
- `slaTier` (string): Filter by SLA tier
- `tags` (string[]): Filter by tags
- `segments` (string[]): Filter by segments
- `status` (string): active, inactive, blocked

### GET /customers/:id
Get customer by ID with full profile.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "identityGraph": {
      "emails": ["john@example.com"],
      "phoneNumbers": ["+1234567890"],
      "socialIds": { "facebook": "123456" },
      "deviceFingerprints": []
    },
    "profile": {
      "name": "John Doe",
      "company": "Acme Inc",
      "avatarUrl": "https://..."
    },
    "slaTier": "premium",
    "tags": ["vip", "enterprise"],
    "segments": ["high-value"],
    "riskFlags": [],
    "stats": {
      "totalConversations": 15,
      "openConversations": 1,
      "avgResolutionTimeHours": 2.5,
      "lastContactAt": "2024-01-15T10:30:00Z"
    },
    "recentConversations": [ ... ],
    "createdAt": "2023-06-01T00:00:00Z"
  }
}
```

### POST /customers
Create new customer.

### PATCH /customers/:id
Update customer profile.

### POST /customers/:id/merge
Merge another customer into this one.

**Request:**
```json
{
  "sourceCustomerId": "uuid-to-merge"
}
```

### GET /customers/:id/conversations
Get all conversations for a customer.

### GET /customers/:id/timeline
Get unified interaction timeline.

---

## Conversations

### GET /conversations
List conversations with filters.

**Query Parameters:**
- `state` (string[]): Filter by state(s)
- `assignedAgentId` (string): Filter by assigned agent
- `assignedTeamId` (string): Filter by team
- `severity` (string[]): Filter by severity
- `channel` (string[]): Filter by channel
- `slaBreach` (boolean): Filter breached SLAs
- `customerId` (string): Filter by customer
- `tags` (string[]): Filter by tags
- `search` (string): Search in content
- `sortBy` (string): created_at, last_message_at, sla_due_at
- `sortOrder` (string): asc, desc

### GET /conversations/:id
Get conversation with messages.

**Query Parameters:**
- `includeMessages` (boolean): Include messages (default true)
- `messageLimit` (int): Number of messages (default 50)
- `includeNotes` (boolean): Include internal notes
- `includeTimeline` (boolean): Include full timeline

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "customerId": "uuid",
    "customer": {
      "id": "uuid",
      "profile": { "name": "John Doe" },
      "slaTier": "premium"
    },
    "state": "awaiting_agent",
    "channelsUsed": ["web_chat", "email"],
    "currentChannel": "email",
    "assignedAgentId": "uuid",
    "assignedAgent": {
      "id": "uuid",
      "displayName": "Jane Smith"
    },
    "intent": "bug_technical_defect",
    "severity": "P1",
    "sentiment": "negative",
    "sla": {
      "tier": "premium",
      "firstResponseDueAt": "2024-01-15T11:00:00Z",
      "resolutionDueAt": "2024-01-15T18:00:00Z",
      "breached": false,
      "minutesUntilBreach": 45
    },
    "resolutionId": "uuid",
    "subject": "Cannot access my account",
    "summary": "Customer experiencing login issues...",
    "tags": ["login", "authentication"],
    "messageCount": 5,
    "messages": [
      {
        "id": "uuid",
        "channel": "web_chat",
        "direction": "inbound",
        "senderType": "customer",
        "content": "I cannot log into my account",
        "aiAnnotations": {
          "intent": "account_access_issue",
          "sentiment": "negative"
        },
        "createdAt": "2024-01-15T10:00:00Z"
      }
    ],
    "createdAt": "2024-01-15T10:00:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

### POST /conversations
Create new conversation (internal use).

**Request:**
```json
{
  "customerId": "uuid",
  "channel": "web_chat",
  "subject": "Support request",
  "initialMessage": {
    "content": "Hello, I need help",
    "contentType": "text"
  }
}
```

### PATCH /conversations/:id
Update conversation.

**Request:**
```json
{
  "state": "awaiting_customer",
  "tags": ["urgent", "billing"],
  "severity": "P1"
}
```

### POST /conversations/:id/assign
Assign conversation to agent or team.

**Request:**
```json
{
  "agentId": "uuid",
  "teamId": "uuid",
  "reason": "manual_assignment"
}
```

### POST /conversations/:id/transfer
Transfer to another agent/team.

### POST /conversations/:id/escalate
Escalate conversation.

**Request:**
```json
{
  "reason": "Technical issue requires engineering",
  "createResolution": true,
  "issueType": "technical",
  "priority": "P1"
}
```

### POST /conversations/:id/resolve
Resolve conversation.

**Request:**
```json
{
  "resolutionNotes": "Issue resolved by...",
  "sendClosureMessage": true,
  "closureMessageTemplate": "template-id"
}
```

### POST /conversations/:id/reopen
Reopen resolved conversation.

---

## Messages

### GET /conversations/:conversationId/messages
Get messages for conversation.

**Query Parameters:**
- `limit` (int): Number of messages
- `before` (string): Messages before this ID
- `after` (string): Messages after this ID
- `channel` (string[]): Filter by channel
- `direction` (string[]): Filter by direction

### POST /conversations/:conversationId/messages
Send a message.

**Request:**
```json
{
  "channel": "email",
  "content": "Thank you for contacting us...",
  "contentType": "html",
  "attachments": [
    {
      "filename": "instructions.pdf",
      "base64Content": "..."
    }
  ],
  "internal": false
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "conversationId": "uuid",
    "channel": "email",
    "direction": "outbound",
    "senderType": "agent",
    "senderId": "uuid",
    "content": "Thank you for contacting us...",
    "status": "sent",
    "createdAt": "2024-01-15T10:35:00Z"
  }
}
```

### GET /messages/:id
Get single message.

### DELETE /messages/:id
Delete message (soft delete, audit logged).

---

## Resolutions

### GET /resolutions
List resolutions.

**Query Parameters:**
- `status` (string[]): Filter by status
- `owningTeam` (string[]): Filter by team
- `priority` (string[]): Filter by priority
- `issueType` (string[]): Filter by issue type
- `conversationId` (string): Filter by conversation
- `slaBreached` (boolean): Filter breached SLAs
- `ownerId` (string): Filter by owner

### GET /resolutions/:id
Get resolution details.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "conversationId": "uuid",
    "conversation": {
      "id": "uuid",
      "customer": { "profile": { "name": "John Doe" } }
    },
    "issueType": "technical",
    "owningTeam": "engineering",
    "owner": {
      "id": "uuid",
      "displayName": "Jane Engineer"
    },
    "status": "fix_in_progress",
    "priority": "P1",
    "eta": {
      "expectedResolutionAt": "2024-01-16T18:00:00Z",
      "windowHours": 24,
      "lastUpdatedAt": "2024-01-15T14:00:00Z"
    },
    "sla": {
      "startedAt": "2024-01-15T10:00:00Z",
      "elapsedHours": 4.5,
      "breached": false
    },
    "rootCause": "Database connection pool exhaustion",
    "fixDescription": "Increased pool size and added connection timeout",
    "affectedSystems": ["auth-service", "user-db"],
    "swarm": {
      "id": "uuid",
      "slackChannelName": "#incident-20240115-auth",
      "participants": [
        { "displayName": "Jane Engineer", "role": "lead" }
      ]
    },
    "updates": [
      {
        "id": "uuid",
        "updateType": "status_change",
        "content": "Started investigation",
        "authorName": "Jane Engineer",
        "createdAt": "2024-01-15T10:30:00Z"
      }
    ],
    "customerUpdates": [
      {
        "id": "uuid",
        "updateType": "acknowledgement",
        "content": "We've identified the issue...",
        "sentAt": "2024-01-15T10:35:00Z"
      }
    ],
    "createdAt": "2024-01-15T10:00:00Z"
  }
}
```

### POST /resolutions
Create resolution.

**Request:**
```json
{
  "conversationId": "uuid",
  "issueType": "technical",
  "owningTeam": "engineering",
  "priority": "P1",
  "initialNotes": "Customer unable to login...",
  "createSwarm": true
}
```

### PATCH /resolutions/:id
Update resolution.

**Request:**
```json
{
  "status": "fix_in_progress",
  "ownerId": "uuid",
  "rootCause": "Database issue",
  "fixDescription": "Applying patch..."
}
```

### POST /resolutions/:id/update-eta
Update expected resolution time.

**Request:**
```json
{
  "expectedResolutionAt": "2024-01-16T18:00:00Z",
  "reason": "Additional testing required"
}
```

### POST /resolutions/:id/add-update
Add internal or customer update.

**Request:**
```json
{
  "content": "Deployed fix to staging",
  "visibility": "internal",
  "updateType": "note"
}
```

### POST /resolutions/:id/send-customer-update
Send update to customer.

**Request:**
```json
{
  "templateId": "status_update",
  "customContent": "We're making progress...",
  "channel": "email"
}
```

### POST /resolutions/:id/resolve
Mark resolution as resolved.

**Request:**
```json
{
  "fixDescription": "Increased database pool size",
  "rootCause": "Connection pool exhaustion",
  "rootCauseCategory": "infrastructure",
  "sendCustomerNotification": true
}
```

---

## Swarms (Slack Integration)

### GET /swarms
List active swarms.

### GET /swarms/:id
Get swarm details.

### POST /swarms
Create swarm for resolution.

**Request:**
```json
{
  "resolutionId": "uuid",
  "channelPrefix": "incident",
  "initialParticipants": ["user-uuid-1", "user-uuid-2"],
  "leadId": "user-uuid-1"
}
```

### POST /swarms/:id/message
Send message to swarm (synced to Slack).

### POST /swarms/:id/add-participant
Add participant to swarm.

### POST /swarms/:id/close
Close and archive swarm.

---

## Routing

### GET /routing/queue
Get agent's conversation queue.

**Query Parameters:**
- `agentId` (string): Agent ID (default: current user)

**Response:**
```json
{
  "success": true,
  "data": {
    "agentId": "uuid",
    "status": "available",
    "currentCount": 3,
    "maxConcurrent": 5,
    "conversations": [
      {
        "id": "uuid",
        "customerId": "uuid",
        "customerName": "John Doe",
        "state": "awaiting_agent",
        "severity": "P1",
        "currentChannel": "web_chat",
        "lastMessageAt": "2024-01-15T10:30:00Z",
        "slaStatus": {
          "dueAt": "2024-01-15T11:00:00Z",
          "minutesRemaining": 30,
          "status": "warning"
        },
        "unreadCount": 2
      }
    ]
  }
}
```

### POST /routing/assign-next
Get next conversation from queue.

**Request:**
```json
{
  "agentId": "uuid",
  "teamId": "uuid",
  "skills": ["billing", "technical"]
}
```

### PATCH /routing/status
Update agent status.

**Request:**
```json
{
  "status": "available"
}
```

---

## AI Services

### POST /ai/classify
Classify a message.

**Request:**
```json
{
  "content": "I cannot log into my account",
  "conversationContext": {
    "previousMessages": [],
    "customerSlaTier": "premium"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "intent": "account_access_issue",
    "intentConfidence": 0.92,
    "severity": "P1",
    "severityConfidence": 0.85,
    "sentiment": "negative",
    "sentimentScore": -0.6,
    "entities": {
      "accountIds": [],
      "errorCodes": []
    },
    "suggestedAction": "route",
    "suggestedSkills": ["authentication", "account"],
    "escalationRecommended": false,
    "modelVersion": "v1.2.0"
  }
}
```

### POST /ai/suggest-response
Get AI-suggested response.

**Request:**
```json
{
  "conversationId": "uuid",
  "intent": "how_to_guidance"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "suggestedResponse": "To reset your password...",
    "kbArticles": [
      {
        "id": "uuid",
        "title": "How to reset password",
        "relevanceScore": 0.95
      }
    ],
    "confidence": 0.88
  }
}
```

### POST /ai/generate-summary
Generate conversation summary.

### POST /ai/generate-handoff
Generate handoff brief for escalation.

---

## Knowledge Base

### GET /kb/articles
List articles.

**Query Parameters:**
- `search` (string): Full-text search
- `categoryId` (string): Filter by category
- `tags` (string[]): Filter by tags
- `visibility` (string): internal, customer, both
- `status` (string): draft, published, archived

### GET /kb/articles/:id
Get article.

### POST /kb/articles
Create article.

### PATCH /kb/articles/:id
Update article.

### DELETE /kb/articles/:id
Delete article (soft delete).

### GET /kb/categories
List categories.

### POST /kb/search
Search articles with AI.

**Request:**
```json
{
  "query": "how to reset password",
  "visibility": "customer",
  "limit": 5
}
```

---

## Automation

### GET /automation/rules
List automation rules.

### GET /automation/rules/:id
Get rule details.

### POST /automation/rules
Create rule.

**Request:**
```json
{
  "name": "Escalate P0 to Engineering",
  "triggerEvent": "message.classified",
  "conditions": [
    { "field": "severity", "operator": "equals", "value": "P0" },
    { "field": "intent", "operator": "in", "value": ["bug_technical_defect", "transaction_system_failure"] }
  ],
  "actions": [
    { "type": "create_resolution", "params": { "issueType": "technical", "owningTeam": "engineering" } },
    { "type": "notify_slack", "params": { "channel": "#incidents", "message": "P0 escalated: {{conversation.subject}}" } }
  ],
  "priority": 10,
  "enabled": true
}
```

### PATCH /automation/rules/:id
Update rule.

### DELETE /automation/rules/:id
Delete rule.

### POST /automation/rules/:id/test
Test rule with sample data.

---

## Analytics

### GET /analytics/overview
Get dashboard overview.

**Query Parameters:**
- `startDate` (string): Start date
- `endDate` (string): End date
- `teamId` (string): Filter by team

**Response:**
```json
{
  "success": true,
  "data": {
    "period": {
      "start": "2024-01-01",
      "end": "2024-01-31"
    },
    "conversations": {
      "total": 1250,
      "open": 45,
      "resolved": 1180,
      "reopened": 25
    },
    "responseTime": {
      "avgFirstResponseMinutes": 8.5,
      "medianFirstResponseMinutes": 5.2,
      "p95FirstResponseMinutes": 25.3
    },
    "resolutionTime": {
      "avgHours": 3.2,
      "medianHours": 2.1,
      "p95Hours": 12.5
    },
    "sla": {
      "firstResponseCompliance": 0.94,
      "resolutionCompliance": 0.89,
      "breachCount": 55
    },
    "ai": {
      "deflectionRate": 0.42,
      "classificationAccuracy": 0.91,
      "humanOverrideRate": 0.08
    },
    "channels": {
      "web_chat": { "count": 520, "percentage": 0.42 },
      "email": { "count": 480, "percentage": 0.38 },
      "whatsapp": { "count": 150, "percentage": 0.12 },
      "voice": { "count": 100, "percentage": 0.08 }
    },
    "sentiment": {
      "positive": 0.35,
      "neutral": 0.45,
      "negative": 0.20
    }
  }
}
```

### GET /analytics/agents
Agent performance metrics.

### GET /analytics/teams
Team performance metrics.

### GET /analytics/sla
SLA compliance report.

### GET /analytics/ai
AI performance metrics.

### GET /analytics/resolutions
Resolution metrics.

---

## Channels (Admin)

### GET /channels
List configured channels.

### GET /channels/:id
Get channel configuration.

### POST /channels
Add new channel.

### PATCH /channels/:id
Update channel configuration.

### POST /channels/:id/test
Test channel connection.

### DELETE /channels/:id
Remove channel.

---

## SLA (Admin)

### GET /slas
List SLA configurations.

### GET /slas/:id
Get SLA details.

### POST /slas
Create SLA.

### PATCH /slas/:id
Update SLA.

### DELETE /slas/:id
Delete SLA.

---

## Users (Admin)

### GET /users
List users.

### GET /users/:id
Get user.

### POST /users
Create user.

### PATCH /users/:id
Update user.

### DELETE /users/:id
Deactivate user.

### PATCH /users/:id/skills
Update user skills.

### PATCH /users/:id/password
Change password.

---

## Teams (Admin)

### GET /teams
List teams.

### GET /teams/:id
Get team.

### POST /teams
Create team.

### PATCH /teams/:id
Update team.

### DELETE /teams/:id
Delete team.

### GET /teams/:id/members
Get team members.

---

## Webhooks (Inbound)

### POST /webhooks/email/:channelId
Receive email webhook (SendGrid, Mailgun, etc.)

### POST /webhooks/whatsapp/:channelId
WhatsApp Business API webhook.

### POST /webhooks/facebook/:channelId
Facebook Messenger webhook.

### POST /webhooks/twitter/:channelId
Twitter DM webhook.

### POST /webhooks/voice/:channelId
Voice webhook (Twilio).

### POST /webhooks/slack/events
Slack events webhook.

---

## WebSocket Events

### Connection
```javascript
const socket = io('wss://api.yourcrm.com', {
  auth: { token: 'jwt-token' }
});
```

### Events (Server → Client)

#### conversation:new
New conversation assigned.
```json
{
  "conversationId": "uuid",
  "customerId": "uuid",
  "channel": "web_chat",
  "severity": "P1"
}
```

#### conversation:message
New message in conversation.
```json
{
  "conversationId": "uuid",
  "message": { ... }
}
```

#### conversation:state_changed
Conversation state changed.

#### conversation:assigned
Conversation assigned/transferred.

#### resolution:update
Resolution status update.

#### sla:warning
SLA approaching breach.

#### sla:breach
SLA breached.

#### agent:status_changed
Agent status changed.

### Events (Client → Server)

#### conversation:typing
Agent typing indicator.
```json
{
  "conversationId": "uuid",
  "isTyping": true
}
```

#### conversation:read
Mark messages as read.

#### agent:status
Update agent status.

---

## Error Codes

| Code | Description |
|------|-------------|
| UNAUTHORIZED | Invalid or missing authentication |
| FORBIDDEN | Insufficient permissions |
| NOT_FOUND | Resource not found |
| VALIDATION_ERROR | Invalid request data |
| CONFLICT | Resource conflict (e.g., duplicate) |
| RATE_LIMITED | Too many requests |
| INTERNAL_ERROR | Server error |
| SERVICE_UNAVAILABLE | Downstream service unavailable |
| CHANNEL_ERROR | Channel-specific error |
| AI_ERROR | AI service error |

---

## Rate Limits

| Endpoint Type | Limit |
|--------------|-------|
| Standard API | 100 req/min |
| Search | 30 req/min |
| AI endpoints | 20 req/min |
| Webhooks | 1000 req/min |
| WebSocket | 50 msg/sec |

Rate limit headers:
- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`
