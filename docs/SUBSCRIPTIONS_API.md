# Subscriptions API Documentation

This document provides comprehensive information on how to retrieve subscription data using API keys with the Circulum API.

## Table of Contents

- [Authentication](#authentication)
- [API Key Requirements](#api-key-requirements)
- [Available Endpoints](#available-endpoints)
- [Request Examples](#request-examples)
- [Response Formats](#response-formats)
- [Error Handling](#error-handling)
- [Code Examples](#code-examples)
- [Rate Limiting](#rate-limiting)
- [Best Practices](#best-practices)

## Authentication

All subscription API endpoints require authentication using an API key. The API key must be included in the `Authorization` header using the Bearer token format.

### Header Format
```
Authorization: Bearer your-api-key-here
```

### Example
```bash
curl -H "Authorization: Bearer sk_live_1234567890abcdef" \
     -H "Content-Type: application/json" \
     "https://api.circulum.com/api/subscriptions/subscriber/9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM"
```

## API Key Requirements

To access subscription endpoints, your API key must have the appropriate permissions:

| Permission | Description | Required For |
|------------|-------------|--------------|
| `subscriptions:read` | Read subscription data | All GET endpoints |
| `subscriptions:write` | Create/modify subscriptions | POST, PUT, DELETE endpoints |

### Creating an API Key

You can create an API key with the required permissions using the integration endpoint:

```bash
curl -X POST "https://api.circulum.com/api/integration/api-keys" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Subscription Reader",
    "permissions": ["subscriptions:read"],
    "rateLimit": 1000
  }'
```

## Available Endpoints

### 1. Get All Subscriptions for a Subscriber

Retrieve all subscriptions associated with a specific subscriber address.

**Endpoint:** `GET /api/subscriptions/subscriber/{subscriber_address}`

**Parameters:**
- `subscriber_address` (path) - The Solana public key of the subscriber

**Response:** Array of subscription objects

### 2. Get Specific Subscription Details

Retrieve details for a specific subscription.

**Endpoint:** `GET /api/subscriptions/{subscriber_address}/{plan_id}`

**Parameters:**
- `subscriber_address` (path) - The Solana public key of the subscriber
- `plan_id` (path) - The numeric ID of the subscription plan

**Response:** Single subscription object

### 3. Get Subscription Status

Check the current status of a subscription, including payment due information.

**Endpoint:** `GET /api/subscriptions/{subscriber_address}/{plan_id}/status`

**Parameters:**
- `subscriber_address` (path) - The Solana public key of the subscriber
- `plan_id` (path) - The numeric ID of the subscription plan

**Response:** Subscription status object

## Request Examples

### Get All Subscriptions for a Subscriber

```bash
curl -X GET "https://api.circulum.com/api/subscriptions/subscriber/9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM" \
  -H "Authorization: Bearer sk_live_1234567890abcdef" \
  -H "Content-Type: application/json"
```

### Get Specific Subscription

```bash
curl -X GET "https://api.circulum.com/api/subscriptions/9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM/1" \
  -H "Authorization: Bearer sk_live_1234567890abcdef" \
  -H "Content-Type: application/json"
```

### Get Subscription Status

```bash
curl -X GET "https://api.circulum.com/api/subscriptions/9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM/1/status" \
  -H "Authorization: Bearer sk_live_1234567890abcdef" \
  -H "Content-Type: application/json"
```

## Response Formats

### Subscription Object

```json
{
  "subscriber": "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
  "planId": 1,
  "creator": "CreatorPublicKeyHere123456789",
  "isActive": true,
  "lastPayment": 1695123456,
  "nextPayment": 1697715456,
  "totalPayments": 3
}
```

### All Subscriptions Response

```json
{
  "success": true,
  "data": [
    {
      "subscriber": "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
      "planId": 1,
      "creator": "CreatorPublicKeyHere123456789",
      "isActive": true,
      "lastPayment": 1695123456,
      "nextPayment": 1697715456,
      "totalPayments": 3
    },
    {
      "subscriber": "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
      "planId": 2,
      "creator": "AnotherCreatorPublicKey123456789",
      "isActive": false,
      "lastPayment": 1694000000,
      "nextPayment": 1696592000,
      "totalPayments": 1
    }
  ]
}
```

### Subscription Status Response

```json
{
  "success": true,
  "data": {
    "isActive": true,
    "isPaymentDue": false,
    "nextPayment": 1697715456,
    "timeUntilNextPayment": 86400,
    "totalPayments": 3,
    "lastPayment": 1695123456
  }
}
```

### Field Descriptions

| Field | Type | Description |
|-------|------|-------------|
| `subscriber` | string | Solana public key of the subscriber |
| `planId` | number | Unique identifier for the subscription plan |
| `creator` | string | Solana public key of the plan creator |
| `isActive` | boolean | Whether the subscription is currently active |
| `lastPayment` | number | Unix timestamp of the last payment |
| `nextPayment` | number | Unix timestamp when the next payment is due |
| `totalPayments` | number | Total number of payments made |
| `isPaymentDue` | boolean | Whether a payment is currently due |
| `timeUntilNextPayment` | number | Seconds until the next payment is due |

## Error Handling

The API uses standard HTTP status codes and returns detailed error information.

### Common Error Responses

#### 401 Unauthorized
```json
{
  "success": false,
  "error": {
    "message": "Invalid or inactive API key",
    "code": "UNAUTHORIZED"
  }
}
```

#### 403 Forbidden
```json
{
  "success": false,
  "error": {
    "message": "Insufficient permissions. Required: subscriptions:read",
    "code": "FORBIDDEN"
  }
}
```

#### 404 Not Found
```json
{
  "success": false,
  "error": {
    "message": "Subscription not found",
    "code": "NOT_FOUND"
  }
}
```

#### 400 Bad Request
```json
{
  "success": false,
  "error": {
    "message": "Invalid Solana public key format",
    "code": "INVALID_REQUEST"
  }
}
```

### Error Status Codes

| Status Code | Description |
|-------------|-------------|
| 400 | Bad Request - Invalid parameters or request format |
| 401 | Unauthorized - Missing or invalid API key |
| 403 | Forbidden - API key lacks required permissions |
| 404 | Not Found - Subscription or resource not found |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error - Server-side error |

## Code Examples

### JavaScript/Node.js

```javascript
const axios = require('axios');

class CirculumSubscriptionAPI {
  constructor(apiKey, baseUrl = 'https://api.circulum.com/api') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    };
  }

  async getSubscriptions(subscriberAddress) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/subscriptions/subscriber/${subscriberAddress}`,
        { headers: this.headers }
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getSubscription(subscriberAddress, planId) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/subscriptions/${subscriberAddress}/${planId}`,
        { headers: this.headers }
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getSubscriptionStatus(subscriberAddress, planId) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/subscriptions/${subscriberAddress}/${planId}/status`,
        { headers: this.headers }
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  handleError(error) {
    if (error.response) {
      return new Error(`API Error ${error.response.status}: ${error.response.data.error?.message || error.response.statusText}`);
    }
    return error;
  }
}

// Usage Example
const api = new CirculumSubscriptionAPI('sk_live_1234567890abcdef');

async function example() {
  try {
    // Get all subscriptions for a subscriber
    const subscriptions = await api.getSubscriptions('9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM');
    console.log('All subscriptions:', subscriptions);

    // Get specific subscription
    const subscription = await api.getSubscription('9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', 1);
    console.log('Specific subscription:', subscription);

    // Get subscription status
    const status = await api.getSubscriptionStatus('9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', 1);
    console.log('Subscription status:', status);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

example();
```

### Python

```python
import requests
from typing import Dict, List, Optional

class CirculumSubscriptionAPI:
    def __init__(self, api_key: str, base_url: str = 'https://api.circulum.com/api'):
        self.api_key = api_key
        self.base_url = base_url
        self.headers = {
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        }

    def get_subscriptions(self, subscriber_address: str) -> Dict:
        """Get all subscriptions for a subscriber."""
        url = f'{self.base_url}/subscriptions/subscriber/{subscriber_address}'
        response = requests.get(url, headers=self.headers)
        self._handle_response(response)
        return response.json()

    def get_subscription(self, subscriber_address: str, plan_id: int) -> Dict:
        """Get specific subscription details."""
        url = f'{self.base_url}/subscriptions/{subscriber_address}/{plan_id}'
        response = requests.get(url, headers=self.headers)
        self._handle_response(response)
        return response.json()

    def get_subscription_status(self, subscriber_address: str, plan_id: int) -> Dict:
        """Get subscription status."""
        url = f'{self.base_url}/subscriptions/{subscriber_address}/{plan_id}/status'
        response = requests.get(url, headers=self.headers)
        self._handle_response(response)
        return response.json()

    def _handle_response(self, response: requests.Response):
        """Handle API response and raise exceptions for errors."""
        if response.status_code == 401:
            raise Exception('Unauthorized: Invalid or missing API key')
        elif response.status_code == 403:
            raise Exception('Forbidden: Insufficient permissions')
        elif response.status_code == 404:
            raise Exception('Not Found: Subscription not found')
        elif response.status_code == 429:
            raise Exception('Rate Limit Exceeded: Too many requests')
        elif response.status_code >= 400:
            error_data = response.json().get('error', {})
            raise Exception(f'API Error {response.status_code}: {error_data.get("message", "Unknown error")}')

# Usage Example
api = CirculumSubscriptionAPI('sk_live_1234567890abcdef')

try:
    # Get all subscriptions
    subscriptions = api.get_subscriptions('9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM')
    print('All subscriptions:', subscriptions)

    # Get specific subscription
    subscription = api.get_subscription('9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', 1)
    print('Specific subscription:', subscription)

    # Get subscription status
    status = api.get_subscription_status('9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', 1)
    print('Subscription status:', status)

except Exception as e:
    print(f'Error: {e}')
```

### PHP

```php
<?php

class CirculumSubscriptionAPI {
    private $apiKey;
    private $baseUrl;
    private $headers;

    public function __construct($apiKey, $baseUrl = 'https://api.circulum.com/api') {
        $this->apiKey = $apiKey;
        $this->baseUrl = $baseUrl;
        $this->headers = [
            'Authorization: Bearer ' . $apiKey,
            'Content-Type: application/json'
        ];
    }

    public function getSubscriptions($subscriberAddress) {
        $url = $this->baseUrl . '/subscriptions/subscriber/' . $subscriberAddress;
        return $this->makeRequest($url);
    }

    public function getSubscription($subscriberAddress, $planId) {
        $url = $this->baseUrl . '/subscriptions/' . $subscriberAddress . '/' . $planId;
        return $this->makeRequest($url);
    }

    public function getSubscriptionStatus($subscriberAddress, $planId) {
        $url = $this->baseUrl . '/subscriptions/' . $subscriberAddress . '/' . $planId . '/status';
        return $this->makeRequest($url);
    }

    private function makeRequest($url) {
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $this->headers);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode >= 400) {
            $errorData = json_decode($response, true);
            throw new Exception('API Error ' . $httpCode . ': ' . ($errorData['error']['message'] ?? 'Unknown error'));
        }

        return json_decode($response, true);
    }
}

// Usage Example
$api = new CirculumSubscriptionAPI('sk_live_1234567890abcdef');

try {
    // Get all subscriptions
    $subscriptions = $api->getSubscriptions('9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM');
    echo "All subscriptions: " . json_encode($subscriptions) . "\n";

    // Get specific subscription
    $subscription = $api->getSubscription('9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', 1);
    echo "Specific subscription: " . json_encode($subscription) . "\n";

    // Get subscription status
    $status = $api->getSubscriptionStatus('9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', 1);
    echo "Subscription status: " . json_encode($status) . "\n";

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
?>
```

## Rate Limiting

API keys have rate limits based on their configuration. The default limits are:

- **Development**: 100 requests per minute
- **Production**: 1000 requests per minute
- **Premium**: 10000 requests per minute

### Rate Limit Headers

The API returns rate limit information in response headers:

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1695123456
```

### Handling Rate Limits

When you exceed the rate limit, the API returns a `429 Too Many Requests` status with a `Retry-After` header indicating when you can make the next request.

```json
{
  "success": false,
  "error": {
    "message": "Too many requests, please try again later.",
    "code": "RATE_LIMIT_EXCEEDED",
    "retryAfter": 60
  }
}
```

## Best Practices

### 1. Error Handling
Always implement proper error handling for all possible HTTP status codes:

```javascript
try {
  const response = await api.getSubscriptions(subscriberAddress);
  // Handle success
} catch (error) {
  if (error.response?.status === 429) {
    // Handle rate limiting - implement exponential backoff
    await new Promise(resolve => setTimeout(resolve, 60000));
    // Retry request
  } else if (error.response?.status === 404) {
    // Handle not found - subscriber has no subscriptions
    console.log('No subscriptions found for this subscriber');
  } else {
    // Handle other errors
    console.error('API Error:', error.message);
  }
}
```

### 2. Caching
Implement caching to reduce API calls and improve performance:

```javascript
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getCachedSubscriptions(subscriberAddress) {
  const cacheKey = `subscriptions:${subscriberAddress}`;
  const cached = cache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  
  const data = await api.getSubscriptions(subscriberAddress);
  cache.set(cacheKey, { data, timestamp: Date.now() });
  return data;
}
```

### 3. Pagination
For subscribers with many subscriptions, consider implementing pagination:

```javascript
async function getAllSubscriptionsPaginated(subscriberAddress, limit = 50) {
  let allSubscriptions = [];
  let offset = 0;
  let hasMore = true;
  
  while (hasMore) {
    const response = await api.getSubscriptions(subscriberAddress, { limit, offset });
    allSubscriptions = allSubscriptions.concat(response.data);
    hasMore = response.data.length === limit;
    offset += limit;
  }
  
  return allSubscriptions;
}
```

### 4. Retry Logic
Implement exponential backoff for transient errors:

```javascript
async function retryRequest(requestFn, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await requestFn();
    } catch (error) {
      if (attempt === maxRetries || error.response?.status < 500) {
        throw error;
      }
      
      const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// Usage
const subscriptions = await retryRequest(() => 
  api.getSubscriptions('9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM')
);
```

### 5. Input Validation
Always validate Solana public keys before making API calls:

```javascript
function isValidSolanaAddress(address) {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

async function getSubscriptionsSafe(subscriberAddress) {
  if (!isValidSolanaAddress(subscriberAddress)) {
    throw new Error('Invalid Solana public key format');
  }
  
  return await api.getSubscriptions(subscriberAddress);
}
```

### 6. Monitoring and Logging
Implement proper logging for API interactions:

```javascript
const logger = require('winston').createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'api-calls.log' })
  ]
});

async function getSubscriptionsWithLogging(subscriberAddress) {
  const startTime = Date.now();
  
  try {
    logger.info('Fetching subscriptions', { subscriberAddress });
    const result = await api.getSubscriptions(subscriberAddress);
    
    logger.info('Successfully fetched subscriptions', {
      subscriberAddress,
      count: result.data.length,
      duration: Date.now() - startTime
    });
    
    return result;
  } catch (error) {
    logger.error('Failed to fetch subscriptions', {
      subscriberAddress,
      error: error.message,
      duration: Date.now() - startTime
    });
    throw error;
  }
}
```

## Security Considerations

### 1. API Key Storage
- Never hardcode API keys in your source code
- Use environment variables or secure configuration management
- Rotate API keys regularly
- Use different API keys for different environments

### 2. HTTPS Only
Always use HTTPS when making API calls to protect your API key in transit:

```javascript
// Good
const baseUrl = 'https://api.circulum.com/api';

// Bad - Never use HTTP in production
const baseUrl = 'http://api.circulum.com/api';
```

### 3. Principle of Least Privilege
Create API keys with only the minimum permissions required:

```javascript
// For read-only operations
const permissions = ['subscriptions:read'];

// Only add write permissions when necessary
const writePermissions = ['subscriptions:read', 'subscriptions:write'];
```

## Troubleshooting

### Common Issues

#### 1. Invalid Public Key Format
**Error:** `Invalid Solana public key format`
**Solution:** Ensure the public key is a valid base58-encoded Solana address (44 characters)

#### 2. Subscription Not Found
**Error:** `Subscription not found`
**Possible Causes:**
- The subscriber never subscribed to this plan
- The subscription was cancelled
- Incorrect subscriber address or plan ID

#### 3. Rate Limit Exceeded
**Error:** `Too many requests, please try again later`
**Solution:** Implement exponential backoff and respect the `Retry-After` header

#### 4. Insufficient Permissions
**Error:** `Insufficient permissions. Required: subscriptions:read`
**Solution:** Update your API key permissions or create a new key with the required permissions

### Debug Mode

Enable debug logging to troubleshoot API issues:

```javascript
const api = new CirculumSubscriptionAPI('your-api-key', 'https://api.circulum.com/api');

// Enable debug mode
api.debug = true;

// This will log all requests and responses
const subscriptions = await api.getSubscriptions(subscriberAddress);
```

## Support

For additional support:

- **Documentation**: [https://docs.circulum.com](https://docs.circulum.com)
- **API Reference**: [https://api.circulum.com/docs](https://api.circulum.com/docs)
- **GitHub Issues**: [https://github.com/circulum/api/issues](https://github.com/circulum/api/issues)
- **Discord Community**: [https://discord.gg/circulum](https://discord.gg/circulum)

## Changelog

### v1.0.0 (2024-01-15)
- Initial release of Subscriptions API
- Support for getting all subscriptions by subscriber
- Support for getting specific subscription details
- Support for checking subscription status
- Rate limiting and authentication

---

*Last updated: January 15, 2024*
