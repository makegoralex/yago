import { Types } from 'mongoose';

export type PrintJobStatus = 'pending' | 'printed' | 'failed';

export type PrintJobPaymentMethod = 'cash' | 'card';

export interface PrintJobModifierOption {
  name: string;
  price: number;
}

export interface PrintJobModifier {
  groupName: string;
  options: PrintJobModifierOption[];
}

export interface PrintJobItem {
  name: string;
  qty: number;
  price: number;
  modifiers?: PrintJobModifier[];
}

export interface PrintJobPayload {
  orderId: Types.ObjectId;
  organizationId: Types.ObjectId;
  registerId: string;
  cashierId: Types.ObjectId;
  paymentMethod: PrintJobPaymentMethod;
  total: number;
  items: PrintJobItem[];
}
