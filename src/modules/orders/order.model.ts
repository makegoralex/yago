import { Schema, model, Types, Document } from 'mongoose';

export type OrderStatus = 'draft' | 'paid' | 'fiscalized' | 'cancelled';

export interface OrderItem {
  productId: Types.ObjectId;
  name: string;
  qty: number;
  price: number;
  modifiersApplied?: string[];
  total: number;
}

export interface OrderTotals {
  subtotal: number;
  discount?: number;
  tax?: number;
  grandTotal: number;
}

export type PaymentMethod = 'cash' | 'card' | 'loyalty';

export interface OrderPayment {
  method: PaymentMethod;
  amount: number;
  txnId?: string;
}

export interface Order {
  orgId: string;
  locationId: string;
  registerId: string;
  cashierId: string;
  customerId?: Types.ObjectId;
  items: OrderItem[];
  totals: OrderTotals;
  payments: OrderPayment[];
  status: OrderStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type OrderDocument = Document & Order;

const orderItemSchema = new Schema<OrderItem>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true, trim: true },
    qty: { type: Number, required: true, min: 0 },
    price: { type: Number, required: true, min: 0 },
    modifiersApplied: {
      type: [String],
      required: false,
      default: undefined,
    },
    total: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const orderTotalsSchema = new Schema<OrderTotals>(
  {
    subtotal: { type: Number, required: true, min: 0 },
    discount: { type: Number, required: false, min: 0 },
    tax: { type: Number, required: false, min: 0 },
    grandTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const paymentSchema = new Schema<OrderPayment>(
  {
    method: {
      type: String,
      enum: ['cash', 'card', 'loyalty'],
      required: true,
    },
    amount: { type: Number, required: true, min: 0 },
    txnId: { type: String },
  },
  { _id: false }
);

const orderSchema = new Schema<OrderDocument>(
  {
    orgId: { type: String, required: true, trim: true },
    locationId: { type: String, required: true, trim: true },
    registerId: { type: String, required: true, trim: true },
    cashierId: { type: String, required: true, trim: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer' },
    items: { type: [orderItemSchema], default: [] },
    totals: { type: orderTotalsSchema, required: true },
    payments: { type: [paymentSchema], default: [] },
    status: {
      type: String,
      enum: ['draft', 'paid', 'fiscalized', 'cancelled'],
      required: true,
      default: 'draft',
    },
  },
  { timestamps: true }
);

orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ 'items.productId': 1 });
orderSchema.index({ customerId: 1 });

export const OrderModel = model<OrderDocument>('Order', orderSchema);
