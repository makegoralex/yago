import { Schema, model, type Document, Types } from 'mongoose';

export interface InventoryAuditItem {
  itemType: 'ingredient' | 'product';
  itemId: Types.ObjectId;
  previousQuantity: number;
  countedQuantity: number;
  difference: number;
  unitCostSnapshot?: number;
}

export interface InventoryAudit {
  organizationId: Types.ObjectId;
  warehouseId: Types.ObjectId;
  performedBy: Types.ObjectId;
  performedAt: Date;
  items: InventoryAuditItem[];
  totalLossValue: number;
  totalGainValue: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface InventoryAuditDocument extends InventoryAudit, Document {}

const inventoryAuditItemSchema = new Schema<InventoryAuditItem>(
  {
    itemType: { type: String, enum: ['ingredient', 'product'], required: true },
    itemId: { type: Schema.Types.ObjectId, required: true },
    previousQuantity: { type: Number, required: true, min: 0 },
    countedQuantity: { type: Number, required: true, min: 0 },
    difference: { type: Number, required: true },
    unitCostSnapshot: { type: Number, required: false, min: 0 },
  },
  { _id: false }
);

const inventoryAuditSchema = new Schema<InventoryAuditDocument>(
  {
    warehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', required: true },
    performedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    performedAt: { type: Date, required: true, default: () => new Date() },
    items: { type: [inventoryAuditItemSchema], required: true },
    totalLossValue: { type: Number, required: true, default: 0 },
    totalGainValue: { type: Number, required: true, default: 0 },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  },
  { timestamps: true }
);

inventoryAuditSchema.index({ organizationId: 1, performedAt: -1 });

export const InventoryAuditModel = model<InventoryAuditDocument>('InventoryAudit', inventoryAuditSchema);
