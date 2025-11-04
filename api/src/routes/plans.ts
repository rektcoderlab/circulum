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

/**
 * @swagger
 * /api/plans:
 *   post:
 *     summary: Create a new subscription plan
 *     description: Create a new subscription plan for a creator
 *     tags: [Plans]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - creator
 *               - planId
 *               - price
 *               - intervalSeconds
 *               - maxSubscribers
 *               - metadataUri
 *             properties:
 *               creator:
 *                 type: string
 *                 description: Creator's Solana public key
 *                 example: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"
 *               planId:
 *                 type: integer
 *                 description: Unique plan ID
 *                 example: 0
 *               price:
 *                 type: integer
 *                 description: Subscription price in lamports
 *                 example: 1000000000
 *               intervalSeconds:
 *                 type: integer
 *                 description: Payment interval in seconds
 *                 example: 2592000
 *               maxSubscribers:
 *                 type: integer
 *                 description: Maximum number of subscribers
 *                 example: 1000
 *               metadataUri:
 *                 type: string
 *                 format: uri
 *                 description: URI to plan metadata
 *                 example: "https://example.com/plan-metadata.json"
 *     responses:
 *       201:
 *         description: Plan created successfully
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
 *                     planId:
 *                       type: integer
 *                     creator:
 *                       type: string
 *                     price:
 *                       type: integer
 *                     intervalSeconds:
 *                       type: integer
 *                     maxSubscribers:
 *                       type: integer
 *                     metadataUri:
 *                       type: string
 *       400:
 *         description: Invalid request data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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

/**
 * @swagger
 * /api/plans/{creator}/{planId}:
 *   get:
 *     summary: Get subscription plan details
 *     description: Retrieve details of a specific subscription plan
 *     tags: [Plans]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: creator
 *         required: true
 *         schema:
 *           type: string
 *         description: Creator's Solana public key
 *       - in: path
 *         name: planId
 *         required: true
 *         schema:
 *           type: string
 *         description: Plan ID
 *     responses:
 *       200:
 *         description: Plan details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Plan'
 *       404:
 *         description: Plan not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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

/**
 * @swagger
 * /api/plans/creator/{creator}:
 *   get:
 *     summary: Get all plans for a creator
 *     description: Retrieve all subscription plans for a specific creator
 *     tags: [Plans]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: creator
 *         required: true
 *         schema:
 *           type: string
 *         description: Creator's Solana public key
 *     responses:
 *       200:
 *         description: List of plans retrieved successfully
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
 *                     $ref: '#/components/schemas/Plan'
 */
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

/**
 * @swagger
 * /api/plans/{creator}/{planId}:
 *   put:
 *     summary: Update subscription plan
 *     description: Update an existing subscription plan
 *     tags: [Plans]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: creator
 *         required: true
 *         schema:
 *           type: string
 *         description: Creator's Solana public key
 *       - in: path
 *         name: planId
 *         required: true
 *         schema:
 *           type: string
 *         description: Plan ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               price:
 *                 type: integer
 *                 description: Updated subscription price in lamports
 *               intervalSeconds:
 *                 type: integer
 *                 description: Updated payment interval in seconds
 *               maxSubscribers:
 *                 type: integer
 *                 description: Updated maximum number of subscribers
 *               metadataUri:
 *                 type: string
 *                 format: uri
 *                 description: Updated URI to plan metadata
 *     responses:
 *       200:
 *         description: Plan updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 */
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

/**
 * @swagger
 * /api/plans/{creator}/{planId}:
 *   delete:
 *     summary: Deactivate subscription plan
 *     description: Deactivate an existing subscription plan
 *     tags: [Plans]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: creator
 *         required: true
 *         schema:
 *           type: string
 *         description: Creator's Solana public key
 *       - in: path
 *         name: planId
 *         required: true
 *         schema:
 *           type: string
 *         description: Plan ID
 *     responses:
 *       200:
 *         description: Plan deactivated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 */
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
