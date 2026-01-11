import { Schema, model, Document } from 'mongoose';

import type { PrintJobPayload, PrintJobStatus } from './printJob.types';

export interface PrintJob {
  status: PrintJobStatus;
  payload: PrintJobPayload;
  createdAt: Date;
  updatedAt: Date;
}

export type PrintJobDocument = Document & PrintJob;

const modifierOptionSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const modifierSchema = new Schema(
  {
    groupName: { type: String, required: true, trim: true },
    options: { type: [modifierOptionSchema], default: [] },
  },
  { _id: false }
);

const itemSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    qty: { type: Number, required: true, min: 0 },
    price: { type: Number, required: true, min: 0 },
    modifiers: { type: [modifierSchema], required: false, default: undefined },
  },
  { _id: false }
);

const payloadSchema = new Schema(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    registerId: { type: String, required: true, trim: true },
    cashierId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    paymentMethod: { type: String, enum: ['cash', 'card'], required: true },
    total: { type: Number, required: true, min: 0 },
    items: { type: [itemSchema], default: [] },
  },
  { _id: false }
);

const printJobSchema = new Schema<PrintJobDocument>(
  {
    status: {
      type: String,
      enum: ['pending', 'printed', 'failed'],
      required: true,
      default: 'pending',
    },
    payload: { type: payloadSchema, required: true },
  },
  { timestamps: true }
);

printJobSchema.index({ status: 1, createdAt: 1 });
printJobSchema.index({ 'payload.organizationId': 1, createdAt: -1 });

export const PrintJobModel = model<PrintJobDocument>('PrintJob', printJobSchema);
