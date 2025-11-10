import { Schema, model, type Document } from 'mongoose';

export interface Warehouse {
  name: string;
  location?: string;
  description?: string;
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
  },
  {
    timestamps: true,
  }
);

export const WarehouseModel = model<WarehouseDocument>('Warehouse', warehouseSchema);
