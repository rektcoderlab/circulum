import crypto from 'crypto';
import { logger } from '../utils/logger';

export interface WebhookEvent {
  id: string;
  type: string;
  data: any;
  timestamp: number;
  version: string;
}

export interface Webhook {
  id: string;
  url: string;
  events: string[];
  secret: string;
  active: boolean;
  createdAt: string;
  lastTriggered?: string;
  failureCount: number;
}

export class WebhookService {
  private webhooks: Map<string, Webhook> = new Map();
  private eventQueue: WebhookEvent[] = [];
  private processing = false;

  constructor() {
    // Start processing webhook events
    this.startEventProcessor();
  }

  /**
   * Register a new webhook
   */
  registerWebhook(webhook: Omit<Webhook, 'id' | 'createdAt' | 'failureCount'>): Webhook {
    const id = `webhook_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const newWebhook: Webhook = {
      ...webhook,
      id,
      createdAt: new Date().toISOString(),
      failureCount: 0,
    };

    this.webhooks.set(id, newWebhook);
    logger.info(`Registered webhook ${id} for URL ${webhook.url}`);
    
    return newWebhook;
  }

  /**
   * Get all registered webhooks
   */
  getWebhooks(): Webhook[] {
    return Array.from(this.webhooks.values());
  }

  /**
   * Get a specific webhook by ID
   */
  getWebhook(id: string): Webhook | undefined {
    return this.webhooks.get(id);
  }

  /**
   * Update a webhook
   */
  updateWebhook(id: string, updates: Partial<Webhook>): Webhook | null {
    const webhook = this.webhooks.get(id);
    if (!webhook) {
      return null;
    }

    const updatedWebhook = { ...webhook, ...updates };
    this.webhooks.set(id, updatedWebhook);
    
    logger.info(`Updated webhook ${id}`);
    return updatedWebhook;
  }

  /**
   * Delete a webhook
   */
  deleteWebhook(id: string): boolean {
    const deleted = this.webhooks.delete(id);
    if (deleted) {
      logger.info(`Deleted webhook ${id}`);
    }
    return deleted;
  }

  /**
   * Emit an event to all relevant webhooks
   */
  async emitEvent(eventType: string, data: any): Promise<void> {
    const event: WebhookEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      type: eventType,
      data,
      timestamp: Math.floor(Date.now() / 1000),
      version: '1.0',
    };

    this.eventQueue.push(event);
    logger.info(`Queued webhook event: ${eventType} (${event.id})`);

    // Process immediately if not already processing
    if (!this.processing) {
      this.processEventQueue();
    }
  }

  /**
   * Start the event processor
   */
  private startEventProcessor(): void {
    // Process events every 5 seconds
    setInterval(() => {
      if (!this.processing && this.eventQueue.length > 0) {
        this.processEventQueue();
      }
    }, 5000);
  }

  /**
   * Process the event queue
   */
  private async processEventQueue(): Promise<void> {
    if (this.processing || this.eventQueue.length === 0) {
      return;
    }

    this.processing = true;
    logger.info(`Processing ${this.eventQueue.length} webhook events`);

    while (this.eventQueue.length > 0) {
      const event = this.eventQueue.shift()!;
      await this.processEvent(event);
    }

    this.processing = false;
  }

  /**
   * Process a single event
   */
  private async processEvent(event: WebhookEvent): Promise<void> {
    const relevantWebhooks = Array.from(this.webhooks.values()).filter(
      webhook => webhook.active && webhook.events.includes(event.type)
    );

    if (relevantWebhooks.length === 0) {
      logger.debug(`No webhooks registered for event type: ${event.type}`);
      return;
    }

    logger.info(`Sending event ${event.id} to ${relevantWebhooks.length} webhooks`);

    // Send to all relevant webhooks in parallel
    const promises = relevantWebhooks.map(webhook => 
      this.sendWebhook(webhook, event)
    );

    await Promise.allSettled(promises);
  }

  /**
   * Send webhook to a specific endpoint
   */
  private async sendWebhook(webhook: Webhook, event: WebhookEvent): Promise<void> {
    try {
      const payload = JSON.stringify(event);
      const signature = this.generateSignature(payload, webhook.secret);
      const timestamp = Math.floor(Date.now() / 1000).toString();

      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Circulum-Webhooks/1.0',
          'X-Circulum-Signature': `sha256=${signature}`,
          'X-Circulum-Timestamp': timestamp,
          'X-Circulum-Event-Type': event.type,
          'X-Circulum-Event-Id': event.id,
        },
        body: payload,
      });

      if (response.ok) {
        logger.info(`Webhook ${webhook.id} delivered successfully to ${webhook.url}`);
        
        // Reset failure count on success
        if (webhook.failureCount > 0) {
          this.updateWebhook(webhook.id, { 
            failureCount: 0, 
            lastTriggered: new Date().toISOString() 
          });
        } else {
          this.updateWebhook(webhook.id, { 
            lastTriggered: new Date().toISOString() 
          });
        }
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      logger.error(`Failed to deliver webhook ${webhook.id} to ${webhook.url}:`, error);
      
      // Increment failure count
      const newFailureCount = webhook.failureCount + 1;
      this.updateWebhook(webhook.id, { failureCount: newFailureCount });

      // Disable webhook after 5 consecutive failures
      if (newFailureCount >= 5) {
        logger.warn(`Disabling webhook ${webhook.id} after ${newFailureCount} consecutive failures`);
        this.updateWebhook(webhook.id, { active: false });
      }
    }
  }

  /**
   * Generate HMAC signature for webhook payload
   */
  private generateSignature(payload: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }

  /**
   * Verify webhook signature
   */
  verifySignature(payload: string, signature: string, secret: string): boolean {
    const expectedSignature = this.generateSignature(payload, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  }

  /**
   * Get webhook statistics
   */
  getWebhookStats(): {
    totalWebhooks: number;
    activeWebhooks: number;
    totalEvents: number;
    failedWebhooks: number;
  } {
    const webhooks = Array.from(this.webhooks.values());
    
    return {
      totalWebhooks: webhooks.length,
      activeWebhooks: webhooks.filter(w => w.active).length,
      totalEvents: this.eventQueue.length,
      failedWebhooks: webhooks.filter(w => w.failureCount > 0).length,
    };
  }

  /**
   * Test a webhook endpoint
   */
  async testWebhook(webhookId: string): Promise<{ success: boolean; message: string; responseTime?: number }> {
    const webhook = this.webhooks.get(webhookId);
    if (!webhook) {
      return { success: false, message: 'Webhook not found' };
    }

    const testEvent: WebhookEvent = {
      id: `test_${Date.now()}`,
      type: 'webhook.test',
      data: {
        message: 'This is a test webhook event',
        timestamp: new Date().toISOString(),
      },
      timestamp: Math.floor(Date.now() / 1000),
      version: '1.0',
    };

    const startTime = Date.now();
    
    try {
      await this.sendWebhook(webhook, testEvent);
      const responseTime = Date.now() - startTime;
      
      return {
        success: true,
        message: 'Test webhook delivered successfully',
        responseTime,
      };
    } catch (error) {
      return {
        success: false,
        message: `Test webhook failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}

// Export singleton instance
export const webhookService = new WebhookService();

// Helper functions for common webhook events
export const emitSubscriptionCreated = (subscription: any) => {
  webhookService.emitEvent('subscription.created', subscription);
};

export const emitSubscriptionCancelled = (subscription: any) => {
  webhookService.emitEvent('subscription.cancelled', subscription);
};

export const emitPaymentProcessed = (payment: any) => {
  webhookService.emitEvent('payment.processed', payment);
};

export const emitPaymentFailed = (payment: any) => {
  webhookService.emitEvent('payment.failed', payment);
};

export const emitPlanCreated = (plan: any) => {
  webhookService.emitEvent('plan.created', plan);
};

export const emitPlanUpdated = (plan: any) => {
  webhookService.emitEvent('plan.updated', plan);
};

export const emitPlanDeactivated = (plan: any) => {
  webhookService.emitEvent('plan.deactivated', plan);
};
