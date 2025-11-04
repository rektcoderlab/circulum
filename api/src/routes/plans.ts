import { Router, Request, Response, NextFunction } from 'express';
import { PublicKey } from '@solana/web3.js';
import Joi from 'joi';
import { CirculumService } from '@core/services/circulum.service';
import { createError } from '@/middleware/error-handler';
import { logger } from '@core/utils/logger';
import { authenticateApiKey, requirePermissions } from '@/middleware/auth';

const router = Router();

// Validation schemas
const createPlanSchema = Joi.object({
  creator: Joi.string().required(),
  planId: Joi.number().integer().min(0).required(),
  price: Joi.number().integer().min(0).required(),
  intervalSeconds: Joi.number().integer().min(1).required(),
  maxSubscribers: Joi.number().integer().min(1).required(),
  metadataUri: Joi.string().uri().required(),
});

const getPlanSchema = Joi.object({
  creator: Joi.string().required(),
  planId: Joi.string().required(),
});

// Apply authentication middleware to all plan routes
router.use(authenticateApiKey);

// Create a new subscription plan
router.post('/', requirePermissions(['write:plans']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = createPlanSchema.validate(req.body);
    if (error) {
      throw createError(error.details[0].message, 400);
    }

    const { creator, planId, price, intervalSeconds, maxSubscribers, metadataUri } = value;
    const circulumService: CirculumService = req.app.locals.circulumService;

    const creatorPubkey = new PublicKey(creator);
    const txSignature = await circulumService.createSubscriptionPlan(
      creatorPubkey,
      planId,
      price,
      intervalSeconds,
      maxSubscribers,
      metadataUri
    );

    logger.info(`Created subscription plan ${planId} for creator ${creator}`);

    res.status(201).json({
      success: true,
      data: {
        transactionSignature: txSignature,
        planId,
        creator,
        price,
        intervalSeconds,
        maxSubscribers,
        metadataUri,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get subscription plan details
router.get('/:creator/:planId', requirePermissions(['read:plans']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = getPlanSchema.validate(req.params);
    if (error) {
      throw createError(error.details[0].message, 400);
    }

    const { creator, planId } = value;
    const circulumService: CirculumService = req.app.locals.circulumService;

    const creatorPubkey = new PublicKey(creator);
    const plan = await circulumService.getSubscriptionPlan(creatorPubkey, parseInt(planId));

    if (!plan) {
      throw createError('Subscription plan not found', 404);
    }

    res.json({
      success: true,
      data: {
        ...plan,
        creator: plan.creator.toString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get all plans for a creator
router.get('/creator/:creator', requirePermissions(['read:plans']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const creator = req.params.creator;
    if (!creator) {
      throw createError('Creator address is required', 400);
    }

    const circulumService: CirculumService = req.app.locals.circulumService;
    const creatorPubkey = new PublicKey(creator);
    const plans = await circulumService.getCreatorPlans(creatorPubkey);

    res.json({
      success: true,
      data: plans.map(plan => ({
        ...plan,
        creator: plan.creator.toString(),
      })),
    });
  } catch (error) {
    next(error);
  }
});

// Update subscription plan
router.put('/:creator/:planId', requirePermissions(['write:plans']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { creator, planId } = req.params;
    const updates = req.body;

    if (!creator || !planId) {
      throw createError('Creator address and plan ID are required', 400);
    }

    // In a real implementation, you would call the smart contract update function
    logger.info(`Updating subscription plan ${planId} for creator ${creator}`);

    res.json({
      success: true,
      message: 'Subscription plan updated successfully',
      data: {
        creator,
        planId: parseInt(planId),
        updates,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Deactivate subscription plan
router.delete('/:creator/:planId', requirePermissions(['write:plans']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { creator, planId } = req.params;

    if (!creator || !planId) {
      throw createError('Creator address and plan ID are required', 400);
    }

    // In a real implementation, you would call the smart contract deactivate function
    logger.info(`Deactivating subscription plan ${planId} for creator ${creator}`);

    res.json({
      success: true,
      message: 'Subscription plan deactivated successfully',
      data: {
        creator,
        planId: parseInt(planId),
      },
    });
  } catch (error) {
    next(error);
  }
});

export { router as planRoutes };
