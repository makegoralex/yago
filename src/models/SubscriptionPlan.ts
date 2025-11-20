import { Document, Schema, model } from 'mongoose';

export interface SubscriptionPlanDocument extends Document {
  name: string;
  cashRegisterLimit?: number;
  productLimit?: number;
  userLimit?: number;
  price?: number;
  trialPeriodDays?: number;
  createdAt: Date;
  updatedAt: Date;
}

const subscriptionPlanSchema = new Schema<SubscriptionPlanDocument>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    cashRegisterLimit: { type: Number, required: false },
    productLimit: { type: Number, required: false },
    userLimit: { type: Number, required: false },
    price: { type: Number, required: false },
    trialPeriodDays: { type: Number, required: false },
  },
  { timestamps: true }
);

export const SubscriptionPlanModel = model<SubscriptionPlanDocument>(
  'SubscriptionPlan',
  subscriptionPlanSchema
);
