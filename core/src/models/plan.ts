import mongoose, { Schema, Document } from 'mongoose';

export interface IPlan extends Document {
  _id: string;
  creator: string;
  name: string;
  description?: string;
  amount: number;
  currency: string;
  intervalSeconds: number;
  maxSubscribers?: number;
  currentSubscribers: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const planSchema = new Schema<IPlan>({
  creator: {
    type: String,
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true
  },
  description: {
    type: String
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    required: true,
    default: 'SOL'
  },
  intervalSeconds: {
    type: Number,
    required: true,
    min: 1
  },
  maxSubscribers: {
    type: Number,
    min: 1
  },
  currentSubscribers: {
    type: Number,
    default: 0,
    min: 0
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  }
}, {
  timestamps: true
});

// Compound indexes
planSchema.index({ creator: 1, isActive: 1 });

export const Plan = mongoose.model<IPlan>('Plan', planSchema);
