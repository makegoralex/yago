import { Schema, model, type Document, Types } from 'mongoose';

export type DiscountType = 'fixed' | 'percentage';
export type DiscountScope = 'order' | 'category' | 'product';

export interface DiscountTimeWindow {
  autoApplyDays?: number[];
  autoApplyStart?: string;
  autoApplyEnd?: string;
}

export interface Discount {
  name: string;
  description?: string;
  type: DiscountType;
  scope: DiscountScope;
  value: number;
  categoryId?: Types.ObjectId;
  productId?: Types.ObjectId;
  autoApply: boolean;
  autoApplyDays?: number[];
  autoApplyStart?: string;
  autoApplyEnd?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type DiscountDocument = Document & Discount;

const discountSchema = new Schema<DiscountDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: false,
      trim: true,
    },
    type: {
      type: String,
      enum: ['fixed', 'percentage'],
      required: true,
    },
    scope: {
      type: String,
      enum: ['order', 'category', 'product'],
      required: true,
    },
    value: {
      type: Number,
      required: true,
      min: 0,
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: false,
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: false,
    },
    autoApply: {
      type: Boolean,
      required: false,
      default: false,
    },
    autoApplyDays: {
      type: [Number],
      required: false,
      default: undefined,
    },
    autoApplyStart: {
      type: String,
      required: false,
      trim: true,
    },
    autoApplyEnd: {
      type: String,
      required: false,
      trim: true,
    },
    isActive: {
      type: Boolean,
      required: false,
      default: true,
    },
  },
  { timestamps: true }
);

discountSchema.index({ isActive: 1, autoApply: 1 });
discountSchema.index({ scope: 1, categoryId: 1, productId: 1 });

export const DiscountModel = model<DiscountDocument>('Discount', discountSchema);
