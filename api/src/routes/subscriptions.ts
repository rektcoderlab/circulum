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

/**
 * @swagger
 * /api/subscriptions:
 *   post:
 *     summary: Subscribe to a plan
 *     description: Create a new subscription to a creator's plan
 *     tags: [Subscriptions]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - subscriber
 *               - creator
 *               - planId
 *             properties:
 *               subscriber:
 *                 type: string
 *                 description: Subscriber's Solana public key
 *                 example: "BxS9v7KJH3HnBKuYxmqHkJgfFqqYPbHPk9Xzm24VwTmq"
 *               creator:
 *                 type: string
 *                 description: Creator's Solana public key
 *                 example: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"
 *               planId:
 *                 type: integer
 *                 description: Plan ID to subscribe to
 *                 example: 0
 *     responses:
 *       201:
 *         description: Successfully subscribed to plan
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
 *                     transactionSignature:
 *                       type: string
 *                     subscriber:
 *                       type: string
 *                     creator:
 *                       type: string
 *                     planId:
 *                       type: integer
 *                     message:
 *                       type: string
 *       400:
 *         description: Invalid request data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized - Invalid API key
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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

/**
 * @swagger
 * /api/subscriptions/{subscriber}/{planId}:
 *   get:
 *     summary: Get subscription details
 *     description: Retrieve details of a specific subscription
 *     tags: [Subscriptions]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: subscriber
 *         required: true
 *         schema:
 *           type: string
 *         description: Subscriber's Solana public key
 *       - in: path
 *         name: planId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Plan ID
 *     responses:
 *       200:
 *         description: Subscription details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Subscription'
 *       404:
 *         description: Subscription not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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

/**
 * @swagger
 * /api/subscriptions/subscriber/{subscriber}:
 *   get:
 *     summary: Get all subscriptions for a subscriber
 *     description: Retrieve all subscriptions for a specific subscriber
 *     tags: [Subscriptions]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: subscriber
 *         required: true
 *         schema:
 *           type: string
 *         description: Subscriber's Solana public key
 *     responses:
 *       200:
 *         description: List of subscriptions retrieved successfully
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
 *                     $ref: '#/components/schemas/Subscription'
 */
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

/**
 * @swagger
 * /api/subscriptions:
 *   delete:
 *     summary: Cancel a subscription
 *     description: Cancel an existing subscription
 *     tags: [Subscriptions]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - subscriber
 *               - creator
 *               - planId
 *             properties:
 *               subscriber:
 *                 type: string
 *                 description: Subscriber's Solana public key
 *               creator:
 *                 type: string
 *                 description: Creator's Solana public key
 *               planId:
 *                 type: integer
 *                 description: Plan ID to cancel
 *     responses:
 *       200:
 *         description: Subscription cancelled successfully
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
 *                     transactionSignature:
 *                       type: string
 *                     subscriber:
 *                       type: string
 *                     creator:
 *                       type: string
 *                     planId:
 *                       type: integer
 *                     message:
 *                       type: string
 */
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

/**
 * @swagger
 * /api/subscriptions/{subscriber}/{planId}/status:
 *   get:
 *     summary: Get subscription status
 *     description: Check if a subscription payment is due and get payment information
 *     tags: [Subscriptions]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: subscriber
 *         required: true
 *         schema:
 *           type: string
 *         description: Subscriber's Solana public key
 *       - in: path
 *         name: planId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Plan ID
 *     responses:
 *       200:
 *         description: Subscription status retrieved successfully
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
 *                     isActive:
 *                       type: boolean
 *                     isPaymentDue:
 *                       type: boolean
 *                     nextPayment:
 *                       type: integer
 *                       description: Unix timestamp
 *                     timeUntilNextPayment:
 *                       type: integer
 *                       description: Seconds until next payment
 *                     totalPayments:
 *                       type: integer
 *                     lastPayment:
 *                       type: integer
 *                       description: Unix timestamp
 */
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
