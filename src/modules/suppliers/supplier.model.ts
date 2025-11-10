import { Schema, model, type Document } from 'mongoose';

export interface Supplier {
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SupplierDocument extends Document, Supplier {}

const supplierSchema = new Schema<SupplierDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    contactName: {
      type: String,
      required: false,
      trim: true,
    },
    phone: {
      type: String,
      required: false,
      trim: true,
    },
    email: {
      type: String,
      required: false,
      trim: true,
      lowercase: true,
    },
    address: {
      type: String,
      required: false,
      trim: true,
    },
    notes: {
      type: String,
      required: false,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

export const SupplierModel = model<SupplierDocument>('Supplier', supplierSchema);
