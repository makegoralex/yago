import { Schema, model, Document } from 'mongoose';

export interface Customer {
  name: string;
  phone: string;
  email?: string;
  points: number;
  totalSpent: number;
  createdAt: Date;
  updatedAt: Date;
}

export type CustomerDocument = Customer & Document;

const customerSchema = new Schema<CustomerDocument>(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true, unique: true },
    email: { type: String, trim: true },
    points: { type: Number, default: 0, min: 0 },
    totalSpent: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

customerSchema.index({ phone: 1 }, { unique: true });

export const CustomerModel = model<CustomerDocument>('Customer', customerSchema);
