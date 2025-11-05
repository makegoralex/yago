import { Schema, model, Document, Types } from 'mongoose';

export interface Category {
  name: string;
  sortOrder?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CategoryDocument extends Document, Category {}

const categorySchema = new Schema<CategoryDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    sortOrder: {
      type: Number,
      required: false,
    },
  },
  {
    timestamps: true,
  }
);

export const CategoryModel = model<CategoryDocument>('Category', categorySchema);

export interface Product {
  name: string;
  categoryId: Types.ObjectId;
  price: number;
  modifiers?: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductDocument extends Document, Product {}

const productSchema = new Schema<ProductDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    modifiers: {
      type: [String],
      required: false,
      default: undefined,
    },
    isActive: {
      type: Boolean,
      required: false,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

productSchema.index({ categoryId: 1 });

export const ProductModel = model<ProductDocument>('Product', productSchema);
