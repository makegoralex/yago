import { Schema, model, Document, Types } from 'mongoose';

import type { ModifierGroupDocument } from './modifierGroup.model';
import { DEFAULT_PRODUCT_UNIT, PRODUCT_UNITS, type ProductUnit } from './productUnit';

export interface ProductIngredient {
  ingredientId: Types.ObjectId;
  quantity: number;
  unit?: string;
}

export interface Category {
  name: string;
  sortOrder?: number;
  organizationId: Types.ObjectId;
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
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
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
  organizationId: Types.ObjectId;
  description?: string;
  price: number;
  basePrice?: number;
  costPrice?: number;
  unit: ProductUnit;
  manufacturer?: string;
  sku?: string;
  barcode?: string;
  discountType?: 'percentage' | 'fixed';
  discountValue?: number;
  imageUrl?: string;
  modifierGroups?: Types.ObjectId[] | ModifierGroupDocument[];
  ingredients?: ProductIngredient[];
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
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
    },
    description: {
      type: String,
      required: false,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    basePrice: {
      type: Number,
      required: false,
      min: 0,
    },
    costPrice: {
      type: Number,
      required: false,
      min: 0,
    },
    unit: {
      type: String,
      enum: PRODUCT_UNITS,
      required: false,
      default: DEFAULT_PRODUCT_UNIT,
    },
    manufacturer: {
      type: String,
      required: false,
      trim: true,
    },
    sku: {
      type: String,
      required: false,
      trim: true,
      uppercase: true,
    },
    barcode: {
      type: String,
      required: false,
      trim: true,
    },
    discountType: {
      type: String,
      enum: ['percentage', 'fixed'],
      required: false,
    },
    discountValue: {
      type: Number,
      required: false,
      min: 0,
    },
    imageUrl: {
      type: String,
      required: false,
      trim: true,
    },
    modifierGroups: [
      {
        type: Schema.Types.ObjectId,
        ref: 'ModifierGroup',
      },
    ],
    ingredients: {
      type: [
        {
          ingredientId: {
            type: Schema.Types.ObjectId,
            ref: 'Ingredient',
            required: true,
          },
          quantity: {
            type: Number,
            required: true,
            min: 0,
          },
          unit: {
            type: String,
            required: false,
            trim: true,
          },
        },
      ],
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
productSchema.index({ organizationId: 1, isActive: 1, categoryId: 1 });
productSchema.index({ organizationId: 1, sku: 1 }, { unique: true, sparse: true });
productSchema.index({ organizationId: 1, barcode: 1 }, { unique: true, sparse: true });

export const ProductModel = model<ProductDocument>('Product', productSchema);
