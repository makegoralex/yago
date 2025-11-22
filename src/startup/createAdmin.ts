import { hashPassword } from '../services/authService';
import { UserModel } from '../models/User';

const DEFAULT_OWNER_EMAIL = 'owner@yago.coffee';
const DEFAULT_OWNER_PASSWORD = 'owner123';

export const ensureDefaultOwnerExists = async (): Promise<void> => {
  const existingAdmin = await UserModel.findOne({ email: DEFAULT_OWNER_EMAIL });

  if (existingAdmin) {
    return;
  }

  const passwordHash = await hashPassword(DEFAULT_OWNER_PASSWORD);

  await UserModel.create({
    name: 'Yago Owner',
    email: DEFAULT_OWNER_EMAIL,
    passwordHash,
    role: 'owner',
  });

  console.log('Default owner user created: owner@yago.coffee / owner123');
};
