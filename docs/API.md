# Circulum API Documentation

The Circulum API provides RESTful endpoints for interacting with the Circulum decentralized subscription management system.

## Base URL

```
http://localhost:3000/api
```

## Authentication

Currently, the API does not require authentication. In a production environment, you would implement proper authentication and authorization mechanisms.

## Response Format

All API responses follow this format:

```json
{
  "success": boolean,
  "data": object | array,
  "error": {
    "message": string,
    "stack": string (development only)
  }
}
```

## Endpoints

### Health Check

#### GET /health

Check the API server status.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2023-12-01T10:00:00.000Z",
  "version": "0.1.0"
}
```

---

## Subscription Plans

### Create Subscription Plan

#### POST /api/plans

Create a new subscription plan.

**Request Body:**
```json
{
  "creator": "string (Solana public key)",
  "planId": "number",
  "price": "number (in lamports)",
  "intervalSeconds": "number",
  "maxSubscribers": "number",
  "metadataUri": "string (URI)"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "transactionSignature": "string",
    "planId": "number",
    "creator": "string",
    "price": "number",
    "intervalSeconds": "number",
    "maxSubscribers": "number",
    "metadataUri": "string"
  }
}
```

### Get Subscription Plan

#### GET /api/plans/:creator/:planId

Get details of a specific subscription plan.

**Parameters:**
- `creator`: Solana public key of the plan creator
- `planId`: Unique identifier for the plan

**Response:**
```json
{
  "success": true,
  "data": {
    "creator": "string",
    "planId": "number",
    "price": "number",
    "intervalSeconds": "number",
    "maxSubscribers": "number",
    "currentSubscribers": "number",
    "isActive": "boolean",
    "metadataUri": "string",
    "createdAt": "number"
  }
}
```

### Get Creator Plans

#### GET /api/plans/creator/:creator

Get all subscription plans for a specific creator.

**Parameters:**
- `creator`: Solana public key of the creator

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "creator": "string",
      "planId": "number",
      "price": "number",
      "intervalSeconds": "number",
      "maxSubscribers": "number",
      "currentSubscribers": "number",
      "isActive": "boolean",
      "metadataUri": "string",
      "createdAt": "number"
    }
  ]
}
```

### Update Subscription Plan

#### PUT /api/plans/:creator/:planId

Update an existing subscription plan (creator only).

**Parameters:**
- `creator`: Solana public key of the plan creator
- `planId`: Unique identifier for the plan

**Request Body:**
```json
{
  "price": "number (optional)",
  "intervalSeconds": "number (optional)",
  "maxSubscribers": "number (optional)",
  "metadataUri": "string (optional)"
}
```

### Deactivate Subscription Plan

#### DELETE /api/plans/:creator/:planId

Deactivate a subscription plan (creator only).

**Parameters:**
- `creator`: Solana public key of the plan creator
- `planId`: Unique identifier for the plan

---

## Subscriptions

### Subscribe to Plan

#### POST /api/subscriptions

Subscribe to a subscription plan.

**Request Body:**
```json
{
  "subscriber": "string (Solana public key)",
  "creator": "string (Solana public key)",
  "planId": "number"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "transactionSignature": "string",
    "subscriber": "string",
    "creator": "string",
    "planId": "number",
    "message": "Successfully subscribed to plan"
  }
}
```

### Get Subscription Details

#### GET /api/subscriptions/:subscriber/:planId

Get details of a specific subscription.

**Parameters:**
- `subscriber`: Solana public key of the subscriber
- `planId`: Unique identifier for the plan

**Response:**
```json
{
  "success": true,
  "data": {
    "subscriber": "string",
    "planId": "number",
    "creator": "string",
    "isActive": "boolean",
    "lastPayment": "number",
    "nextPayment": "number",
    "totalPayments": "number"
  }
}
```

### Get Subscriber Subscriptions

#### GET /api/subscriptions/subscriber/:subscriber

Get all subscriptions for a specific subscriber.

