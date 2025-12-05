import { Document, Schema, model, Types } from 'mongoose';

export type SubscriptionPlan = 'trial' | 'paid';
export type SubscriptionStatus = 'active' | 'expired' | 'trial' | 'paused';

export type FiscalProviderMode = 'test' | 'prod';

export interface FiscalProviderSettings {
  enabled: boolean;
  provider: 'atol';
  mode: FiscalProviderMode;
  login: string;
  password: string;
  groupCode: string;
  inn: string;
  paymentAddress: string;
  deviceId?: string;
  lastTest?: {
    status: 'registered' | 'pending' | 'failed';
    testedAt: Date;
    receiptId?: string;
    message?: string;
  };
}

export interface OrganizationSettings {
  fiscalProvider?: FiscalProviderSettings;
  [key: string]: unknown;
}

export interface OrganizationDocument extends Document {
  _id: Types.ObjectId;
  name: string;
  ownerUserId?: Types.ObjectId;
  subscriptionPlan: SubscriptionPlan;
  trialEndsAt?: Date;
  nextPaymentDueAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  settings?: OrganizationSettings;
  subscriptionStatus: SubscriptionStatus;
}

const fiscalProviderSchema = new Schema<FiscalProviderSettings>(
  {
    enabled: { type: Boolean, default: false },
    provider: { type: String, enum: ['atol'], required: true, default: 'atol' },
    mode: { type: String, enum: ['test', 'prod'], required: true, default: 'test' },
    login: { type: String, required: true, trim: true },
    password: { type: String, required: true, trim: true },
    groupCode: { type: String, required: true, trim: true },
    inn: { type: String, required: true, trim: true },
    paymentAddress: { type: String, required: true, trim: true },
    deviceId: { type: String, required: false, trim: true },
    lastTest: {
      status: { type: String, enum: ['registered', 'pending', 'failed'], required: true },
      testedAt: { type: Date, required: true },
      receiptId: { type: String, required: false, trim: true },
      message: { type: String, required: false, trim: true },
    },
  },
  { _id: false }
);

const settingsSchema = new Schema<OrganizationSettings>(
  {
    fiscalProvider: { type: fiscalProviderSchema, required: false },
  },
  { _id: false, strict: false }
);

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
      enum: ['trial', 'paid'],
      required: true,
      trim: true,
      default: 'trial',
    },
    trialEndsAt: { type: Date, required: false },
    nextPaymentDueAt: { type: Date, required: false },
    settings: {
      type: settingsSchema,
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
