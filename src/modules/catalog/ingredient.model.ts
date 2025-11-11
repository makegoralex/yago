import { Schema, model, type Document, Types } from 'mongoose';

export interface Ingredient {
  name: string;
  unit: string;
  costPerUnit?: number;
  supplierId?: Types.ObjectId;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IngredientDocument extends Document, Ingredient {}

const ingredientSchema = new Schema<IngredientDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    unit: {
      type: String,
      required: true,
      trim: true,
    },
    costPerUnit: {
      type: Number,
      required: false,
      min: 0,
    },
    supplierId: {
      type: Schema.Types.ObjectId,
      ref: 'Supplier',
      required: false,
    },
    description: {
      type: String,
      required: false,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

export const IngredientModel = model<IngredientDocument>('Ingredient', ingredientSchema);
