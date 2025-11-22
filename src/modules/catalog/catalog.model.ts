import { Schema, model, Document, Types } from 'mongoose';

import type { ModifierGroupDocument } from './modifierGroup.model';

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

export const ProductModel = model<ProductDocument>('Product', productSchema);
