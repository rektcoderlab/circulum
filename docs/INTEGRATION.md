# Circulum Integration Guide

This guide provides comprehensive information for external developers integrating with the Circulum decentralized subscription management system.

## Overview

Circulum provides a robust API and webhook system that allows external applications to:
- Create and manage subscription plans
- Handle subscriber management
- Process recurring payments
- Receive real-time notifications via webhooks
- Access analytics and reporting data

## Getting Started

### 1. API Access

To integrate with Circulum, you'll need:
- A Solana wallet with sufficient SOL for transaction fees
- An API key for authenticated requests
- A webhook endpoint (optional, for real-time notifications)

### 2. Base URL

```
Production: https://api.circulum.io
Development: http://localhost:3000/api
```

### 3. Authentication

Circulum uses API key authentication. Include your API key in the Authorization header:

```
Authorization: Bearer sk_live_your_api_key_here
```

## Quick Integration

### Step 1: Validate Your Setup

```bash
curl -X POST https://api.circulum.io/integration/validate \
  -H "Content-Type: application/json" \
  -d '{
    "publicKey": "your-solana-public-key",
    "network": "mainnet-beta"
  }'
```

### Step 2: Create an API Key

```bash
curl -X POST https://api.circulum.io/integration/api-keys \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Integration",
    "permissions": ["plans:read", "plans:write", "subscriptions:read", "subscriptions:write"],
    "rateLimit": 1000
  }'
```

### Step 3: Create Your First Subscription Plan

```bash
curl -X POST https://api.circulum.io/plans \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "creator": "your-creator-public-key",
    "planId": 1,
    "price": 1000000,
    "intervalSeconds": 2592000,
    "maxSubscribers": 1000,
    "metadataUri": "https://your-domain.com/metadata.json"
  }'
```

## Integration Endpoints

### Integration Info

Get comprehensive integration information including available endpoints, supported tokens, and rate limits.

```http
GET /api/integration/info
```

**Response:**
```json
{
  "success": true,
  "data": {
    "version": "1.0.0",
    "network": "mainnet-beta",
    "programId": "Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS",
    "endpoints": { ... },
    "supportedTokens": [ ... ],
    "webhookEvents": [ ... ],
    "rateLimits": { ... }
  }
}
```

### Setup Validation

Validate your integration setup before going live.

```http
POST /api/integration/validate
```

**Request Body:**
```json
{
  "publicKey": "your-solana-public-key",
  "network": "mainnet-beta"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "publicKey": { "valid": true, "address": "..." },
    "network": { "connected": true, "match": true },
    "account": { "exists": true, "balance": 1.5 },
    "integration": { "ready": true, "recommendations": [] }
  }
}
```

### API Key Management

#### Create API Key

```http
POST /api/integration/api-keys
```

**Request Body:**
```json
{
  "name": "Production Integration",
  "permissions": [
    "plans:read", "plans:write",
    "subscriptions:read", "subscriptions:write",
    "payments:read", "payments:write"
  ],
  "rateLimit": 10000
}
```

#### List API Keys

```http
GET /api/integration/api-keys
```

### Webhook Management

#### Register Webhook

```http
POST /api/integration/webhooks
```

**Request Body:**
```json
{
  "url": "https://your-domain.com/webhook",
  "events": [
    "subscription.created",
    "payment.processed",
    "payment.failed"
  ],
  "secret": "your-webhook-secret"
}
```

#### List Webhooks

```http
GET /api/integration/webhooks
```

### SDK Examples

Get code examples for different programming languages.

```http
GET /api/integration/sdk/javascript
GET /api/integration/sdk/python
GET /api/integration/sdk/curl
```

## Webhooks

Circulum can send real-time notifications to your application via webhooks when important events occur.

### Webhook Events

- `subscription.created` - New subscription created
- `subscription.cancelled` - Subscription cancelled
- `payment.processed` - Payment successfully processed
- `payment.failed` - Payment failed
- `plan.created` - New subscription plan created
- `plan.updated` - Subscription plan updated
- `plan.deactivated` - Subscription plan deactivated

