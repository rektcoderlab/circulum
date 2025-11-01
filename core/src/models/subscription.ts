import mongoose, { Schema, Document } from 'mongoose';

export interface ISubscription extends Document {
  _id: string;
  creator: string;
  subscriber: string;
  planId: string;
  status: 'active' | 'paused' | 'cancelled' | 'expired';
  nextPayment: number;
  lastPayment?: number;
  failedPayments: number;
  totalPayments: number;
  createdAt: Date;
  updatedAt: Date;
}

const subscriptionSchema = new Schema<ISubscription>({
  creator: {
    type: String,
    required: true,
    index: true
  },
  subscriber: {
    type: String,
    required: true,
    index: true
  },
  planId: {
    type: String,
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['active', 'paused', 'cancelled', 'expired'],
    default: 'active',
    index: true
  },
  nextPayment: {
    type: Number,
    required: true,
    index: true
  },
  lastPayment: {
    type: Number
  },
  failedPayments: {
    type: Number,
    default: 0
  },
  totalPayments: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Compound indexes for efficient queries
subscriptionSchema.index({ status: 1, nextPayment: 1 });
subscriptionSchema.index({ creator: 1, status: 1 });
subscriptionSchema.index({ subscriber: 1, status: 1 });

export const Subscription = mongoose.model<ISubscription>('Subscription', subscriptionSchema);
