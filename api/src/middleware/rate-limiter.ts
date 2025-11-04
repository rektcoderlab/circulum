import { Request, Response, NextFunction } from 'express';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { logger } from '@core/utils/logger';

const rateLimiter = new RateLimiterMemory({
  points: 100, // Number of requests
  duration: 60, // Per 60 seconds
});

export const rateLimiterMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    await rateLimiter.consume(req.ip || 'unknown');
    next();
  } catch (rejRes: any) {
    const secs = Math.round(rejRes.msBeforeNext / 1000) || 1;
    
    logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
    
    res.set('Retry-After', String(secs));
    res.status(429).json({
      success: false,
      error: {
        message: 'Too many requests, please try again later.',
        retryAfter: secs,
      },
    });
  }
};

export { rateLimiterMiddleware as rateLimiter };
