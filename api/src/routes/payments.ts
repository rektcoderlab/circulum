import { Router, Request, Response, NextFunction } from 'express';
import { PublicKey } from '@solana/web3.js';
import Joi from 'joi';
import { CirculumService } from '@core/services/circulum.service';
import { createError } from '@/middleware/error-handler';
import { logger } from '@/utils/logger';

const router = Router();

// Validation schemas
const processPaymentSchema = Joi.object({
  subscriber: Joi.string().required(),
  creator: Joi.string().required(),
  planId: Joi.number().integer().min(0).required(),
  tokenMint: Joi.string().optional(),
});

// Process a recurring payment
router.post('/process', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = processPaymentSchema.validate(req.body);
    if (error) {
      throw createError(error.details[0].message, 400);
    }

    const { subscriber, creator, planId, tokenMint } = value;
    const circulumService: CirculumService = req.app.locals.circulumService;

    const subscriberPubkey = new PublicKey(subscriber);
    const creatorPubkey = new PublicKey(creator);
    const tokenMintPubkey = tokenMint ? new PublicKey(tokenMint) : undefined;

    // Check if subscription exists and payment is due
    const subscription = await circulumService.getSubscription(subscriberPubkey, planId);
    if (!subscription) {
      throw createError('Subscription not found', 404);
    }

    if (!subscription.isActive) {
      throw createError('Subscription is not active', 400);
    }

    const currentTime = Math.floor(Date.now() / 1000);
    if (currentTime < subscription.nextPayment) {
      throw createError('Payment is not due yet', 400);
    }

    const txSignature = await circulumService.processPayment(
      subscriberPubkey,
      creatorPubkey,
      planId,
      tokenMintPubkey
    );

    logger.info(`Processed payment for subscription ${planId} from ${subscriber} to ${creator}`);

    res.json({
      success: true,
      data: {
        transactionSignature: txSignature,
        subscriber,
        creator,
        planId,
        paymentNumber: subscription.totalPayments + 1,
        nextPaymentDue: subscription.nextPayment + ((await circulumService.getSubscriptionPlan(creatorPubkey, planId))?.intervalSeconds || 0),
        message: 'Payment processed successfully',
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get payment history for a subscription
router.get('/history/:subscriber/:planId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { subscriber, planId } = req.params;

    if (!subscriber || !planId) {
      throw createError('Subscriber address and plan ID are required', 400);
    }

    const circulumService: CirculumService = req.app.locals.circulumService;
    const subscriberPubkey = new PublicKey(subscriber);
    const subscription = await circulumService.getSubscription(subscriberPubkey, parseInt(planId));

    if (!subscription) {
      throw createError('Subscription not found', 404);
    }

    // In a real implementation, you would fetch payment history from the blockchain
    // For now, we'll return mock data based on the subscription
    const paymentHistory = [];
    const plan = await circulumService.getSubscriptionPlan(subscription.creator, parseInt(planId));
    
    if (plan && subscription.totalPayments > 0) {
      for (let i = 0; i < subscription.totalPayments; i++) {
        paymentHistory.push({
          paymentNumber: i + 1,
          amount: plan.price,
          timestamp: subscription.lastPayment - (subscription.totalPayments - i - 1) * plan.intervalSeconds,
          transactionSignature: `mock_payment_${i + 1}_signature`,
        });
      }
    }

    res.json({
      success: true,
      data: {
        subscriber,
        planId: parseInt(planId),
        totalPayments: subscription.totalPayments,
        payments: paymentHistory,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get upcoming payments for a subscriber
router.get('/upcoming/:subscriber', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const subscriber = req.params.subscriber;
    if (!subscriber) {
      throw createError('Subscriber address is required', 400);
    }

    const circulumService: CirculumService = req.app.locals.circulumService;
    const subscriberPubkey = new PublicKey(subscriber);
    const subscriptions = await circulumService.getSubscriberSubscriptions(subscriberPubkey);

    const currentTime = Math.floor(Date.now() / 1000);
    const upcomingPayments = [];

    for (const subscription of subscriptions) {
      if (subscription.isActive) {
        const plan = await circulumService.getSubscriptionPlan(subscription.creator, subscription.planId);
        if (plan) {
          upcomingPayments.push({
            planId: subscription.planId,
            creator: subscription.creator.toString(),
            amount: plan.price,
            nextPayment: subscription.nextPayment,
            isOverdue: currentTime > subscription.nextPayment,
            daysUntilPayment: Math.ceil((subscription.nextPayment - currentTime) / 86400),
          });
        }
      }
    }

    // Sort by next payment date
    upcomingPayments.sort((a, b) => a.nextPayment - b.nextPayment);

    res.json({
      success: true,
      data: {
        subscriber,
        upcomingPayments,
        totalUpcoming: upcomingPayments.length,
        overdueCount: upcomingPayments.filter(p => p.isOverdue).length,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get payment statistics for a creator
router.get('/stats/creator/:creator', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const creator = req.params.creator;
    if (!creator) {
      throw createError('Creator address is required', 400);
    }

    const circulumService: CirculumService = req.app.locals.circulumService;
    const creatorPubkey = new PublicKey(creator);
    const plans = await circulumService.getCreatorPlans(creatorPubkey);

    // In a real implementation, you would calculate these from blockchain data
    const stats = {
      totalPlans: plans.length,
      totalSubscribers: plans.reduce((sum, plan) => sum + plan.currentSubscribers, 0),
      totalRevenue: 0, // Would be calculated from payment history
      monthlyRecurringRevenue: plans.reduce((sum, plan) => {
        // Assuming monthly intervals for simplicity
        const monthlyPrice = plan.intervalSeconds <= 2592000 ? plan.price : 0;
        return sum + (monthlyPrice * plan.currentSubscribers);
      }, 0),
      activePlans: plans.filter(plan => plan.isActive).length,
    };

    res.json({
      success: true,
      data: {
        creator,
        ...stats,
      },
    });
  } catch (error) {
    next(error);
  }
});

export { router as paymentRoutes };
