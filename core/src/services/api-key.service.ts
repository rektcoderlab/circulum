import crypto from 'crypto';
import { ApiKey, IApiKey } from '../models/api-key';
import { logger } from '../utils/logger';

export const AVAILABLE_PERMISSIONS = [
  'plans:read',
  'plans:write',
  'subscriptions:read',
  'subscriptions:write',
  'payments:read',
  'payments:write',
  'webhooks:read',
  'webhooks:write',
  'integration:read',
  'admin:read',
  'admin:write',
];

export interface CreateApiKeyData {
  name: string;
  permissions: string[];
  rateLimit?: number;
  createdBy?: string;
  metadata?: {
    description?: string;
    environment?: 'development' | 'staging' | 'production';
    ipWhitelist?: string[];
    expiresAt?: Date;
  };
}

export interface ApiKeyInfo {
  id: string;
  name: string;
  permissions: string[];
  rateLimit: number;
  isActive: boolean;
  createdBy?: string;
  createdAt: Date;
  lastUsed?: Date;
  usageCount: number;
  metadata?: {
    description?: string;
    environment?: 'development' | 'staging' | 'production';
    ipWhitelist?: string[];
    expiresAt?: Date;
  };
}

export class ApiKeyService {
  /**
   * Generate a new API key
   */
  private generateApiKey(environment: string = 'development'): string {
    const prefix = environment === 'production' ? 'sk_live' : 'sk_test';
    const randomBytes = crypto.randomBytes(24).toString('hex');
    return `${prefix}_${randomBytes}`;
  }

  /**
   * Hash an API key for secure storage
   */
  private hashApiKey(apiKey: string): string {
    return crypto.createHash('sha256').update(apiKey).digest('hex');
  }

  /**
   * Create API key preview (first 12 chars + last 4 chars)
   */
  private createKeyPreview(apiKey: string): string {
    if (apiKey.length < 16) return apiKey;
    return `${apiKey.substring(0, 12)}...${apiKey.substring(apiKey.length - 4)}`;
  }

  /**
   * Create a new API key
   */
  async createApiKey(data: CreateApiKeyData): Promise<{ apiKey: IApiKey; rawKey: string }> {
    try {
      const environment = data.metadata?.environment || 'development';
      const rawKey = this.generateApiKey(environment);
      const keyHash = this.hashApiKey(rawKey);
      const keyPreview = this.createKeyPreview(rawKey);

      const apiKey = new ApiKey({
        name: data.name,
        keyHash,
        keyPreview,
        permissions: data.permissions,
        rateLimit: data.rateLimit || 1000,
        createdBy: data.createdBy,
        metadata: data.metadata,
      });

      await apiKey.save();
      
      logger.info(`Created API key: ${apiKey.name} (${apiKey._id})`);
      
      return { apiKey, rawKey };
    } catch (error) {
      logger.error('Failed to create API key:', error);
      throw error;
    }
  }

  /**
   * Verify an API key and return key info
   */
  async verifyApiKey(rawKey: string): Promise<ApiKeyInfo | null> {
    try {
      const keyHash = this.hashApiKey(rawKey);
      const apiKey = await ApiKey.findOne({ 
        keyHash, 
        isActive: true 
      });

      if (!apiKey) {
        return null;
      }

      // Check if key is expired
      if (apiKey.metadata?.expiresAt && apiKey.metadata.expiresAt < new Date()) {
        logger.warn(`Expired API key attempted: ${apiKey.keyPreview}`);
        return null;
      }

      // Update last used timestamp and usage count
      await ApiKey.updateOne(
        { _id: apiKey._id },
        { 
          $set: { lastUsed: new Date() },
          $inc: { usageCount: 1 }
        }
      );

      return {
        id: apiKey._id.toString(),
        name: apiKey.name,
        permissions: apiKey.permissions,
        rateLimit: apiKey.rateLimit,
        isActive: apiKey.isActive,
        createdBy: apiKey.createdBy,
        createdAt: apiKey.createdAt,
        lastUsed: new Date(), // Use current time since we just updated it
        usageCount: apiKey.usageCount + 1,
        metadata: apiKey.metadata,
      };
    } catch (error) {
      logger.error('Failed to verify API key:', error);
      return null;
    }
  }

  /**
   * Get all API keys (without sensitive data)
   */
  async getAllApiKeys(filters?: {
    isActive?: boolean;
    environment?: string;
    createdBy?: string;
  }): Promise<ApiKeyInfo[]> {
    try {
      const query: any = {};
      
      if (filters?.isActive !== undefined) {
        query.isActive = filters.isActive;
      }
      
      if (filters?.environment) {
        query['metadata.environment'] = filters.environment;
      }
      
      if (filters?.createdBy) {
        query.createdBy = filters.createdBy;
      }

      const apiKeys = await ApiKey.find(query)
        .sort({ createdAt: -1 })
        .lean();

      return apiKeys.map(key => ({
        id: key._id.toString(),
        name: key.name,
        permissions: key.permissions,
        rateLimit: key.rateLimit,
        isActive: key.isActive,
        createdBy: key.createdBy,
        createdAt: key.createdAt,
        lastUsed: key.lastUsed,
        usageCount: key.usageCount,
        metadata: key.metadata,
      }));
    } catch (error) {
      logger.error('Failed to get API keys:', error);
      throw error;
    }
  }

