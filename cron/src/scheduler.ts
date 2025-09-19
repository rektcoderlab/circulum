import * as cron from 'node-cron';
import dotenv from 'dotenv';
import { Connection, clusterApiUrl } from '@solana/web3.js';
import { AnchorProvider, Program } from '@coral-xyz/anchor';
import { DatabaseConnection } from './config/database';
import { PaymentProcessor, PaymentProcessorConfig } from './services/payment-processor';
import { logger } from './utils/logger';

// Load environment variables
dotenv.config();

export class PaymentScheduler {
  private paymentProcessor: PaymentProcessor | null = null;
  private cronJob: cron.ScheduledTask | null = null;
  private isRunning = false;

  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Payment Scheduler...');

      // Connect to database
      const db = DatabaseConnection.getInstance();
      await db.connect();

      // Initialize Solana connection
      const network = process.env.SOLANA_NETWORK || 'devnet';
      const rpcUrl = process.env.SOLANA_RPC_URL || clusterApiUrl(network as any);
      const connection = new Connection(rpcUrl, 'confirmed');

      // For now, we'll create a mock program since we need the actual program setup
      // In a real implementation, you would load your Circulum program here
      const mockProgram = {} as Program;

      // Initialize payment processor
      const config: PaymentProcessorConfig = {
        connection,
        program: mockProgram,
        batchSize: parseInt(process.env.PAYMENT_BATCH_SIZE || '50'),
        retryAttempts: parseInt(process.env.PAYMENT_RETRY_ATTEMPTS || '3'),
        retryDelay: parseInt(process.env.PAYMENT_RETRY_DELAY || '30000'),
        gracePeriod: parseInt(process.env.PAYMENT_GRACE_PERIOD || '3600')
      };

      this.paymentProcessor = new PaymentProcessor(config);

      logger.info('Payment Scheduler initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Payment Scheduler:', error);
      throw error;
    }
  }

  async start(): Promise<void> {
    if (!this.paymentProcessor) {
      throw new Error('Payment processor not initialized. Call initialize() first.');
    }

    if (this.isRunning) {
      logger.warn('Payment scheduler is already running');
      return;
    }

    const schedulerEnabled = process.env.PAYMENT_SCHEDULER_ENABLED === 'true';
    if (!schedulerEnabled) {
      logger.info('Payment scheduler is disabled via environment variable');
      return;
    }

    const cronExpression = process.env.PAYMENT_PROCESSING_INTERVAL || '*/5 * * * *';
    
    logger.info(`Starting payment scheduler with cron expression: ${cronExpression}`);

    this.cronJob = cron.schedule(cronExpression, async () => {
      await this.processPayments();
    }, {
      scheduled: false,
      timezone: 'UTC'
    });

    this.cronJob.start();
    this.isRunning = true;

    logger.info('Payment scheduler started successfully');

    // Run initial payment processing
    await this.processPayments();
  }

  async stop(): Promise<void> {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }

    this.isRunning = false;
    logger.info('Payment scheduler stopped');
  }

  private async processPayments(): Promise<void> {
    if (!this.paymentProcessor) {
      logger.error('Payment processor not available');
      return;
    }

    try {
      logger.info('Starting payment processing cycle...');
      
      // Get processing statistics before processing
      const statsBefore = await this.paymentProcessor.getProcessingStats();
      logger.info('Pre-processing stats:', statsBefore);

      // Process due payments
      const results = await this.paymentProcessor.processDuePayments();
      
      // Log results
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      
      logger.info(`Payment processing cycle completed. Processed: ${results.length}, Successful: ${successful}, Failed: ${failed}`);

      // Get processing statistics after processing
      const statsAfter = await this.paymentProcessor.getProcessingStats();
      logger.info('Post-processing stats:', statsAfter);

      // Log any failures for monitoring
      if (failed > 0) {
        const failureReasons = results
          .filter(r => !r.success)
          .map(r => ({ subscriptionId: r.subscription._id, error: r.error }));
        
        logger.warn('Payment failures:', failureReasons);
      }

    } catch (error) {
      logger.error('Error during payment processing cycle:', error);
    }
  }

  async getStatus(): Promise<{
    isRunning: boolean;
    nextRun?: Date;
    stats?: any;
  }> {
    const status: any = {
      isRunning: this.isRunning
    };

    if (this.cronJob && this.isRunning) {
      // Note: node-cron doesn't provide next run time directly
      // You might want to calculate it based on the cron expression
      status.nextRun = new Date(); // Placeholder
    }

    if (this.paymentProcessor) {
      try {
        status.stats = await this.paymentProcessor.getProcessingStats();
      } catch (error) {
        logger.error('Error getting payment processor stats:', error);
      }
    }

    return status;
  }

  async processPaymentsOnce(): Promise<void> {
    if (!this.paymentProcessor) {
      throw new Error('Payment processor not initialized');
    }

    await this.processPayments();
  }
}

// Main execution when run directly
async function main() {
  const scheduler = new PaymentScheduler();
  
  try {
    await scheduler.initialize();
    await scheduler.start();

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('Received SIGINT, shutting down gracefully...');
      await scheduler.stop();
      
      const db = DatabaseConnection.getInstance();
      await db.disconnect();
      
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM, shutting down gracefully...');
      await scheduler.stop();
      
      const db = DatabaseConnection.getInstance();
      await db.disconnect();
      
      process.exit(0);
    });

    logger.info('Payment scheduler is running. Press Ctrl+C to stop.');

  } catch (error) {
    logger.error('Failed to start payment scheduler:', error);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main().catch((error) => {
    logger.error('Unhandled error in main:', error);
    process.exit(1);
  });
}

export default PaymentScheduler;
