import { Schema, model, Types, Document } from 'mongoose';

export type ShiftStatus = 'open' | 'closed';

export interface Shift {
  orgId: string;
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
  status: ShiftStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type ShiftDocument = Document & Shift;

const shiftSchema = new Schema<ShiftDocument>(
  {
    orgId: { type: String, required: true, trim: true },
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

shiftSchema.pre('save', function updateStatus(next) {
  this.status = this.closedAt ? 'closed' : 'open';
  next();
});

shiftSchema.pre('findOneAndUpdate', function adjustStatus(next) {
  const update = this.getUpdate() as Partial<ShiftDocument> & { $set?: Partial<ShiftDocument> };
  const closedAt = update?.closedAt ?? update?.$set?.closedAt;

  if (closedAt !== undefined) {
    this.set({ status: closedAt ? 'closed' : 'open' });
  }

  next();
});

export const ShiftModel = model<ShiftDocument>('Shift', shiftSchema);