### Webhook Payload

```json
{
  "id": "evt_1234567890",
  "type": "subscription.created",
  "data": {
    "subscriber": "subscriber-public-key",
    "creator": "creator-public-key",
    "planId": 1,
    "isActive": true,
    "nextPayment": 1640995200
  },
  "timestamp": 1640908800,
  "version": "1.0"
}
```

### Webhook Security

All webhooks are signed with HMAC-SHA256. Verify the signature using the `X-Circulum-Signature` header:

```javascript
const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature.replace('sha256=', ''), 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
}
```

### Webhook Headers

- `X-Circulum-Signature`: HMAC signature for verification
- `X-Circulum-Timestamp`: Unix timestamp when webhook was sent
- `X-Circulum-Event-Type`: Type of event
- `X-Circulum-Event-Id`: Unique event identifier

## SDK Libraries

### JavaScript/TypeScript

```bash
npm install @circulum/sdk
```

```javascript
import { CirculumClient } from '@circulum/sdk';

const client = new CirculumClient({
  apiKey: 'your-api-key',
  network: 'mainnet-beta',
  baseUrl: 'https://api.circulum.io'
});

// Create subscription plan
const plan = await client.plans.create({
  creator: 'creator-public-key',
  planId: 1,
  price: 1000000,
  intervalSeconds: 2592000,
  maxSubscribers: 1000,
  metadataUri: 'https://example.com/metadata.json'
});

// Subscribe to plan
const subscription = await client.subscriptions.create({
  subscriber: 'subscriber-public-key',
  creator: 'creator-public-key',
  planId: 1
});
```

### Python

```bash
pip install circulum-sdk
```

```python
from circulum import CirculumClient

client = CirculumClient(
    api_key='your-api-key',
    network='mainnet-beta',
    base_url='https://api.circulum.io'
)

# Create subscription plan
plan = client.plans.create(
    creator='creator-public-key',
    plan_id=1,
    price=1000000,
    interval_seconds=2592000,
    max_subscribers=1000,
    metadata_uri='https://example.com/metadata.json'
)
```

## Error Handling

### HTTP Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `429` - Too Many Requests
- `500` - Internal Server Error

### Error Response Format

```json
{
  "success": false,
  "error": {
    "message": "Invalid subscription plan ID",
    "code": "INVALID_PLAN_ID",
    "details": {
      "planId": 999,
      "creator": "creator-public-key"
    }
  }
}
```

## Rate Limiting

Circulum implements rate limiting to ensure fair usage:

- **Default**: 100 requests per minute
- **Authenticated**: 1,000 requests per minute
- **Premium**: 10,000 requests per minute

Rate limit headers are included in responses:
- `X-RateLimit-Limit`: Request limit per window
- `X-RateLimit-Remaining`: Requests remaining in current window
- `X-RateLimit-Reset`: Time when rate limit resets

## Best Practices

### 1. Error Handling

Always implement proper error handling:

```javascript
try {
  const subscription = await client.subscriptions.create(data);
  console.log('Subscription created:', subscription);
} catch (error) {
  if (error.status === 429) {
    // Rate limited - implement exponential backoff
    await delay(error.retryAfter * 1000);
    // Retry request
  } else {
    console.error('Subscription creation failed:', error.message);
  }
}
```

### 2. Webhook Verification

Always verify webhook signatures:

```javascript
app.post('/webhook', (req, res) => {
  const signature = req.headers['x-circulum-signature'];
  const payload = JSON.stringify(req.body);
  
  if (!verifyWebhook(payload, signature, webhookSecret)) {
    return res.status(401).send('Invalid signature');
  }
  
  // Process webhook event
  handleWebhookEvent(req.body);
  res.status(200).send('OK');
});
```

### 3. Idempotency

Use idempotent operations where possible:

```javascript
// Use consistent plan IDs to avoid duplicates
const planId = generateConsistentId(creatorId, planName);
const plan = await client.plans.create({
  planId,
  // ... other parameters
});
```

