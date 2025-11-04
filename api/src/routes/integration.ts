import { Router, Request, Response, NextFunction } from 'express';
import { PublicKey } from '@solana/web3.js';
import Joi from 'joi';
import { CirculumService } from '@core/services/circulum.service';
import { createError } from '@/middleware/error-handler';
import { logger } from '@core/utils/logger';
import { apiKeyService } from '@core/services/api-key.service';
import { authenticateApiKey, requirePermissions } from '@/middleware/auth';

const router = Router();

// Validation schemas
const webhookSchema = Joi.object({
  url: Joi.string().uri().required(),
  events: Joi.array().items(Joi.string().valid(
    'subscription.created',
    'subscription.cancelled',
    'payment.processed',
    'payment.failed',
    'plan.created',
    'plan.updated',
    'plan.deactivated'
  )).min(1).required(),
  secret: Joi.string().min(16).optional(),
});

const apiKeySchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  permissions: Joi.array().items(Joi.string().valid(
    'plans:read',
    'plans:write',
    'subscriptions:read',
    'subscriptions:write',
    'payments:read',
    'payments:write',
    'webhooks:read',
    'webhooks:write',
    'api-keys:read',
    'api-keys:write',
    'integration:write',
    'metrics:read'
  )).min(1).required(),
  rateLimit: Joi.number().integer().min(10).max(10000).default(1000),
});

/**
 * @swagger
 * /api/integration/info:
 *   get:
 *     summary: Get integration information
 *     description: Retrieve information about available endpoints, supported tokens, and integration capabilities
 *     tags: [Integration]
 *     security: []
 *     responses:
 *       200:
 *         description: Integration information retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     version:
 *                       type: string
 *                     network:
 *                       type: string
 *                     programId:
 *                       type: string
 *                     endpoints:
 *                       type: object
 *                     supportedTokens:
 *                       type: array
 *                     webhookEvents:
 *                       type: array
 *                     rateLimits:
 *                       type: object
 */
