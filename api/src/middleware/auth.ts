import { Request, Response, NextFunction } from 'express';
import { createError } from './error-handler';
import { logger } from '@/utils/logger';
import { ApiKeyService, ApiKeyInfo } from '@/core/services/api-key.service';

// Extended Request interface to include API key info
export interface AuthenticatedRequest extends Request {
  apiKey?: ApiKeyInfo;
}

/**
 * Middleware to authenticate API requests using API keys
 */
export const authenticateApiKey = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return next(createError('Authorization header is required', 401));
  }

  const [scheme, token] = authHeader.split(' ');
  
  if (scheme !== 'Bearer' || !token) {
    return next(createError('Invalid authorization format. Use: Bearer <api-key>', 401));
  }

  try {
    const apiKeyData = await apiKeyService.verifyApiKey(token);
    
    if (!apiKeyData) {
      logger.warn(`Invalid API key attempted: ${token.substring(0, 12)}...`);
      return next(createError('Invalid or inactive API key', 401));
    }

    // Attach API key info to request
    req.apiKey = apiKeyData;

    logger.info(`Authenticated request with API key: ${apiKeyData.name} (${apiKeyData.id})`);
    next();
  } catch (error) {
    logger.error('Error verifying API key:', error);
    return next(createError('Authentication failed', 401));
  }
};

/**
 * Middleware to check if the authenticated API key has required permissions
 */
export const requirePermissions = (requiredPermissions: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.apiKey) {
      return next(createError('Authentication required', 401));
    }

    const hasAllPermissions = requiredPermissions.every(permission => 
      req.apiKey!.permissions.includes(permission)
    );

    if (!hasAllPermissions) {
      logger.warn(`Insufficient permissions for API key ${req.apiKey.id}. Required: ${requiredPermissions.join(', ')}, Has: ${req.apiKey.permissions.join(', ')}`);
      return next(createError(`Insufficient permissions. Required: ${requiredPermissions.join(', ')}`, 403));
    }

    next();
  };
};

/**
 * Optional authentication middleware - doesn't fail if no API key is provided
 */
export const optionalAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return next(); // Continue without authentication
  }

  const [scheme, token] = authHeader.split(' ');
  
  if (scheme !== 'Bearer' || !token) {
    return next(); // Continue without authentication
  }

  try {
    const apiKeyData = await apiKeyService.verifyApiKey(token);
    
    if (apiKeyData) {
      req.apiKey = apiKeyData;
      logger.info(`Optional auth successful for API key: ${apiKeyData.name}`);
    }
  } catch (error) {
    logger.debug('Optional auth failed, continuing without authentication:', error);
  }

  next();
};

/**
 * Middleware to validate webhook signatures
 */
export const validateWebhookSignature = (req: Request, res: Response, next: NextFunction) => {
  const signature = req.headers['x-circulum-signature'] as string;
  const timestamp = req.headers['x-circulum-timestamp'] as string;
  
  if (!signature || !timestamp) {
    return next(createError('Missing webhook signature or timestamp', 400));
  }

  // In a real implementation, you would verify the signature using the webhook secret
  // const expectedSignature = crypto.createHmac('sha256', webhookSecret)
  //   .update(timestamp + JSON.stringify(req.body))
  //   .digest('hex');
  
  // For now, we'll just validate the format
  if (!signature.startsWith('sha256=')) {
    return next(createError('Invalid signature format', 400));
  }

  // Check timestamp to prevent replay attacks (5 minutes tolerance)
  const webhookTimestamp = parseInt(timestamp);
  const currentTimestamp = Math.floor(Date.now() / 1000);
  
  if (Math.abs(currentTimestamp - webhookTimestamp) > 300) {
    return next(createError('Webhook timestamp too old', 400));
  }

  next();
};

/**
 * Rate limiting based on API key tier
 */
export const apiKeyRateLimit = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.apiKey) {
    return next(); // Use default rate limiting
  }

  // In a real implementation, you would implement custom rate limiting based on API key
  // For now, we'll just log the rate limit info
  logger.debug(`API key ${req.apiKey.id} has rate limit: ${req.apiKey.rateLimit} requests/minute`);
  
  next();
};

/**
 * Utility function to check if API key has specific permission
 */
export const hasPermission = (req: AuthenticatedRequest, permission: string): boolean => {
  return req.apiKey?.permissions.includes(permission) || false;
};

/**
 * Utility function to get API key info from request
 */
export const getApiKeyInfo = (req: AuthenticatedRequest) => {
  return req.apiKey || null;
};
