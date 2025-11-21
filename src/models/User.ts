import { Schema, model, Document, Types } from 'mongoose';

export type UserRole =
  | 'admin'
  | 'manager'
  | 'cashier'
  | 'barista'
  | 'owner'
  | 'superAdmin';

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  organizationId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: false,
      index: true,
    },
    role: {
      type: String,
      enum: ['admin', 'manager', 'cashier', 'barista', 'owner', 'superAdmin'],
      default: 'cashier',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.index({ email: 1, organizationId: 1 }, { unique: true, sparse: true });

export const UserModel = model<IUser>('User', userSchema);