router.get('/info', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const integrationInfo = {
      version: '1.0.0',
      network: process.env.SOLANA_NETWORK || 'devnet',
      programId: 'Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS',
      endpoints: {
        plans: {
          create: 'POST /api/plans',
          get: 'GET /api/plans/:creator/:planId',
          list: 'GET /api/plans/creator/:creator',
          update: 'PUT /api/plans/:creator/:planId',
          delete: 'DELETE /api/plans/:creator/:planId',
        },
        subscriptions: {
          create: 'POST /api/subscriptions',
          get: 'GET /api/subscriptions/:subscriber/:planId',
          list: 'GET /api/subscriptions/subscriber/:subscriber',
          cancel: 'DELETE /api/subscriptions',
          status: 'GET /api/subscriptions/:subscriber/:planId/status',
        },
        payments: {
          process: 'POST /api/payments/process',
          history: 'GET /api/payments/history/:subscriber/:planId',
          upcoming: 'GET /api/payments/upcoming/:subscriber',
          stats: 'GET /api/payments/stats/creator/:creator',
        },
        integration: {
          info: 'GET /api/integration/info',
          validate: 'POST /api/integration/validate',
          webhooks: 'GET/POST/PUT/DELETE /api/integration/webhooks',
          apiKeys: 'GET/POST/DELETE /api/integration/api-keys',
          sdk: 'GET /api/integration/sdk/:language',
        },
      },
      supportedTokens: [
        {
          symbol: 'SOL',
          mint: 'native',
          decimals: 9,
        },
        {
          symbol: 'USDC',
          mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          decimals: 6,
        },
        {
          symbol: 'USDT',
          mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
          decimals: 6,
        },
      ],
      webhookEvents: [
        'subscription.created',
        'subscription.cancelled',
        'payment.processed',
        'payment.failed',
        'plan.created',
        'plan.updated',
        'plan.deactivated',
      ],
      rateLimits: {
        default: '100 requests per minute',
        authenticated: '1000 requests per minute',
        premium: '10000 requests per minute',
      },
    };

    res.json({
      success: true,
      data: integrationInfo,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/integration/validate:
 *   post:
 *     summary: Validate integration setup
 *     description: Validate a Solana public key and check network connectivity
 *     tags: [Integration]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - publicKey
 *             properties:
 *               publicKey:
 *                 type: string
 *                 description: Solana public key to validate
 *               network:
 *                 type: string
 *                 description: Network to validate against (devnet, mainnet-beta)
 *                 example: devnet
 *     responses:
 *       200:
 *         description: Validation results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     publicKey:
 *                       type: object
 *                     network:
 *                       type: object
 *                     account:
 *                       type: object
 *                     integration:
 *                       type: object
 */
router.post('/validate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { publicKey, network } = req.body;

    if (!publicKey) {
      throw createError('Public key is required for validation', 400);
    }

    // Validate public key format
    try {
      new PublicKey(publicKey);
    } catch {
      throw createError('Invalid Solana public key format', 400);
    }

    const circulumService: CirculumService = req.app.locals.circulumService;
    const connection = req.app.locals.connection;

    // Check network connectivity
    const networkInfo = await connection.getVersion();
    
    // Check account balance
    const balance = await connection.getBalance(new PublicKey(publicKey));

    // Validate network match
    const expectedNetwork = process.env.SOLANA_NETWORK || 'devnet';
    const providedNetwork = network || 'devnet';

    const validation = {
      publicKey: {
        valid: true,
        address: publicKey,
      },
      network: {
        connected: true,
        expected: expectedNetwork,
        provided: providedNetwork,
        match: expectedNetwork === providedNetwork,
        version: networkInfo,
      },
      account: {
        exists: balance > 0,
        balance: balance / 1e9, // Convert to SOL
        hasMinimumBalance: balance >= 1000000, // 0.001 SOL minimum
      },
      integration: {
        ready: balance > 0 && expectedNetwork === providedNetwork,
        recommendations: [] as string[],
      },
    };

    // Add recommendations
    if (balance < 1000000) {
      validation.integration.recommendations.push('Account balance is low. Consider adding more SOL for transaction fees.');
    }

    if (expectedNetwork !== providedNetwork) {
      validation.integration.recommendations.push(`Network mismatch. API is configured for ${expectedNetwork} but ${providedNetwork} was provided.`);
    }

    if (expectedNetwork === 'mainnet-beta') {
      validation.integration.recommendations.push('You are connecting to mainnet. Ensure you have tested thoroughly on devnet first.');
    }

    logger.info(`Integration validation for ${publicKey}: ${validation.integration.ready ? 'READY' : 'NOT READY'}`);

    res.json({
      success: true,
      data: validation,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/integration/webhooks:
 *   get:
 *     summary: List webhooks
 *     description: Retrieve all configured webhooks
 *     tags: [Integration]
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: List of webhooks retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       url:
 *                         type: string
 *                       events:
 *                         type: array
 *                         items:
 *                           type: string
 *                       active:
 *                         type: boolean
 *                       createdAt:
 *                         type: string
 */
router.get('/webhooks', authenticateApiKey, requirePermissions(['read:webhooks']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    // In a real implementation, you would fetch from a database
    const webhooks = [
      {
        id: 'webhook_1',
        url: 'https://example.com/webhook',
        events: ['subscription.created', 'payment.processed'],
        active: true,
        createdAt: new Date().toISOString(),
      },
    ];

    res.json({
      success: true,
      data: webhooks,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/integration/webhooks:
 *   post:
 *     summary: Create a webhook
 *     description: Create a new webhook endpoint
 *     tags: [Integration]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - url
 *               - events
 *             properties:
 *               url:
 *                 type: string
 *                 format: uri
 *                 description: Webhook URL
 *               events:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [subscription.created, subscription.cancelled, payment.processed, payment.failed, plan.created, plan.updated, plan.deactivated]
 *                 description: Array of events to subscribe to
 *               secret:
 *                 type: string
 *                 description: Optional webhook secret
 *     responses:
 *       201:
 *         description: Webhook created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                 message:
 *                   type: string
 */
router.post('/webhooks', authenticateApiKey, requirePermissions(['write:webhooks']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = webhookSchema.validate(req.body);
    if (error) {
      throw createError(error.details[0].message, 400);
    }

    const { url, events, secret } = value;

    // In a real implementation, you would save to a database
    const webhook = {
      id: `webhook_${Date.now()}`,
      url,
      events,
      secret: secret || `whsec_${Math.random().toString(36).substring(2, 15)}`,
      active: true,
      createdAt: new Date().toISOString(),
    };

    logger.info(`Created webhook ${webhook.id} for URL ${url}`);

    res.status(201).json({
      success: true,
      data: webhook,
      message: 'Webhook created successfully',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/integration/api-keys:
 *   get:
 *     summary: List API keys
 *     description: Retrieve all API keys
 *     tags: [Integration]
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: List of API keys retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       keyPreview:
 *                         type: string
 *                       permissions:
 *                         type: array
 *                         items:
 *                           type: string
 *                       rateLimit:
 *                         type: integer
 *                       lastUsed:
 *                         type: string
 *                       createdAt:
 *                         type: string
 */
router.get('/api-keys', authenticateApiKey, requirePermissions(['read:api-keys']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    // In a real implementation, you would fetch from a database
    const apiKeys = [
      {
        id: 'key_1',
        name: 'Production Integration',
        keyPreview: 'sk_live_1234...5678',
        permissions: ['plans:read', 'subscriptions:read', 'payments:read'],
        rateLimit: 1000,
        lastUsed: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      },
    ];

    res.json({
      success: true,
      data: apiKeys,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/integration/api-keys:
 *   post:
 *     summary: Create an API key
 *     description: Create a new API key with specified permissions
 *     tags: [Integration]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - permissions
 *             properties:
 *               name:
 *                 type: string
 *                 description: Name for the API key
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of permissions
 *               rateLimit:
 *                 type: integer
 *                 description: Rate limit for the key
 *                 default: 1000
 *     responses:
 *       201:
 *         description: API key created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     key:
 *                       type: string
 *                       description: Full API key (only shown once)
 *                     keyPreview:
 *                       type: string
 *                     permissions:
 *                       type: array
 *                     rateLimit:
 *                       type: integer
 *                     createdAt:
 *                       type: string
 *                 message:
 *                   type: string
 */
router.post('/api-keys', authenticateApiKey, requirePermissions(['write:api-keys']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = apiKeySchema.validate(req.body);
    if (error) {
      throw createError(error.details[0].message, 400);
    }

    const { name, permissions, rateLimit } = value;
    const environment = process.env.NODE_ENV === 'production' ? 'production' : 'development';

    const { apiKey, rawKey } = await apiKeyService.createApiKey({
      name,
      permissions,
      rateLimit,
      metadata: {
        environment,
        description: `API key created via integration endpoint`,
      },
    });

    logger.info(`Created API key ${apiKey._id} with name "${name}"`);

    res.status(201).json({
      success: true,
      data: {
        id: apiKey._id?.toString() || '',
        name: apiKey.name,
        key: rawKey, // Only return full key on creation
        keyPreview: apiKey.keyPreview,
        permissions: apiKey.permissions,
        rateLimit: apiKey.rateLimit,
        createdAt: apiKey.createdAt,
      },
      message: 'API key created successfully. Store this key securely as it will not be shown again.',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/integration/sdk/{language}:
 *   get:
 *     summary: Get SDK examples
 *     description: Retrieve SDK installation and code examples for a specific language
 *     tags: [Integration]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: language
 *         required: true
 *         schema:
 *           type: string
 *           enum: [javascript, python, curl]
 *         description: Programming language
 *     responses:
 *       200:
 *         description: SDK examples retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     language:
 *                       type: string
 *                     installation:
 *                       type: string
 *                     example:
 *                       type: string
 *                     documentation:
 *                       type: string
 *                     support:
 *                       type: string
 *       404:
 *         description: SDK examples not available for the specified language
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/sdk/:language', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { language } = req.params;
    const baseUrl = `${req.protocol}://${req.get('host')}/api`;

    const sdkExamples = {
      javascript: {
        installation: 'npm install @circulum/sdk',
        example: `
import { CirculumClient } from '@circulum/sdk';

const client = new CirculumClient({
  apiKey: 'your-api-key',
  network: 'devnet', // or 'mainnet-beta'
  baseUrl: '${baseUrl}'
});

// Create a subscription plan
const plan = await client.plans.create({
  creator: 'your-creator-public-key',
  planId: 1,
  price: 1000000, // 0.001 SOL in lamports
  intervalSeconds: 2592000, // 30 days
  maxSubscribers: 1000,
  metadataUri: 'https://your-domain.com/metadata.json'
});

// Subscribe to a plan
const subscription = await client.subscriptions.create({
  subscriber: 'subscriber-public-key',
  creator: 'creator-public-key',
  planId: 1
});

// Process a payment
const payment = await client.payments.process({
  subscriber: 'subscriber-public-key',
  creator: 'creator-public-key',
  planId: 1
});
        `,
      },
      python: {
        installation: 'pip install circulum-sdk',
        example: `
from circulum import CirculumClient

client = CirculumClient(
    api_key='your-api-key',
    network='devnet',  # or 'mainnet-beta'
    base_url='${baseUrl}'
)

# Create a subscription plan
plan = client.plans.create(
    creator='your-creator-public-key',
    plan_id=1,
    price=1000000,  # 0.001 SOL in lamports
    interval_seconds=2592000,  # 30 days
    max_subscribers=1000,
    metadata_uri='https://your-domain.com/metadata.json'
)

# Subscribe to a plan
subscription = client.subscriptions.create(
    subscriber='subscriber-public-key',
    creator='creator-public-key',
    plan_id=1
)

# Process a payment
payment = client.payments.process(
    subscriber='subscriber-public-key',
    creator='creator-public-key',
    plan_id=1
)
        `,
      },
      curl: {
        installation: 'No installation required',
        example: `
# Create a subscription plan
curl -X POST ${baseUrl}/plans \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer your-api-key" \\
  -d '{
    "creator": "your-creator-public-key",
    "planId": 1,
    "price": 1000000,
    "intervalSeconds": 2592000,
    "maxSubscribers": 1000,
    "metadataUri": "https://your-domain.com/metadata.json"
  }'

# Subscribe to a plan
curl -X POST ${baseUrl}/subscriptions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer your-api-key" \\
  -d '{
    "subscriber": "subscriber-public-key",
    "creator": "creator-public-key",
    "planId": 1
  }'

# Process a payment
curl -X POST ${baseUrl}/payments/process \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer your-api-key" \\
  -d '{
    "subscriber": "subscriber-public-key",
    "creator": "creator-public-key",
    "planId": 1
  }'
        `,
      },
    };

    const example = sdkExamples[language.toLowerCase() as keyof typeof sdkExamples];
    if (!example) {
      throw createError(`SDK example not available for language: ${language}`, 404);
    }

    res.json({
      success: true,
      data: {
        language,
        ...example,
        documentation: `${baseUrl.replace('/api', '')}/docs`,
        support: 'https://github.com/your-org/circulum/issues',
      },
    });
  } catch (error) {
    next(error);
  }
});

// Integration testing endpoint
router.post('/test', authenticateApiKey, requirePermissions(['integration:write']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { endpoint, method = 'GET', data } = req.body;

    if (!endpoint) {
      throw createError('Endpoint is required for testing', 400);
    }

    // Simulate API call testing
    const testResult = {
      endpoint,
      method,
      timestamp: new Date().toISOString(),
      status: 'success',
      responseTime: Math.floor(Math.random() * 100) + 50, // Mock response time
      data: data || { message: 'Test successful' },
    };

    logger.info(`Integration test for ${method} ${endpoint}: SUCCESS`);

    res.json({
      success: true,
      data: testResult,
      message: 'Integration test completed successfully',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/integration/metrics:
 *   get:
 *     summary: Get integration metrics
 *     description: Retrieve API usage metrics and statistics
 *     tags: [Integration]
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Metrics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalRequests:
 *                       type: integer
 *                     successRate:
 *                       type: number
 *                     averageResponseTime:
 *                       type: integer
 *                     activeIntegrations:
 *                       type: integer
 *                     topEndpoints:
 *                       type: array
 *                     errorBreakdown:
 *                       type: object
 *                     timeRange:
 *                       type: string
 */
router.get('/metrics', authenticateApiKey, requirePermissions(['read:metrics']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    // In a real implementation, you would fetch from analytics/metrics store
    const metrics = {
      totalRequests: 15420,
      successRate: 99.2,
      averageResponseTime: 145,
      activeIntegrations: 23,
      topEndpoints: [
        { endpoint: '/api/subscriptions', requests: 5420, percentage: 35.2 },
        { endpoint: '/api/payments/process', requests: 3210, percentage: 20.8 },
        { endpoint: '/api/plans', requests: 2890, percentage: 18.7 },
      ],
      errorBreakdown: {
        '4xx': 0.6,
        '5xx': 0.2,
      },
      timeRange: '24h',
    };

    res.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    next(error);
  }
});

export { router as integrationRoutes };
