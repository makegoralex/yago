import { Schema, model, type Document } from 'mongoose';

export type ModifierSelectionType = 'single' | 'multiple';

export interface ModifierOption {
  name: string;
  priceChange?: number;
  costChange?: number;
}

export interface ModifierGroup {
  name: string;
  selectionType: ModifierSelectionType;
  required: boolean;
  sortOrder?: number;
  options: ModifierOption[];
  organizationId?: Schema.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface ModifierGroupDocument extends Document, ModifierGroup {}

const modifierOptionSchema = new Schema<ModifierOption>(
  {
    name: { type: String, required: true, trim: true },
    priceChange: { type: Number, required: false, default: 0 },
    costChange: { type: Number, required: false, default: 0 },
  },
  { _id: true }
);

const modifierGroupSchema = new Schema<ModifierGroupDocument>(
  {
    name: { type: String, required: true, trim: true },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: false,
      index: true,
    },
    selectionType: { type: String, enum: ['single', 'multiple'], required: true, default: 'single' },
    required: { type: Boolean, required: true, default: false },
    sortOrder: { type: Number, required: false },
    options: { type: [modifierOptionSchema], default: [] },
  },
  { timestamps: true }
);

modifierGroupSchema.index({ sortOrder: 1, name: 1 });

export const ModifierGroupModel = model<ModifierGroupDocument>('ModifierGroup', modifierGroupSchema);
