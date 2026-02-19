import { Document, Schema, Types, model } from 'mongoose';

export type EvotorSaleCommandStatus = 'pending' | 'accepted' | 'failed';

export interface EvotorSaleCommand {
  organizationId: Types.ObjectId;
  orderId: Types.ObjectId;
  orderSnapshot: {
    id: string;
    status: string;
    total: number;
    items: Array<{ name: string; qty: number; total: number }>;
  };
  requestedByUserId?: Types.ObjectId;
  status: EvotorSaleCommandStatus;
  errorMessage?: string;
  processedAt?: Date;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type EvotorSaleCommandDocument = Document & EvotorSaleCommand;

const evotorSaleCommandSchema = new Schema<EvotorSaleCommandDocument>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    orderSnapshot: {
      id: { type: String, required: true },
      status: { type: String, required: true },
      total: { type: Number, required: true },
      items: [
        {
          name: { type: String, required: true },
          qty: { type: Number, required: true },
          total: { type: Number, required: true },
          _id: false,
        },
      ],
    },
    requestedByUserId: { type: Schema.Types.ObjectId, ref: 'User', required: false },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'failed'],
      default: 'pending',
      required: true,
      index: true,
    },
    errorMessage: { type: String, required: false },
    processedAt: { type: Date, required: false },
    expiresAt: { type: Date, required: true, index: true },
  },
  { timestamps: true }
);

evotorSaleCommandSchema.index({ organizationId: 1, status: 1, createdAt: 1 });
evotorSaleCommandSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const EvotorSaleCommandModel = model<EvotorSaleCommandDocument>(
  'EvotorSaleCommand',
  evotorSaleCommandSchema
);
