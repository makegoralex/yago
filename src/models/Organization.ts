import { Document, Schema, model, Types } from 'mongoose';

export type SubscriptionStatus = 'active' | 'expired' | 'trial' | 'paused';

export interface OrganizationSettings {
  [key: string]: unknown;
}

export interface OrganizationDocument extends Document {
  name: string;
  ownerUserId?: Types.ObjectId;
  subscriptionPlan?: string;
  createdAt: Date;
  updatedAt: Date;
  settings?: OrganizationSettings;
  subscriptionStatus: SubscriptionStatus;
}

const organizationSchema = new Schema<OrganizationDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    ownerUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    subscriptionPlan: {
      type: String,
      required: false,
      trim: true,
    },
    settings: {
      type: Schema.Types.Mixed,
      required: false,
      default: {},
    },
    subscriptionStatus: {
      type: String,
      enum: ['active', 'expired', 'trial', 'paused'],
      default: 'trial',
      required: true,
    },
  },
  { timestamps: true }
);

organizationSchema.index({ name: 1 }, { unique: true });

export const OrganizationModel = model<OrganizationDocument>('Organization', organizationSchema);
