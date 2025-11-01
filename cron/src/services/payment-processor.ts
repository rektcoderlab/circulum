import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { AnchorProvider, Program, Wallet } from '@coral-xyz/anchor';
import { Subscription, ISubscription } from '@core/models/subscription';
import { Plan, IPlan } from '@core/models/plan';
import { logger } from '@/utils/logger';

export interface PaymentResult {
  success: boolean;
  transactionId?: string;
  error?: string;
  subscription: ISubscription;
}

export interface PaymentProcessorConfig {
  connection: Connection;
  program: Program;
  batchSize: number;
  retryAttempts: number;
  retryDelay: number;
  gracePeriod: number;
}

export class PaymentProcessor {
  private connection: Connection;
  private program: Program;
  private batchSize: number;
  private retryAttempts: number;
  private retryDelay: number;
  private gracePeriod: number;

  constructor(config: PaymentProcessorConfig) {
    this.connection = config.connection;
    this.program = config.program;
    this.batchSize = config.batchSize;
    this.retryAttempts = config.retryAttempts;
    this.retryDelay = config.retryDelay;
    this.gracePeriod = config.gracePeriod;
  }

  /**
   * Process all due payments
   */
  async processDuePayments(): Promise<PaymentResult[]> {
    const currentTime = Math.floor(Date.now() / 1000);
    const results: PaymentResult[] = [];

    try {
      // Find all active subscriptions that are due for payment
      const dueSubscriptions = await Subscription.find({
        status: 'active',
        nextPayment: { $lte: currentTime }
      })
      .limit(this.batchSize)
      .populate('planId');

      logger.info(`Found ${dueSubscriptions.length} subscriptions due for payment`);

      // Process each subscription
      for (const subscription of dueSubscriptions) {
        try {
          const result = await this.processSubscriptionPayment(subscription);
          results.push(result);

          // Add delay between payments to avoid rate limiting
          if (results.length < dueSubscriptions.length) {
            await this.delay(100);
          }
        } catch (error) {
          logger.error(`Error processing subscription ${subscription._id}:`, error);
          results.push({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            subscription
          });
        }
      }

      logger.info(`Processed ${results.length} payments. Success: ${results.filter(r => r.success).length}, Failed: ${results.filter(r => !r.success).length}`);
      
      return results;
    } catch (error) {
      logger.error('Error in processDuePayments:', error);
      throw error;
    }
  }

  /**
   * Process payment for a single subscription
   */
  private async processSubscriptionPayment(subscription: ISubscription): Promise<PaymentResult> {
    try {
      // Get the plan details
      const plan = await Plan.findById(subscription.planId);
      if (!plan) {
        throw new Error(`Plan ${subscription.planId} not found`);
      }

      if (!plan.isActive) {
        throw new Error(`Plan ${subscription.planId} is not active`);
      }

      // Attempt payment with retries
      let lastError: Error | null = null;
      for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
        try {
          const transactionId = await this.executePayment(subscription, plan);
          
          // Update subscription on successful payment
          await this.updateSubscriptionAfterPayment(subscription, plan);
          
          logger.info(`Payment successful for subscription ${subscription._id}, transaction: ${transactionId}`);
          
          return {
            success: true,
            transactionId,
            subscription
          };
        } catch (error) {
          lastError = error instanceof Error ? error : new Error('Unknown error');
          logger.warn(`Payment attempt ${attempt}/${this.retryAttempts} failed for subscription ${subscription._id}:`, lastError.message);
          
          if (attempt < this.retryAttempts) {
            await this.delay(this.retryDelay);
          }
        }
      }

      // All attempts failed, handle failure
      await this.handlePaymentFailure(subscription);
      
      return {
        success: false,
        error: lastError?.message || 'Payment failed after all retry attempts',
        subscription
      };
    } catch (error) {
      logger.error(`Error processing payment for subscription ${subscription._id}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        subscription
      };
    }
  }

  /**
   * Execute the actual payment transaction
   */
  private async executePayment(subscription: ISubscription, plan: IPlan): Promise<string> {
    try {
      // Convert SOL amount to lamports
      const amountLamports = Math.floor(plan.amount * LAMPORTS_PER_SOL);
      
      // Create payment transaction using the Circulum program
      const creatorPubkey = new PublicKey(subscription.creator);
      const subscriberPubkey = new PublicKey(subscription.subscriber);
      
      // This would use your Circulum program's payment instruction
      // For now, we'll simulate with a basic transfer
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: subscriberPubkey,
          toPubkey: creatorPubkey,
          lamports: amountLamports
        })
      );

      // Get recent blockhash
      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = subscriberPubkey;

      // In a real implementation, you would need to sign this transaction
      // with the subscriber's private key or use a program-derived address
      // For now, we'll simulate the transaction
      const signature = await this.connection.sendTransaction(transaction, []);
      
      // Wait for confirmation
      await this.connection.confirmTransaction(signature);
      
      return signature;
    } catch (error) {
      logger.error('Error executing payment:', error);
      throw error;
    }
  }

  /**
   * Update subscription after successful payment
   */
  private async updateSubscriptionAfterPayment(subscription: ISubscription, plan: IPlan): Promise<void> {
    const currentTime = Math.floor(Date.now() / 1000);
    
    await Subscription.findByIdAndUpdate(subscription._id, {
      $set: {
        lastPayment: currentTime,
        nextPayment: currentTime + plan.intervalSeconds,
        failedPayments: 0
      },
      $inc: {
        totalPayments: 1
      }
    });
  }

  /**
   * Handle payment failure
   */
  private async handlePaymentFailure(subscription: ISubscription): Promise<void> {
    const failedPayments = subscription.failedPayments + 1;
    const currentTime = Math.floor(Date.now() / 1000);
    
    // Update failed payment count
    const updateData: any = {
      failedPayments,
      nextPayment: currentTime + this.gracePeriod // Add grace period
    };

    // Cancel subscription after too many failures (e.g., 3 failures)
    if (failedPayments >= 3) {
      updateData.status = 'cancelled';
      logger.warn(`Subscription ${subscription._id} cancelled due to ${failedPayments} failed payments`);
    }

    await Subscription.findByIdAndUpdate(subscription._id, updateData);
  }

  /**
   * Get payment processing statistics
   */
  async getProcessingStats(): Promise<{
    totalActive: number;
    dueForPayment: number;
    failedPayments: number;
    cancelledToday: number;
  }> {
    const currentTime = Math.floor(Date.now() / 1000);
    const oneDayAgo = currentTime - (24 * 60 * 60);

    const [totalActive, dueForPayment, failedPayments, cancelledToday] = await Promise.all([
      Subscription.countDocuments({ status: 'active' }),
      Subscription.countDocuments({ 
        status: 'active', 
        nextPayment: { $lte: currentTime } 
      }),
      Subscription.countDocuments({ 
        status: 'active', 
        failedPayments: { $gt: 0 } 
      }),
      Subscription.countDocuments({ 
        status: 'cancelled', 
        updatedAt: { $gte: new Date(oneDayAgo * 1000) } 
      })
    ]);

    return {
      totalActive,
      dueForPayment,
      failedPayments,
      cancelledToday
    };
  }

  /**
   * Utility method to add delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
