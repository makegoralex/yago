import { Document, Schema, Types, model } from 'mongoose';

export type FiscalTaskStatus = 'queued' | 'in_progress' | 'done' | 'error';

export interface FiscalTask {
  organizationId: Types.ObjectId;
  fiscalDeviceId: Types.ObjectId;
  type: string;
  payload: unknown;
  status: FiscalTaskStatus;
  fnCode?: string;
  error?: string;
  attempts: number;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type FiscalTaskDocument = Document & FiscalTask;

const fiscalTaskSchema = new Schema<FiscalTaskDocument>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    fiscalDeviceId: { type: Schema.Types.ObjectId, ref: 'FiscalDevice', required: true, index: true },
    type: { type: String, required: true, trim: true },
    payload: { type: Schema.Types.Mixed, required: true },
    status: {
      type: String,
      enum: ['queued', 'in_progress', 'done', 'error'],
      required: true,
      default: 'queued',
      index: true,
    },
    fnCode: { type: String, required: false, trim: true },
    error: { type: String, required: false, trim: true },
    attempts: { type: Number, required: true, default: 0, min: 0 },
    startedAt: { type: Date, required: false },
    completedAt: { type: Date, required: false },
  },
  { timestamps: true, minimize: false }
);

fiscalTaskSchema.index({ fiscalDeviceId: 1, status: 1, createdAt: 1 });
fiscalTaskSchema.index({ organizationId: 1, status: 1, createdAt: 1 });

export const FiscalTaskModel = model<FiscalTaskDocument>('FiscalTask', fiscalTaskSchema);
