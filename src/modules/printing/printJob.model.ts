import { Document, Schema, model } from 'mongoose';

export type PrintJobStatus = 'pending' | 'processing' | 'printed' | 'failed';

export interface PrintJob {
  registerId: string;
  status: PrintJobStatus;
  payload?: Record<string, unknown>;
  errorMessage?: string;
  processingStartedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type PrintJobDocument = Document & PrintJob;

const printJobSchema = new Schema<PrintJobDocument>(
  {
    registerId: { type: String, required: true, trim: true, index: true },
    status: {
      type: String,
      enum: ['pending', 'processing', 'printed', 'failed'],
      required: true,
      default: 'pending',
      index: true,
    },
    payload: { type: Schema.Types.Mixed },
    errorMessage: { type: String, trim: true },
    processingStartedAt: { type: Date },
    completedAt: { type: Date },
  },
  { timestamps: true }
);

printJobSchema.index({ registerId: 1, status: 1, createdAt: 1 });

export const PrintJobModel = model<PrintJobDocument>('PrintJob', printJobSchema);
