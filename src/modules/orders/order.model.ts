import { Schema, model, Types, Document } from 'mongoose';

export type OrderStatus = 'draft' | 'paid' | 'completed';

export type PaymentMethod = 'cash' | 'card';

export interface OrderItem {
  productId: Types.ObjectId;
  name: string;
  qty: number;
  price: number;
  modifiersApplied?: string[];
  total: number;
}

export interface OrderPayment {
  method: PaymentMethod;
  amount: number;
  change?: number;
}

export interface Order {
  orgId: string;
  locationId: string;
  registerId: string;
  cashierId: Types.ObjectId;
  warehouseId?: Types.ObjectId;
  customerId?: Types.ObjectId;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  total: number;
  payment?: OrderPayment;
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

const paymentSchema = new Schema<OrderPayment>(
  {
    method: {
      type: String,
      enum: ['cash', 'card'],
      required: true,
    },
    amount: { type: Number, required: true, min: 0 },
    change: { type: Number, required: false, min: 0 },
  },
  { _id: false }
);

const orderSchema = new Schema<OrderDocument>(
  {
    orgId: { type: String, required: true, trim: true },
    locationId: { type: String, required: true, trim: true },
    registerId: { type: String, required: true, trim: true },
    cashierId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    warehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse' },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer' },
    items: { type: [orderItemSchema], default: [] },
    subtotal: { type: Number, required: true, min: 0, default: 0 },
    discount: { type: Number, required: true, min: 0, default: 0 },
    total: { type: Number, required: true, min: 0, default: 0 },
    payment: { type: paymentSchema, required: false },
    status: {
      type: String,
      enum: ['draft', 'paid', 'completed'],
      required: true,
      default: 'draft',
    },
  },
  { timestamps: true }
);

orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ 'items.productId': 1 });
orderSchema.index({ customerId: 1 });
orderSchema.index({ cashierId: 1, status: 1 });
orderSchema.index({ warehouseId: 1 });

export const OrderModel = model<OrderDocument>('Order', orderSchema);
