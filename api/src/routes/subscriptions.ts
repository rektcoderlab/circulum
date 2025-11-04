import { Router, Request, Response, NextFunction } from 'express';
import { PublicKey } from '@solana/web3.js';
import Joi from 'joi';
import { CirculumService } from '@core/services/circulum.service';
import { createError } from '@/middleware/error-handler';
import { logger } from '@core/utils/logger';
import { authenticateApiKey, requirePermissions } from '@/middleware/auth';

const router = Router();

// Validation schemas
const subscribeSchema = Joi.object({
  subscriber: Joi.string().required(),
  creator: Joi.string().required(),
  planId: Joi.number().integer().min(0).required(),
});

const cancelSubscriptionSchema = Joi.object({
  subscriber: Joi.string().required(),
  creator: Joi.string().required(),
  planId: Joi.number().integer().min(0).required(),
});

// Apply authentication middleware to all subscription routes
router.use(authenticateApiKey);

// Subscribe to a plan
router.post('/', requirePermissions(['write:subscriptions']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = subscribeSchema.validate(req.body);
    if (error) {
      throw createError(error.details[0].message, 400);
    }

    const { subscriber, creator, planId } = value;
    const circulumService: CirculumService = req.app.locals.circulumService;

    const subscriberPubkey = new PublicKey(subscriber);
    const creatorPubkey = new PublicKey(creator);

    const txSignature = await circulumService.subscribe(
      subscriberPubkey,
      creatorPubkey,
      planId
    );

    logger.info(`User ${subscriber} subscribed to plan ${planId} from creator ${creator}`);

    res.status(201).json({
      success: true,
      data: {
        transactionSignature: txSignature,
        subscriber,
        creator,
        planId,
        message: 'Successfully subscribed to plan',
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get subscription details
router.get('/:subscriber/:planId', requirePermissions(['read:subscriptions']), async (req: Request, res: Response, next: NextFunction) => {
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

    res.json({
      success: true,
      data: {
        ...subscription,
        subscriber: subscription.subscriber.toString(),
        creator: subscription.creator.toString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get all subscriptions for a subscriber
router.get('/subscriber/:subscriber', requirePermissions(['read:subscriptions']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const subscriber = req.params.subscriber;
    if (!subscriber) {
      throw createError('Subscriber address is required', 400);
    }

    const circulumService: CirculumService = req.app.locals.circulumService;
    const subscriberPubkey = new PublicKey(subscriber);
    const subscriptions = await circulumService.getSubscriberSubscriptions(subscriberPubkey);

    res.json({
      success: true,
      data: subscriptions.map(subscription => ({
        ...subscription,
        subscriber: subscription.subscriber.toString(),
        creator: subscription.creator.toString(),
      })),
    });
  } catch (error) {
    next(error);
  }
});

// Cancel subscription
router.delete('/', requirePermissions(['write:subscriptions']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = cancelSubscriptionSchema.validate(req.body);
    if (error) {
      throw createError(error.details[0].message, 400);
    }

    const { subscriber, creator, planId } = value;
    const circulumService: CirculumService = req.app.locals.circulumService;

    const subscriberPubkey = new PublicKey(subscriber);
    const creatorPubkey = new PublicKey(creator);

    const txSignature = await circulumService.cancelSubscription(
      subscriberPubkey,
      creatorPubkey,
      planId
    );

    logger.info(`User ${subscriber} cancelled subscription to plan ${planId} from creator ${creator}`);

    res.json({
      success: true,
      data: {
        transactionSignature: txSignature,
        subscriber,
        creator,
        planId,
        message: 'Subscription cancelled successfully',
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get subscription status (check if payment is due)
router.get('/:subscriber/:planId/status', requirePermissions(['read:subscriptions']), async (req: Request, res: Response, next: NextFunction) => {
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

    const currentTime = Math.floor(Date.now() / 1000);
    const isPaymentDue = currentTime >= subscription.nextPayment;
    const timeUntilNextPayment = subscription.nextPayment - currentTime;

    res.json({
      success: true,
      data: {
        isActive: subscription.isActive,
        isPaymentDue,
        nextPayment: subscription.nextPayment,
        timeUntilNextPayment: Math.max(0, timeUntilNextPayment),
        totalPayments: subscription.totalPayments,
        lastPayment: subscription.lastPayment,
      },
    });
  } catch (error) {
    next(error);
  }
});

export { router as subscriptionRoutes };
