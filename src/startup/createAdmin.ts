import { hashPassword } from '../services/authService';
import { UserModel } from '../models/User';

const DEFAULT_ADMIN_EMAIL = 'admin@yago.coffee';
const DEFAULT_ADMIN_PASSWORD = 'admin123';

export const ensureDefaultAdminExists = async (): Promise<void> => {
  const existingAdmin = await UserModel.findOne({ email: DEFAULT_ADMIN_EMAIL });

  if (existingAdmin) {
    return;
  }

  const passwordHash = await hashPassword(DEFAULT_ADMIN_PASSWORD);

  await UserModel.create({
    name: 'Yago Admin',
    email: DEFAULT_ADMIN_EMAIL,
    passwordHash,
    role: 'admin',
  });

  console.log('Default admin user created: admin@yago.coffee / admin123');
};
