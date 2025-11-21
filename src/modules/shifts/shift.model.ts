import { Schema, model, Types, Document } from 'mongoose';

export type ShiftStatus = 'open' | 'closed';

export interface ShiftTotals {
  cash: number;
  card: number;
  total: number;
}

export interface Shift {
  orgId: string;
  organizationId: Schema.Types.ObjectId;
  locationId: string;
  registerId: string;
  cashierId: Types.ObjectId;
  openedBy: Types.ObjectId;
  closedBy?: Types.ObjectId;
  openedAt: Date;
  closedAt?: Date;
  openingBalance?: number;
  closingBalance?: number;
  openingNote?: string;
  closingNote?: string;
  totals?: ShiftTotals;
  status: ShiftStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type ShiftDocument = Document & Shift;

const totalsSchema = new Schema<ShiftTotals>(
  {
    cash: { type: Number, required: false, default: 0, min: 0 },
    card: { type: Number, required: false, default: 0, min: 0 },
    total: { type: Number, required: false, default: 0, min: 0 },
  },
  { _id: false }
);

const shiftSchema = new Schema<ShiftDocument>(
  {
    orgId: { type: String, required: true, trim: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    locationId: { type: String, required: true, trim: true },
    registerId: { type: String, required: true, trim: true },
    cashierId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    openedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    closedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    openedAt: { type: Date, required: true, default: () => new Date() },
    closedAt: { type: Date },
    openingBalance: { type: Number, min: 0 },
    closingBalance: { type: Number, min: 0 },
    openingNote: { type: String, trim: true },
    closingNote: { type: String, trim: true },
    totals: { type: totalsSchema, required: false },
    status: {
      type: String,
      enum: ['open', 'closed'],
      required: true,
      default: 'open',
    },
  },
  { timestamps: true }
);

shiftSchema.index({ registerId: 1, openedAt: -1 });
shiftSchema.index({ locationId: 1, openedAt: -1 });
shiftSchema.index({ cashierId: 1, openedAt: -1 });
shiftSchema.index({ status: 1 });
shiftSchema.index({ organizationId: 1, status: 1 });

shiftSchema.pre('save', function updateStatus(this: ShiftDocument, next: () => void) {
  this.status = this.closedAt ? 'closed' : 'open';
  next();
});

shiftSchema.pre('findOneAndUpdate', function adjustStatus(this: any, next: () => void) {
  const update = this.getUpdate() as Partial<ShiftDocument> & { $set?: Partial<ShiftDocument> };
  const closedAt = update?.closedAt ?? update?.$set?.closedAt;

  if (closedAt !== undefined) {
    this.set({ status: closedAt ? 'closed' : 'open' });
  }

  next();
});

export const ShiftModel = model<ShiftDocument>('Shift', shiftSchema);
