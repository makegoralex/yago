import { Schema, model, type Document, Types } from 'mongoose';

export interface StockReceiptItem {
  itemType: 'ingredient' | 'product';
  itemId: Types.ObjectId;
  quantity: number;
  unitCost: number;
}

export interface StockReceipt {
  organizationId: Types.ObjectId;
  type: 'receipt' | 'writeOff' | 'inventory';
  occurredAt: Date;
  warehouseId: Types.ObjectId;
  supplierId?: Types.ObjectId;
  createdBy: Types.ObjectId;
  items: StockReceiptItem[];
  createdAt: Date;
  updatedAt: Date;
}

export interface StockReceiptDocument extends StockReceipt, Document {}

const stockReceiptItemSchema = new Schema<StockReceiptItem>(
  {
    itemType: { type: String, enum: ['ingredient', 'product'], required: true },
    itemId: { type: Schema.Types.ObjectId, required: true },
    quantity: { type: Number, required: true, min: 0 },
    unitCost: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const stockReceiptSchema = new Schema<StockReceiptDocument>(
  {
    type: {
      type: String,
      enum: ['receipt', 'writeOff', 'inventory'],
      required: true,
      default: 'receipt',
    },
    occurredAt: { type: Date, required: true, default: () => new Date() },
    warehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', required: true },
    supplierId: { type: Schema.Types.ObjectId, ref: 'Supplier', required: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    items: { type: [stockReceiptItemSchema], required: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  },
  { timestamps: true }
);

stockReceiptSchema.index({ organizationId: 1, occurredAt: -1 });

export const StockReceiptModel = model<StockReceiptDocument>('StockReceipt', stockReceiptSchema);
