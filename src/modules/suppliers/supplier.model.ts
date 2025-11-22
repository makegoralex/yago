import { Schema, model, type Document, type Types } from 'mongoose';

export interface Supplier {
  organizationId: Types.ObjectId;
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
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
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

supplierSchema.index({ organizationId: 1, name: 1 }, { unique: true });

export const SupplierModel = model<SupplierDocument>('Supplier', supplierSchema);
