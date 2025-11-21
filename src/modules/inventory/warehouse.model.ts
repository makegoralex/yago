import { Schema, model, type Document } from 'mongoose';

export interface Warehouse {
  name: string;
  location?: string;
  description?: string;
  lastInventoryAt?: Date;
  organizationId: Schema.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface WarehouseDocument extends Document, Warehouse {}

const warehouseSchema = new Schema<WarehouseDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    location: {
      type: String,
      required: false,
      trim: true,
    },
    description: {
      type: String,
      required: false,
      trim: true,
    },
    lastInventoryAt: {
      type: Date,
      required: false,
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

export const WarehouseModel = model<WarehouseDocument>('Warehouse', warehouseSchema);
