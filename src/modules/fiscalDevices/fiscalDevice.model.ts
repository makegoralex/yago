import { Document, Schema, Types, model } from 'mongoose';

export type FiscalDeviceType = 'atol50f';
export type FiscalDeviceStatus = 'online' | 'offline' | 'error' | 'unknown';
export type FiscalDeviceShiftState = 'open' | 'closed' | 'unknown';

export interface FiscalDeviceAuth {
  login?: string;
  password?: string;
}

export interface FiscalDevice {
  orgId: string;
  organizationId: Types.ObjectId;
  type: FiscalDeviceType;
  name: string;
  ip: string;
  port: number;
  taxationSystem?: string;
  operatorName?: string;
  operatorVatin?: string;
  status: FiscalDeviceStatus;
  lastPing?: Date;
  lastShiftState?: FiscalDeviceShiftState;
  lastError?: string;
  auth?: FiscalDeviceAuth;
  createdAt: Date;
  updatedAt: Date;
}

export type FiscalDeviceDocument = Document & FiscalDevice;

const authSchema = new Schema<FiscalDeviceAuth>(
  {
    login: { type: String, trim: true },
    password: { type: String },
  },
  { _id: false }
);

const fiscalDeviceSchema = new Schema<FiscalDeviceDocument>(
  {
    orgId: { type: String, required: true, trim: true, index: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    type: { type: String, enum: ['atol50f'], required: true, default: 'atol50f' },
    name: { type: String, required: true, trim: true },
    ip: { type: String, required: true, trim: true },
    port: { type: Number, required: true, min: 1, max: 65535 },
    taxationSystem: { type: String, required: false, trim: true },
    operatorName: { type: String, required: false, trim: true },
    operatorVatin: { type: String, required: false, trim: true },
    status: {
      type: String,
      enum: ['online', 'offline', 'error', 'unknown'],
      required: true,
      default: 'unknown',
    },
    lastPing: { type: Date, required: false },
    lastShiftState: { type: String, enum: ['open', 'closed', 'unknown'], required: false },
    lastError: { type: String, required: false, trim: true },
    auth: { type: authSchema, required: false },
  },
  { timestamps: true }
);

fiscalDeviceSchema.index({ organizationId: 1, ip: 1, port: 1 }, { unique: true });

export const FiscalDeviceModel = model<FiscalDeviceDocument>('FiscalDevice', fiscalDeviceSchema);
