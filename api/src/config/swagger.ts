import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Circulum API',
      version: '0.1.0',
      description: 'Circulum - Solana-based subscription management platform API',
      contact: {
        name: 'RektCoder Lab',
      },
      license: {
        name: 'MIT',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
      {
        url: 'https://api.circulum.app',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'API key for authentication',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            error: {
              type: 'object',
              properties: {
                message: {
                  type: 'string',
                },
                statusCode: {
                  type: 'integer',
                },
              },
            },
          },
        },
        SuccessResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            data: {
              type: 'object',
            },
          },
        },
        Plan: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Plan ID',
            },
            creator: {
              type: 'string',
              description: 'Creator Solana public key',
            },
            amount: {
              type: 'integer',
              description: 'Subscription amount in lamports',
            },
            interval: {
              type: 'integer',
              description: 'Payment interval in seconds',
            },
            isActive: {
              type: 'boolean',
              description: 'Whether the plan is active',
            },
            maxCancellations: {
              type: 'integer',
              description: 'Maximum allowed cancellations',
            },
            tokenMint: {
              type: 'string',
              description: 'SPL token mint address (optional)',
            },
          },
        },
        Subscription: {
          type: 'object',
          properties: {
            subscriber: {
              type: 'string',
              description: 'Subscriber Solana public key',
            },
            creator: {
              type: 'string',
              description: 'Creator Solana public key',
            },
            planId: {
              type: 'integer',
              description: 'Plan ID',
            },
            isActive: {
              type: 'boolean',
              description: 'Whether the subscription is active',
            },
            nextPayment: {
              type: 'integer',
              description: 'Unix timestamp of next payment',
            },
            lastPayment: {
              type: 'integer',
              description: 'Unix timestamp of last payment',
            },
            totalPayments: {
              type: 'integer',
              description: 'Total number of payments made',
            },
          },
        },
      },
    },
    security: [
      {
        ApiKeyAuth: [],
      },
    ],
  },
  apis: ['./src/routes/*.ts', './src/index.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
