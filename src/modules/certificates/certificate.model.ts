import { Schema, model, type Document, Types } from 'mongoose';

export interface Certificate {
  organizationId: Types.ObjectId;
  code: string;
  nominal: number;
  remaining: number;
  categoryIds: Types.ObjectId[];
  multiUse: boolean;
  isActive: boolean;
  usedAt?: Date;
}

export type CertificateDocument = Document & Certificate;

const certificateSchema = new Schema<CertificateDocument>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    nominal: { type: Number, required: true, min: 0 },
    remaining: { type: Number, required: true, min: 0 },
    categoryIds: { type: [Schema.Types.ObjectId], ref: 'Category', default: [] },
    multiUse: { type: Boolean, required: true, default: false },
    isActive: { type: Boolean, required: true, default: true },
    usedAt: { type: Date, required: false },
  },
  { timestamps: true }
);

certificateSchema.index({ organizationId: 1, code: 1 }, { unique: true });

export const CertificateModel = model<CertificateDocument>('Certificate', certificateSchema);