### 4. Monitoring

Monitor your integration:

```javascript
// Get integration metrics
const metrics = await client.integration.getMetrics();
console.log('Success rate:', metrics.successRate);
console.log('Average response time:', metrics.averageResponseTime);
```

## Testing

### Test Environment

Use the development environment for testing:
- Base URL: `http://localhost:3000/api`
- Network: `devnet`
- Use test API keys (prefix: `sk_test_`)

### Integration Testing

```bash
# Test your integration setup
curl -X POST http://localhost:3000/api/integration/test \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk_test_your_key" \
  -d '{
    "endpoint": "/api/plans",
    "method": "POST",
    "data": { ... }
  }'
```

### Webhook Testing

Test webhook delivery:

```bash
curl -X POST http://localhost:3000/api/integration/webhooks/test \
  -H "Authorization: Bearer your-api-key" \
  -d '{"webhookId": "webhook_123"}'
```

## Support

### Documentation
- API Reference: `/docs/API.md`
- Deployment Guide: `/docs/DEPLOYMENT.md`

### Community
- GitHub Issues: `https://github.com/your-org/circulum/issues`
- Discord: `https://discord.gg/circulum`
- Email: `support@circulum.io`

### Status Page
Monitor API status: `https://status.circulum.io`

## Migration Guide

### From Other Subscription Services

1. **Export existing data** from your current provider
2. **Map data structure** to Circulum format
3. **Create subscription plans** using Circulum API
4. **Migrate subscribers** with proper consent
5. **Update payment processing** to use Circulum
6. **Test thoroughly** before switching over

### Version Updates

Circulum uses semantic versioning. Breaking changes are communicated via:
- Email notifications to registered developers
- API deprecation headers
- Migration guides for major versions

## Examples

### E-commerce Integration

```javascript
// Create subscription for premium membership
const membershipPlan = await client.plans.create({
  creator: storeWallet,
  planId: generatePlanId('premium-membership'),
  price: 9.99 * LAMPORTS_PER_SOL, // $9.99 in SOL
  intervalSeconds: 30 * 24 * 60 * 60, // 30 days
  maxSubscribers: 10000,
  metadataUri: 'https://store.com/premium-metadata.json'
});

// Subscribe customer
const subscription = await client.subscriptions.create({
  subscriber: customerWallet,
  creator: storeWallet,
  planId: membershipPlan.planId
});
```

### Content Creator Platform

```javascript
// Creator sets up subscription tiers
const tiers = [
  { name: 'Basic', price: 5, benefits: ['Monthly content'] },
  { name: 'Premium', price: 15, benefits: ['Weekly content', 'Discord access'] },
  { name: 'VIP', price: 50, benefits: ['Daily content', '1-on-1 calls'] }
];

for (const tier of tiers) {
  await client.plans.create({
    creator: creatorWallet,
    planId: generatePlanId(tier.name),
    price: tier.price * LAMPORTS_PER_SOL,
    intervalSeconds: 30 * 24 * 60 * 60,
    maxSubscribers: 1000,
    metadataUri: `https://creator.com/tiers/${tier.name}.json`
  });
}
```

### SaaS Application

```javascript
// Monthly SaaS subscription
const saasSubscription = await client.plans.create({
  creator: saasWallet,
  planId: generatePlanId('pro-plan'),
  price: 29.99 * LAMPORTS_PER_SOL,
  intervalSeconds: 30 * 24 * 60 * 60,
  maxSubscribers: 50000,
  metadataUri: 'https://saas.com/plans/pro.json'
});

// Handle payment processing
client.on('payment.processed', (event) => {
  const { subscriber, planId, amount } = event.data;
  
  // Grant access to premium features
  grantPremiumAccess(subscriber);
  
  // Send confirmation email
  sendPaymentConfirmation(subscriber, amount);
});
```

This integration guide provides everything external developers need to successfully integrate with Circulum's decentralized subscription management system.
