import dotenv from 'dotenv';
import PaymentScheduler from './scheduler';
import { logger } from './utils/logger';

// Load environment variables
dotenv.config();

/**
 * Main entry point for the Circulum Payment Scheduler
 * This can be used to run the scheduler as a standalone service
 */
async function main() {
  try {
    logger.info('Starting Circulum Payment Scheduler...');

    const scheduler = new PaymentScheduler();
    
    // Initialize the scheduler
    await scheduler.initialize();
    
    // Start the scheduled payment processing
    await scheduler.start();

    // Keep the process running
    process.on('SIGINT', async () => {
      logger.info('Received SIGINT, shutting down gracefully...');
      await scheduler.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM, shutting down gracefully...');
      await scheduler.stop();
      process.exit(0);
    });

    logger.info('Payment scheduler is running. Press Ctrl+C to stop.');

  } catch (error) {
    logger.error('Failed to start payment scheduler:', error);
    process.exit(1);
  }
}

// Export for use as a module
export { PaymentScheduler };
export default PaymentScheduler;

// Run if this file is executed directly
if (require.main === module) {
  main().catch((error) => {
    logger.error('Unhandled error in main:', error);
    process.exit(1);
  });
}
