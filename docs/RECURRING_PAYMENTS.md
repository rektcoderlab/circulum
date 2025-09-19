# Recurring Payments System Documentation

This document explains how to set up and run the recurring payment system that automatically processes subscription payments by taking SOL from subscriber accounts periodically.

## Table of Contents

- [Overview](#overview)
- [System Architecture](#system-architecture)
- [Setting Up the Payment Scheduler](#setting-up-the-payment-scheduler)
- [Implementation Options](#implementation-options)
- [Configuration](#configuration)
- [Monitoring and Logging](#monitoring-and-logging)
- [Error Handling](#error-handling)
- [Security Considerations](#security-considerations)
- [Deployment](#deployment)

## Overview

The Circulum subscription system processes recurring payments automatically based on subscription intervals. When a subscriber signs up for a plan, the system schedules periodic payments to be deducted from their account and transferred to the creator.

### How It Works

1. **Subscription Creation**: User subscribes to a plan with a specific interval (e.g., 30 days)
2. **Payment Scheduling**: System calculates when the next payment is due
3. **Automatic Processing**: A scheduler checks for due payments and processes them
4. **Account Updates**: Subscription records are updated with new payment dates
5. **Notifications**: Webhooks notify relevant parties of payment events

## System Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Scheduler     │    │   Payment API   │    │   Blockchain    │
│   (Cron/Timer)  │───▶│   Processor     │───▶│   (Solana)      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       ▼                       │
         │              ┌─────────────────┐              │
         │              │    Database     │              │
         │              │  (Subscriptions)│              │
         │              └─────────────────┘              │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│     Logging     │    │    Webhooks     │    │   Notifications │
│   & Monitoring  │    │    Service      │    │    Service      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Setting Up the Payment Scheduler

### Option 1: Node.js Cron Job (Recommended)

Create a dedicated scheduler service that runs alongside your API:

```javascript
// api/src/services/PaymentScheduler.ts
import cron from 'node-cron';
import { PublicKey } from '@solana/web3.js';
import { CirculumService } from './circulum.service';
import { logger } from '../utils/logger';
import { webhookService } from './webhook.service';

export class PaymentScheduler {
  private circulumService: CirculumService;
  private isRunning = false;

  constructor(circulumService: CirculumService) {
    this.circulumService = circulumService;
  }

  /**
   * Start the payment scheduler
   * Runs every 5 minutes to check for due payments
   */
  start() {
    if (this.isRunning) {
      logger.warn('Payment scheduler is already running');
      return;
    }

    // Run every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
      await this.processDuePayments();
    });

    // Also run once daily for maintenance
    cron.schedule('0 2 * * *', async () => {
      await this.performMaintenance();
    });

    this.isRunning = true;
    logger.info('Payment scheduler started');
  }

  /**
   * Stop the payment scheduler
   */
  stop() {
    cron.destroy();
    this.isRunning = false;
    logger.info('Payment scheduler stopped');
  }

  /**
   * Process all due payments
   */
  private async processDuePayments() {
    try {
      logger.info('Starting payment processing cycle');
      const currentTime = Math.floor(Date.now() / 1000);
      
      // Get all active subscriptions
      const activeSubscriptions = await this.getActiveSubscriptions();
      
      let processedCount = 0;
      let failedCount = 0;

      for (const subscription of activeSubscriptions) {
        try {
          // Check if payment is due
          if (subscription.nextPayment <= currentTime && subscription.isActive) {
            await this.processSubscriptionPayment(subscription);
            processedCount++;
            
            // Add small delay between payments to avoid overwhelming the network
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } catch (error) {
          failedCount++;
          logger.error(`Failed to process payment for subscription ${subscription.planId}:`, error);
          
          // Emit webhook for failed payment
          await webhookService.emitEvent('payment.failed', {
            subscriber: subscription.subscriber.toString(),
            creator: subscription.creator.toString(),
            planId: subscription.planId,
            error: error.message,
            timestamp: new Date().toISOString(),
          });
        }
      }

      logger.info(`Payment processing cycle completed: ${processedCount} processed, ${failedCount} failed`);
    } catch (error) {
      logger.error('Error in payment processing cycle:', error);
    }
  }

  /**
   * Process payment for a specific subscription
   */
  private async processSubscriptionPayment(subscription: any) {
    const plan = await this.circulumService.getSubscriptionPlan(
      subscription.creator,
      subscription.planId
    );

    if (!plan) {
      throw new Error(`Plan ${subscription.planId} not found`);
    }

    // Process the payment
    const txSignature = await this.circulumService.processPayment(
      subscription.subscriber,
      subscription.creator,
      subscription.planId
    );

    logger.info(`Processed payment: ${txSignature} for subscription ${subscription.planId}`);

    // Emit webhook for successful payment
    await webhookService.emitEvent('payment.processed', {
      transactionSignature: txSignature,
      subscriber: subscription.subscriber.toString(),
      creator: subscription.creator.toString(),
      planId: subscription.planId,
      amount: plan.price,
      paymentNumber: subscription.totalPayments + 1,
      nextPaymentDue: subscription.nextPayment + plan.intervalSeconds,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get all active subscriptions that might need payment processing
   */
  private async getActiveSubscriptions() {
    // In a real implementation, you would query your database or blockchain
    // This is a simplified version
    const subscriptions = [];
    
    // You would implement logic to:
    // 1. Query all active subscriptions from your database
    // 2. Filter by those that might be due for payment
    // 3. Return the list for processing
    
    return subscriptions;
  }

  /**
   * Perform daily maintenance tasks
   */
  private async performMaintenance() {
    try {
      logger.info('Starting daily maintenance');
      
      // Clean up expired subscriptions
      await this.cleanupExpiredSubscriptions();
      
      // Update subscription statistics
      await this.updateSubscriptionStats();
      
      // Generate daily reports
      await this.generateDailyReports();
      
      logger.info('Daily maintenance completed');
    } catch (error) {
      logger.error('Error during daily maintenance:', error);
    }
  }

  private async cleanupExpiredSubscriptions() {
    // Implementation for cleaning up expired subscriptions
  }

  private async updateSubscriptionStats() {
    // Implementation for updating subscription statistics
  }

  private async generateDailyReports() {
    // Implementation for generating daily reports
  }
}
```

### Option 2: External Cron Job

Set up a system cron job that calls your API endpoint:

```bash
# Add to crontab (crontab -e)
# Run every 5 minutes
*/5 * * * * curl -X POST http://localhost:3000/api/payments/process-due \
  -H "Authorization: Bearer your-internal-api-key" \
  -H "Content-Type: application/json"

# Run daily maintenance at 2 AM
0 2 * * * curl -X POST http://localhost:3000/api/payments/maintenance \
  -H "Authorization: Bearer your-internal-api-key" \
  -H "Content-Type: application/json"
```

### Option 3: Docker Compose with Separate Scheduler

```yaml
# docker-compose.yml
version: '3.8'
services:
  api:
    build: ./api
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - MONGODB_URI=mongodb://mongo:27017/circulum
    depends_on:
      - mongo

  scheduler:
    build: ./api
    command: npm run scheduler
    environment:
      - NODE_ENV=production
      - MONGODB_URI=mongodb://mongo:27017/circulum
    depends_on:
      - mongo
      - api

  mongo:
    image: mongo:6
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db

volumes:
  mongo_data:
```

## Implementation Options

### 1. Install Required Dependencies

```bash
cd api
npm install node-cron @types/node-cron
```

### 2. Create the Payment Scheduler Service

```typescript
// api/src/services/PaymentScheduler.ts
import cron from 'node-cron';
import { Connection, PublicKey } from '@solana/web3.js';
import { CirculumService } from './circulum.service';
import { logger } from '../utils/logger';

export class PaymentScheduler {
  private circulumService: CirculumService;
  private connection: Connection;
  private scheduledTasks: cron.ScheduledTask[] = [];

  constructor(circulumService: CirculumService, connection: Connection) {
    this.circulumService = circulumService;
    this.connection = connection;
  }

  start() {
    // Process payments every 5 minutes
    const paymentTask = cron.schedule('*/5 * * * *', async () => {
      await this.processDuePayments();
    }, {
      scheduled: false
    });

    // Daily maintenance at 2 AM
    const maintenanceTask = cron.schedule('0 2 * * *', async () => {
      await this.performMaintenance();
    }, {
      scheduled: false
    });

    this.scheduledTasks.push(paymentTask, maintenanceTask);
    
    // Start all tasks
    this.scheduledTasks.forEach(task => task.start());
    
    logger.info('Payment scheduler started with tasks:', {
      paymentProcessing: '*/5 * * * *',
      maintenance: '0 2 * * *'
    });
  }

  stop() {
    this.scheduledTasks.forEach(task => task.stop());
    this.scheduledTasks = [];
    logger.info('Payment scheduler stopped');
  }

  private async processDuePayments() {
    const startTime = Date.now();
    let processed = 0;
    let failed = 0;

    try {
      const currentTime = Math.floor(Date.now() / 1000);
      
      // Get all subscriptions that need payment processing
      const dueSubscriptions = await this.getDueSubscriptions(currentTime);
      
      logger.info(`Found ${dueSubscriptions.length} subscriptions due for payment`);

      for (const subscription of dueSubscriptions) {
        try {
          await this.processPayment(subscription);
          processed++;
        } catch (error) {
          failed++;
          logger.error(`Payment failed for subscription ${subscription.planId}:`, error);
        }
      }

      const duration = Date.now() - startTime;
      logger.info(`Payment processing completed in ${duration}ms: ${processed} processed, ${failed} failed`);

    } catch (error) {
      logger.error('Error in payment processing cycle:', error);
    }
  }

  private async getDueSubscriptions(currentTime: number) {
    // Implementation to get subscriptions due for payment
    // This would query your database or blockchain for active subscriptions
    // where nextPayment <= currentTime
    return [];
  }

  private async processPayment(subscription: any) {
    // Implementation to process individual payment
    const txSignature = await this.circulumService.processPayment(
      subscription.subscriber,
      subscription.creator,
      subscription.planId
    );

    logger.info(`Payment processed: ${txSignature}`);
    return txSignature;
  }

  private async performMaintenance() {
    logger.info('Starting daily maintenance tasks');
    
    // Cleanup expired subscriptions
    await this.cleanupExpiredSubscriptions();
    
    // Update payment statistics
    await this.updatePaymentStats();
    
    // Generate reports
    await this.generateDailyReport();
    
    logger.info('Daily maintenance completed');
  }

  private async cleanupExpiredSubscriptions() {
    // Implementation for cleanup
  }

  private async updatePaymentStats() {
    // Implementation for stats update
  }

  private async generateDailyReport() {
    // Implementation for report generation
  }
}
```

### 3. Add Scheduler to Main Application

```typescript
// api/src/index.ts
import { PaymentScheduler } from './services/PaymentScheduler';

// ... existing code ...

// Initialize scheduler
const paymentScheduler = new PaymentScheduler(circulumService, connection);

// Start scheduler in production
if (process.env.NODE_ENV === 'production') {
  paymentScheduler.start();
  
  // Graceful shutdown
  process.on('SIGTERM', () => {
    paymentScheduler.stop();
    process.exit(0);
  });
}
```

### 4. Add API Endpoints for Manual Control

```typescript
// api/src/routes/payments.ts

// Manual trigger for processing due payments
router.post('/process-due', 
  authenticateApiKey,
  requirePermissions(['admin:write']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const scheduler = req.app.locals.paymentScheduler;
      await scheduler.processDuePayments();
      
      res.json({
        success: true,
        message: 'Due payments processing initiated'
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get scheduler status
router.get('/scheduler/status',
  authenticateApiKey,
  requirePermissions(['admin:read']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const scheduler = req.app.locals.paymentScheduler;
      
      res.json({
        success: true,
        data: {
          isRunning: scheduler.isRunning,
          lastRun: scheduler.lastRun,
          nextRun: scheduler.nextRun,
          processedToday: scheduler.processedToday,
          failedToday: scheduler.failedToday
        }
      });
    } catch (error) {
      next(error);
    }
  }
);
```

## Configuration

### Environment Variables

```bash
# .env
# Payment processing configuration
PAYMENT_SCHEDULER_ENABLED=true
PAYMENT_PROCESSING_INTERVAL=5  # minutes
PAYMENT_BATCH_SIZE=50
PAYMENT_RETRY_ATTEMPTS=3
PAYMENT_RETRY_DELAY=30000  # milliseconds

# Solana configuration
SOLANA_NETWORK=devnet  # or mainnet-beta
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_COMMITMENT=confirmed

# Database configuration
MONGODB_URI=mongodb://localhost:27017/circulum

# Webhook configuration
WEBHOOK_TIMEOUT=5000
WEBHOOK_RETRY_ATTEMPTS=3
```

### Scheduler Configuration

```typescript
// api/src/config/scheduler.ts
export const schedulerConfig = {
  // How often to check for due payments (cron format)
  paymentInterval: process.env.PAYMENT_PROCESSING_INTERVAL || '*/5 * * * *',
  
  // Daily maintenance time
  maintenanceTime: '0 2 * * *',
  
  // Batch processing settings
  batchSize: parseInt(process.env.PAYMENT_BATCH_SIZE || '50'),
  
  // Retry settings
  retryAttempts: parseInt(process.env.PAYMENT_RETRY_ATTEMPTS || '3'),
  retryDelay: parseInt(process.env.PAYMENT_RETRY_DELAY || '30000'),
  
  // Grace period for late payments (seconds)
  gracePeriod: 3600, // 1 hour
  
  // Maximum processing time per cycle (milliseconds)
  maxProcessingTime: 300000, // 5 minutes
};
```

## Monitoring and Logging

### Payment Processing Logs

```typescript
// Enhanced logging for payment processing
class PaymentLogger {
  static logPaymentAttempt(subscription: any) {
    logger.info('Processing payment', {
      subscriber: subscription.subscriber.toString(),
      creator: subscription.creator.toString(),
      planId: subscription.planId,
      dueDate: new Date(subscription.nextPayment * 1000).toISOString(),
      paymentNumber: subscription.totalPayments + 1
    });
  }

  static logPaymentSuccess(subscription: any, txSignature: string) {
    logger.info('Payment processed successfully', {
      subscriber: subscription.subscriber.toString(),
      creator: subscription.creator.toString(),
      planId: subscription.planId,
      transactionSignature: txSignature,
      paymentNumber: subscription.totalPayments + 1
    });
  }

  static logPaymentFailure(subscription: any, error: Error) {
    logger.error('Payment processing failed', {
      subscriber: subscription.subscriber.toString(),
      creator: subscription.creator.toString(),
      planId: subscription.planId,
      error: error.message,
      stack: error.stack
    });
  }
}
```

### Metrics Collection

```typescript
// api/src/services/PaymentMetrics.ts
export class PaymentMetrics {
  private static metrics = {
    paymentsProcessedToday: 0,
    paymentsFailedToday: 0,
    totalRevenue: 0,
    averageProcessingTime: 0,
    lastProcessingCycle: null as Date | null
  };

  static incrementProcessed() {
    this.metrics.paymentsProcessedToday++;
  }

  static incrementFailed() {
    this.metrics.paymentsFailedToday++;
  }

  static addRevenue(amount: number) {
    this.metrics.totalRevenue += amount;
  }

  static updateProcessingTime(duration: number) {
    this.metrics.averageProcessingTime = 
      (this.metrics.averageProcessingTime + duration) / 2;
  }

  static setLastProcessingCycle() {
    this.metrics.lastProcessingCycle = new Date();
  }

  static getMetrics() {
    return { ...this.metrics };
  }

  static resetDailyMetrics() {
    this.metrics.paymentsProcessedToday = 0;
    this.metrics.paymentsFailedToday = 0;
  }
}
```

## Error Handling

### Payment Failure Scenarios

1. **Insufficient Balance**: Subscriber doesn't have enough SOL
2. **Network Issues**: Solana network congestion or downtime
3. **Invalid Subscription**: Subscription was cancelled or expired
4. **Smart Contract Errors**: Program execution failures

### Retry Logic

```typescript
async function processPaymentWithRetry(subscription: any, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await circulumService.processPayment(
        subscription.subscriber,
        subscription.creator,
        subscription.planId
      );
    } catch (error) {
      logger.warn(`Payment attempt ${attempt} failed:`, error.message);
      
      if (attempt === maxRetries) {
        // Final failure - handle appropriately
        await handlePaymentFailure(subscription, error);
        throw error;
      }
      
      // Wait before retry (exponential backoff)
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

async function handlePaymentFailure(subscription: any, error: Error) {
  // 1. Log the failure
  logger.error('Payment failed after all retries', {
    subscription: subscription.planId,
    error: error.message
  });

  // 2. Update subscription status if needed
  if (error.message.includes('insufficient funds')) {
    // Mark subscription as payment failed
    await updateSubscriptionStatus(subscription, 'payment_failed');
  }

  // 3. Send notification to subscriber
  await sendPaymentFailureNotification(subscription, error);

  // 4. Emit webhook
  await webhookService.emitEvent('payment.failed', {
    subscriber: subscription.subscriber.toString(),
    creator: subscription.creator.toString(),
    planId: subscription.planId,
    error: error.message,
    timestamp: new Date().toISOString()
  });
}
```

## Security Considerations

### 1. API Key Management

```typescript
// Use a dedicated internal API key for scheduler operations
const INTERNAL_API_KEY = process.env.INTERNAL_SCHEDULER_API_KEY;

// Validate internal requests
export const validateInternalRequest = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const token = authHeader.split(' ')[1];
  if (token !== INTERNAL_API_KEY) {
    return res.status(401).json({ error: 'Invalid internal API key' });
  }
  
  next();
};
```

### 2. Rate Limiting for Scheduler

```typescript
// Implement special rate limiting for scheduler operations
export const schedulerRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // Allow more requests for scheduler
  message: 'Too many scheduler requests',
  standardHeaders: true,
  legacyHeaders: false,
});
```

### 3. Transaction Security

```typescript
// Validate transactions before processing
async function validatePaymentTransaction(subscription: any) {
  // 1. Check subscription is still active
  if (!subscription.isActive) {
    throw new Error('Subscription is not active');
  }

  // 2. Check payment is actually due
  const currentTime = Math.floor(Date.now() / 1000);
  if (currentTime < subscription.nextPayment) {
    throw new Error('Payment is not due yet');
  }

  // 3. Check subscriber account balance
  const balance = await connection.getBalance(subscription.subscriber);
  const plan = await circulumService.getSubscriptionPlan(
    subscription.creator,
    subscription.planId
  );
  
  if (balance < plan.price) {
    throw new Error('Insufficient balance for payment');
  }

  // 4. Validate plan is still active
  if (!plan.isActive) {
    throw new Error('Subscription plan is no longer active');
  }

  return true;
}
```

## Deployment

### 1. Production Deployment with PM2

```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'circulum-api',
      script: 'dist/index.js',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    },
    {
      name: 'circulum-scheduler',
      script: 'dist/scheduler.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
```

### 2. Kubernetes Deployment

```yaml
# k8s/scheduler-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: circulum-scheduler
spec:
  replicas: 1
  selector:
    matchLabels:
      app: circulum-scheduler
  template:
    metadata:
      labels:
        app: circulum-scheduler
    spec:
      containers:
      - name: scheduler
        image: circulum/api:latest
        command: ["npm", "run", "scheduler"]
        env:
        - name: NODE_ENV
          value: "production"
        - name: MONGODB_URI
          valueFrom:
            secretKeyRef:
              name: circulum-secrets
              key: mongodb-uri
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
```

### 3. Docker Setup

```dockerfile
# Dockerfile.scheduler
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist/ ./dist/

CMD ["node", "dist/scheduler.js"]
```

## Usage Examples

### Starting the System

```bash
# Development
npm run dev

# Production with scheduler
NODE_ENV=production PAYMENT_SCHEDULER_ENABLED=true npm start

# Docker
docker-compose up -d

# Kubernetes
kubectl apply -f k8s/
```

### Manual Payment Processing

```bash
# Process all due payments manually
curl -X POST "http://localhost:3000/api/payments/process-due" \
  -H "Authorization: Bearer your-admin-api-key" \
  -H "Content-Type: application/json"

# Check scheduler status
curl -X GET "http://localhost:3000/api/payments/scheduler/status" \
  -H "Authorization: Bearer your-admin-api-key"
```

### Monitoring

```bash
# Check logs
tail -f logs/payment-scheduler.log

# Monitor metrics
curl -X GET "http://localhost:3000/api/payments/metrics" \
  -H "Authorization: Bearer your-admin-api-key"
```

## Best Practices

### 1. Gradual Rollout
- Start with a small number of subscriptions
- Monitor system performance and error rates
- Gradually increase the batch size

### 2. Backup and Recovery
- Implement database backups before payment processing
- Keep transaction logs for audit purposes
- Have rollback procedures for failed batches

### 3. Performance Optimization
- Process payments in batches to avoid overwhelming the network
- Use connection pooling for database operations
- Implement circuit breakers for external service calls

### 4. Alerting
- Set up alerts for high failure rates
- Monitor system resources during processing
- Alert on scheduler downtime

## Troubleshooting

### Common Issues

1. **High Failure Rate**: Check Solana network status and subscriber balances
2. **Scheduler Not Running**: Verify cron expressions and system time
3. **Database Timeouts**: Increase connection pool size and timeouts
4. **Memory Issues**: Reduce batch size and implement proper cleanup

### Debug Commands

```bash
# Check scheduler status
curl -X GET "http://localhost:3000/api/payments/scheduler/status"

# Process single payment manually
curl -X POST "http://localhost:3000/api/payments/process" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "subscriber": "subscriber-address",
    "creator": "creator-address", 
    "planId": 1
  }'

# Check upcoming payments
curl -X GET "http://localhost:3000/api/payments/upcoming/subscriber-address" \
  -H "Authorization: Bearer your-api-key"
```

## Quick Start Guide

### 1. Install Dependencies

```bash
cd api
npm install node-cron @types/node-cron
```

### 2. Create Scheduler Service

Create the `PaymentScheduler.ts` file as shown in the implementation section above.

### 3. Update Package.json

```json
{
  "scripts": {
    "start": "node dist/index.js",
    "scheduler": "node dist/scheduler.js",
    "dev": "ts-node-dev --respawn --transpile-only src/index.ts",
    "dev:scheduler": "ts-node-dev --respawn --transpile-only src/scheduler.ts"
  }
}
```

### 4. Create Standalone Scheduler Entry Point

```typescript
// api/src/scheduler.ts
import dotenv from 'dotenv';
import { Connection, clusterApiUrl } from '@solana/web3.js';
import { AnchorProvider } from '@coral-xyz/anchor';
import { CirculumService } from './services/circulum.service';
import { PaymentScheduler } from './services/PaymentScheduler';
import { database } from './utils/database';
import { logger } from './utils/logger';

// Load environment variables
dotenv.config();

async function startScheduler() {
  try {
    // Connect to database
    await database.connect();
    
    // Setup Solana connection
    const network = process.env.SOLANA_NETWORK || 'devnet';
    const rpcUrl = process.env.SOLANA_RPC_URL || clusterApiUrl(network as any);
    const connection = new Connection(rpcUrl, 'confirmed');
    
    // Create provider (in production, you'd use a proper wallet)
    const provider = new AnchorProvider(connection, {} as any, {});
    
    // Initialize services
    const circulumService = new CirculumService(provider);
    const paymentScheduler = new PaymentScheduler(circulumService, connection);
    
    // Start scheduler
    paymentScheduler.start();
    
    logger.info('Payment scheduler service started successfully');
    
    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM, shutting down gracefully');
      paymentScheduler.stop();
      await database.disconnect();
      process.exit(0);
    });
    
    process.on('SIGINT', async () => {
      logger.info('Received SIGINT, shutting down gracefully');
      paymentScheduler.stop();
      await database.disconnect();
      process.exit(0);
    });
    
  } catch (error) {
    logger.error('Failed to start payment scheduler:', error);
    process.exit(1);
  }
}

startScheduler();
```

### 5. Environment Configuration

```bash
# .env
PAYMENT_SCHEDULER_ENABLED=true
PAYMENT_PROCESSING_INTERVAL=*/5 * * * *
PAYMENT_BATCH_SIZE=50
PAYMENT_RETRY_ATTEMPTS=3
PAYMENT_RETRY_DELAY=30000

SOLANA_NETWORK=devnet
SOLANA_RPC_URL=https://api.devnet.solana.com
MONGODB_URI=mongodb://localhost:27017/circulum

# Internal API key for scheduler operations
INTERNAL_SCHEDULER_API_KEY=sk_internal_scheduler_key_here
```

### 6. Start the System

```bash
# Development (API + Scheduler in same process)
npm run dev

# Production (separate processes)
npm run build
npm start &  # Start API
npm run scheduler &  # Start scheduler

# Docker
docker-compose up -d
```

## Payment Flow Example

Here's how a typical payment cycle works:

1. **User subscribes** to a monthly plan (30-day interval)
2. **Initial payment** is processed immediately
3. **Next payment** is scheduled for 30 days later
4. **Scheduler runs** every 5 minutes checking for due payments
5. **When due**, the scheduler automatically processes the payment
6. **SOL is transferred** from subscriber to creator
7. **Subscription is updated** with new payment date
8. **Webhooks are sent** to notify relevant parties

### Example Timeline

```
Day 0:  User subscribes, pays first payment
Day 30: Payment becomes due at midnight
Day 30: Scheduler detects due payment at 12:05 AM
Day 30: Payment is processed automatically
Day 30: Next payment scheduled for Day 60
Day 60: Process repeats...
```

## Monitoring Dashboard

You can create a simple monitoring dashboard by adding these endpoints:

```typescript
// Get real-time scheduler metrics
router.get('/scheduler/metrics', async (req, res) => {
  const metrics = PaymentMetrics.getMetrics();
  res.json({
    success: true,
    data: {
      ...metrics,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      timestamp: new Date().toISOString()
    }
  });
});

// Get payment processing history
router.get('/scheduler/history', async (req, res) => {
  // Return recent payment processing history
  res.json({
    success: true,
    data: {
      recentPayments: [], // Last 100 payments
      dailyStats: [], // Last 30 days
      errorLog: [] // Recent errors
    }
  });
});
```

## Support and Maintenance

### Regular Tasks

1. **Monitor logs** for errors and performance issues
2. **Check metrics** daily for processing statistics
3. **Update configurations** based on network conditions
4. **Backup databases** before major updates
5. **Test failover** procedures regularly

### Emergency Procedures

1. **Stop scheduler** if critical issues are detected
2. **Process payments manually** if needed
3. **Rollback transactions** if errors are found
4. **Notify users** of any service disruptions

---

*This documentation provides a complete guide for setting up and running the recurring payment system. For additional support, refer to the main API documentation or contact the development team.*
