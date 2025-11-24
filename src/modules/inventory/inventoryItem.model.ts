import { Schema, model, type Document, Types } from 'mongoose';

export type InventoryItemType = 'ingredient' | 'product';

export interface InventoryItem {
  warehouseId: Types.ObjectId;
  itemType: InventoryItemType;
  itemId: Types.ObjectId;
  quantity: number;
  unitCost?: number;
  updatedBy?: Types.ObjectId;
  organizationId: Schema.Types.ObjectId;
  updatedAt: Date;
  createdAt: Date;
}

export interface InventoryItemDocument extends Document, InventoryItem {}

const inventoryItemSchema = new Schema<InventoryItemDocument>(
  {
    warehouseId: {
      type: Schema.Types.ObjectId,
      ref: 'Warehouse',
      required: true,
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    itemType: {
      type: String,
      enum: ['ingredient', 'product'],
      required: true,
    },
    itemId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    unitCost: {
      type: Number,
      required: false,
      min: 0,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
  },
  {
    timestamps: true,
  }
);

inventoryItemSchema.index({ organizationId: 1, warehouseId: 1, itemType: 1, itemId: 1 }, { unique: true });

export const InventoryItemModel = model<InventoryItemDocument>('InventoryItem', inventoryItemSchema);
