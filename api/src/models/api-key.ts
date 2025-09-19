import mongoose, { Document, Schema } from 'mongoose';

export interface IApiKey extends Document {
  _id: string;
  name: string;
  keyHash: string;
  keyPreview: string;
  permissions: string[];
  rateLimit: number;
  isActive: boolean;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
  lastUsed?: Date;
  usageCount: number;
  metadata?: {
    description?: string;
    environment?: 'development' | 'staging' | 'production';
    ipWhitelist?: string[];
    expiresAt?: Date;
  };
}

const ApiKeySchema = new Schema<IApiKey>({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
  },
  keyHash: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  keyPreview: {
    type: String,
    required: true,
  },
  permissions: [{
    type: String,
    enum: [
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
    ],
  }],
  rateLimit: {
    type: Number,
    default: 1000,
    min: 10,
    max: 100000,
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true,
  },
  createdBy: {
    type: String,
    trim: true,
  },
  lastUsed: {
    type: Date,
  },
  usageCount: {
    type: Number,
    default: 0,
  },
  metadata: {
    description: String,
    environment: {
      type: String,
      enum: ['development', 'staging', 'production'],
      default: 'development',
    },
    ipWhitelist: [String],
    expiresAt: Date,
  },
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret: any) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      delete ret.keyHash; // Never expose the hash
      return ret;
    },
  },
});

// Indexes for performance
ApiKeySchema.index({ keyHash: 1 });
ApiKeySchema.index({ isActive: 1 });
ApiKeySchema.index({ createdAt: -1 });
ApiKeySchema.index({ lastUsed: -1 });

// Pre-save middleware to ensure keyHash is always set
ApiKeySchema.pre('save', function(next) {
  if (!this.keyHash) {
    throw new Error('keyHash is required');
  }
  next();
});

export const ApiKey = mongoose.model<IApiKey>('ApiKey', ApiKeySchema);