**Parameters:**
- `subscriber`: Solana public key of the subscriber

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "subscriber": "string",
      "planId": "number",
      "creator": "string",
      "isActive": "boolean",
      "lastPayment": "number",
      "nextPayment": "number",
      "totalPayments": "number"
    }
  ]
}
```

### Cancel Subscription

#### DELETE /api/subscriptions

Cancel a subscription.

**Request Body:**
```json
{
  "subscriber": "string (Solana public key)",
  "creator": "string (Solana public key)",
  "planId": "number"
}
```

### Get Subscription Status

#### GET /api/subscriptions/:subscriber/:planId/status

Check if a subscription payment is due.

**Parameters:**
- `subscriber`: Solana public key of the subscriber
- `planId`: Unique identifier for the plan

**Response:**
```json
{
  "success": true,
  "data": {
    "isActive": "boolean",
    "isPaymentDue": "boolean",
    "nextPayment": "number",
    "timeUntilNextPayment": "number",
    "totalPayments": "number",
    "lastPayment": "number"
  }
}
```

---

## Payments

### Process Payment

#### POST /api/payments/process

Process a recurring payment for a subscription.

**Request Body:**
```json
{
  "subscriber": "string (Solana public key)",
  "creator": "string (Solana public key)",
  "planId": "number",
  "tokenMint": "string (optional, Solana public key)"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "transactionSignature": "string",
    "subscriber": "string",
    "creator": "string",
    "planId": "number",
    "paymentNumber": "number",
    "nextPaymentDue": "number",
    "message": "Payment processed successfully"
  }
}
```

### Get Payment History

#### GET /api/payments/history/:subscriber/:planId

Get payment history for a subscription.

**Parameters:**
- `subscriber`: Solana public key of the subscriber
- `planId`: Unique identifier for the plan

**Response:**
```json
{
  "success": true,
  "data": {
    "subscriber": "string",
    "planId": "number",
    "totalPayments": "number",
    "payments": [
      {
        "paymentNumber": "number",
        "amount": "number",
        "timestamp": "number",
        "transactionSignature": "string"
      }
    ]
  }
}
```

### Get Upcoming Payments

#### GET /api/payments/upcoming/:subscriber

Get upcoming payments for a subscriber.

**Parameters:**
- `subscriber`: Solana public key of the subscriber

**Response:**
```json
{
  "success": true,
  "data": {
    "subscriber": "string",
    "upcomingPayments": [
      {
        "planId": "number",
        "creator": "string",
        "amount": "number",
        "nextPayment": "number",
        "isOverdue": "boolean",
        "daysUntilPayment": "number"
      }
    ],
    "totalUpcoming": "number",
    "overdueCount": "number"
  }
}
```

### Get Creator Payment Statistics

#### GET /api/payments/stats/creator/:creator

Get payment statistics for a creator.

**Parameters:**
- `creator`: Solana public key of the creator

**Response:**
```json
{
  "success": true,
  "data": {
    "creator": "string",
    "totalPlans": "number",
    "totalSubscribers": "number",
    "totalRevenue": "number",
    "monthlyRecurringRevenue": "number",
    "activePlans": "number"
  }
}
```

## Error Codes

- `400` - Bad Request: Invalid request parameters
- `404` - Not Found: Resource not found
- `429` - Too Many Requests: Rate limit exceeded
- `500` - Internal Server Error: Server error

## Rate Limiting

The API implements rate limiting with the following defaults:
- 100 requests per minute per IP address
- Rate limit headers are included in responses

## Examples

### Creating a Subscription Plan

```bash
curl -X POST http://localhost:3000/api/plans \
  -H "Content-Type: application/json" \
  -d '{
    "creator": "11111111111111111111111111111111",
    "planId": 1,
    "price": 1000000,
    "intervalSeconds": 2592000,
    "maxSubscribers": 1000,
    "metadataUri": "https://example.com/metadata.json"
  }'
```

### Subscribing to a Plan

```bash
curl -X POST http://localhost:3000/api/subscriptions \
  -H "Content-Type: application/json" \
  -d '{
    "subscriber": "22222222222222222222222222222222",
    "creator": "11111111111111111111111111111111",
    "planId": 1
  }'
```

### Processing a Payment

```bash
curl -X POST http://localhost:3000/api/payments/process \
  -H "Content-Type: application/json" \
  -d '{
    "subscriber": "22222222222222222222222222222222",
    "creator": "11111111111111111111111111111111",
    "planId": 1
  }'
