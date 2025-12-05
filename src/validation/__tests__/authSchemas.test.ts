import { authSchemas } from '../authSchemas';

describe('authSchemas.register', () => {
  it('rejects missing email', () => {
    const result = authSchemas.register.safeParse({ name: 'User', password: 'secret' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid role', () => {
    const result = authSchemas.register.safeParse({
      name: 'User',
      email: 'user@example.com',
      password: 'secret',
      role: 'manager',
    });

    expect(result.success).toBe(false);
  });
});

describe('authSchemas.login', () => {
  it('requires password', () => {
    const result = authSchemas.login.safeParse({ email: 'user@example.com' });
    expect(result.success).toBe(false);
  });
});

describe('authSchemas.refresh', () => {
  it('requires refreshToken', () => {
    const result = authSchemas.refresh.safeParse({});
    expect(result.success).toBe(false);
  });
});