  /**
   * Get API key by ID
   */
  async getApiKeyById(id: string): Promise<ApiKeyInfo | null> {
    try {
      const apiKey = await ApiKey.findById(id).lean();
      
      if (!apiKey) {
        return null;
      }

      return {
        id: apiKey._id.toString(),
        name: apiKey.name,
        permissions: apiKey.permissions,
        rateLimit: apiKey.rateLimit,
        isActive: apiKey.isActive,
        createdBy: apiKey.createdBy,
        createdAt: apiKey.createdAt,
        lastUsed: apiKey.lastUsed,
        usageCount: apiKey.usageCount,
        metadata: apiKey.metadata,
      };
    } catch (error) {
      logger.error('Failed to get API key by ID:', error);
      return null;
    }
  }

  /**
   * Update API key
   */
  async updateApiKey(id: string, updates: Partial<CreateApiKeyData>): Promise<ApiKeyInfo | null> {
    try {
      const apiKey = await ApiKey.findByIdAndUpdate(
        id,
        { $set: updates },
        { new: true, runValidators: true }
      ).lean();

      if (!apiKey) {
        return null;
      }

      logger.info(`Updated API key: ${apiKey.name} (${id})`);

      return {
        id: apiKey._id.toString(),
        name: apiKey.name,
        permissions: apiKey.permissions,
        rateLimit: apiKey.rateLimit,
        isActive: apiKey.isActive,
        createdBy: apiKey.createdBy,
        createdAt: apiKey.createdAt,
        lastUsed: apiKey.lastUsed,
        usageCount: apiKey.usageCount,
        metadata: apiKey.metadata,
      };
    } catch (error) {
      logger.error('Failed to update API key:', error);
      throw error;
    }
  }

  /**
   * Deactivate API key
   */
  async deactivateApiKey(id: string): Promise<boolean> {
    try {
      const result = await ApiKey.updateOne(
        { _id: id },
        { $set: { isActive: false } }
      );

      if (result.modifiedCount > 0) {
        logger.info(`Deactivated API key: ${id}`);
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Failed to deactivate API key:', error);
      return false;
    }
  }

  /**
   * Delete API key permanently
   */
  async deleteApiKey(id: string): Promise<boolean> {
    try {
      const result = await ApiKey.deleteOne({ _id: id });
      
      if (result.deletedCount > 0) {
        logger.info(`Deleted API key: ${id}`);
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Failed to delete API key:', error);
      return false;
    }
  }

  /**
   * Get API key usage statistics
   */
  async getUsageStats(timeRange?: { start: Date; end: Date }): Promise<{
    totalKeys: number;
    activeKeys: number;
    totalUsage: number;
    keysByEnvironment: Record<string, number>;
    topKeys: Array<{ name: string; usageCount: number; lastUsed?: Date }>;
  }> {
    try {
      const pipeline: any[] = [
        {
          $group: {
            _id: null,
            totalKeys: { $sum: 1 },
            activeKeys: {
              $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
            },
            totalUsage: { $sum: '$usageCount' },
          }
        }
      ];

      const [stats] = await ApiKey.aggregate(pipeline);
      
      // Get keys by environment
      const envStats = await ApiKey.aggregate([
        {
          $group: {
            _id: '$metadata.environment',
            count: { $sum: 1 }
          }
        }
      ]);

      const keysByEnvironment = envStats.reduce((acc, item) => {
        acc[item._id || 'unknown'] = item.count;
        return acc;
      }, {});

      // Get top 10 most used keys
      const topKeys = await ApiKey.find({}, 'name usageCount lastUsed')
        .sort({ usageCount: -1 })
        .limit(10)
        .lean();

      return {
        totalKeys: stats?.totalKeys || 0,
        activeKeys: stats?.activeKeys || 0,
        totalUsage: stats?.totalUsage || 0,
        keysByEnvironment,
        topKeys: topKeys.map(key => ({
          name: key.name,
          usageCount: key.usageCount,
          lastUsed: key.lastUsed,
        })),
      };
    } catch (error) {
      logger.error('Failed to get usage stats:', error);
      throw error;
    }
  }

  /**
   * Clean up expired API keys
   */
  async cleanupExpiredKeys(): Promise<number> {
    try {
      const result = await ApiKey.updateMany(
        {
          'metadata.expiresAt': { $lt: new Date() },
          isActive: true
        },
        { $set: { isActive: false } }
      );

      if (result.modifiedCount > 0) {
        logger.info(`Deactivated ${result.modifiedCount} expired API keys`);
      }

      return result.modifiedCount;
    } catch (error) {
      logger.error('Failed to cleanup expired keys:', error);
      return 0;
    }
  }
}

// Export singleton instance
export const apiKeyService = new ApiKeyService();
