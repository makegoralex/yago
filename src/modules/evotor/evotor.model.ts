import { Document, Schema, Types, model } from 'mongoose';

export interface EvotorDevice {
  organizationId?: Types.ObjectId;
  userId?: string;
  inn?: string;
  userToken: string;
  deviceUuid?: string;
  storeUuid?: string;
  appUuid?: string;
  registerId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type EvotorDeviceDocument = Document & EvotorDevice;

const evotorDeviceSchema = new Schema<EvotorDeviceDocument>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: false, index: true },
    userId: { type: String, required: false, index: true, trim: true },
    inn: { type: String, required: false, trim: true },
    userToken: { type: String, required: true, trim: true },
    deviceUuid: { type: String, required: false, trim: true, index: true },
    storeUuid: { type: String, required: false, trim: true },
    appUuid: { type: String, required: false, trim: true },
    registerId: { type: String, required: false, trim: true },
  },
  { timestamps: true }
);

evotorDeviceSchema.index({ organizationId: 1, deviceUuid: 1 });

evotorDeviceSchema.index({ userId: 1, appUuid: 1 }, { unique: true, sparse: true });

export const EvotorDeviceModel = model<EvotorDeviceDocument>('EvotorDevice', evotorDeviceSchema);
