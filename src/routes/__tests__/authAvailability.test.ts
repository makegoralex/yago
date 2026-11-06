import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import fetch from 'node-fetch';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

import { appConfig } from '../../config/env';
import { UserModel } from '../../models/User';
import { OrganizationModel } from '../../models/Organization';
import { AuthenticationError } from '../../services/authErrors';
import { authenticateUser } from '../../services/authService';
import { authRouter } from '../auth';

jest.mock('../../services/authService', () => ({
  ...jest.requireActual('../../services/authService'),
  authenticateUser: jest.fn(),
}));

const login = jest.mocked(authenticateUser);
const user = { id: '507f1f77bcf86cd799439011', email: 'cashier@example.com', name: 'Cashier', role: 'cashier' };
const unavailable = new Error('Database connection timed out');
let server: Server;
let baseUrl: string;
const previousSecrets = { access: appConfig.jwtAccessSecret, refresh: appConfig.jwtRefreshSecret };

const post = async (path: string, body: unknown) => fetch(`${baseUrl}/${path}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});
const token = (secret: string, expiresIn = 60) => jwt.sign({ sub: user.id }, secret, { expiresIn });

beforeAll(async () => {
  appConfig.jwtAccessSecret = 'test-access-secret';
  appConfig.jwtRefreshSecret = 'test-refresh-secret';
  const app = express();
  app.use(express.json(), authRouter);
  await new Promise<void>((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  jest.spyOn(console, 'info').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
  login.mockReset();
});

afterAll(async () => {
  appConfig.jwtAccessSecret = previousSecrets.access;
  appConfig.jwtRefreshSecret = previousSecrets.refresh;
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});

describe('authentication availability', () => {
  it.each(['missing-user', 'wrong-password'])('returns 401 for %s from the real credential check', async kind => {
    login.mockImplementationOnce(jest.requireActual<typeof import('../../services/authService')>('../../services/authService').authenticateUser);
    jest.spyOn(UserModel, 'find').mockResolvedValue(kind === 'missing-user' ? [] : [
      { ...user, passwordHash: bcrypt.hashSync('correct-password', 4) },
    ] as any);
    const response = await post('login', { email: user.email, password: 'wrong-password' });
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ data: null, error: 'Invalid credentials' });
  });

  it('keeps invalid credentials as 401', async () => {
    login.mockRejectedValue(new AuthenticationError('Invalid credentials'));
    const response = await post('login', { email: user.email, password: 'wrong' });
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ data: null, error: 'Invalid credentials' });
  });

  it('returns 503 for a login database failure without exposing internal details', async () => {
    login.mockRejectedValue(unavailable);
    const response = await post('login', { email: user.email, password: 'correct' });
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ data: null, error: 'Authentication temporarily unavailable' });
  });

  it('does not label an organization lookup failure as invalid credentials', async () => {
    login.mockResolvedValue({ user: { ...user, organizationId: user.id }, tokens: {} } as any);
    jest.spyOn(OrganizationModel, 'findById').mockReturnValue({
      select: () => ({ lean: () => Promise.reject(unavailable) }),
    } as any);
    expect((await post('login', { email: user.email, password: 'correct' })).status).toBe(503);
  });

  it.each(['malformed', 'expired', 'wrong-signature'])('rejects a %s refresh token with 401', async kind => {
    const refreshToken = kind === 'malformed' ? 'invalid'
      : token(kind === 'wrong-signature' ? 'wrong-secret' : appConfig.jwtRefreshSecret, kind === 'expired' ? -60 : 60);
    expect((await post('refresh', { refreshToken })).status).toBe(401);
  });

  it('allows the same refresh token to recover after a temporary database failure', async () => {
    const findUser = jest.spyOn(UserModel, 'findById');
    findUser.mockRejectedValueOnce(unavailable);
    findUser.mockResolvedValueOnce(user as any);
    const refreshToken = token(appConfig.jwtRefreshSecret);
    expect((await post('refresh', { refreshToken })).status).toBe(503);
    const recovered = await post('refresh', { refreshToken });
    expect(recovered.status).toBe(200);
    expect((await recovered.json()).data).toEqual({ accessToken: expect.any(String), refreshToken: expect.any(String) });
  });

  it('rejects a refresh token for a deleted user', async () => {
    jest.spyOn(UserModel, 'findById').mockResolvedValue(null);
    expect((await post('refresh', { refreshToken: token(appConfig.jwtRefreshSecret) })).status).toBe(401);
  });

  it('returns 503 for a database outage on an authenticated request', async () => {
    jest.spyOn(UserModel, 'findById').mockReturnValue({ select: () => Promise.reject(unavailable) } as any);
    const response = await fetch(`${baseUrl}/me`, {
      headers: { 'X-Yago-App-Token': token(appConfig.jwtAccessSecret) },
    });
    expect(response.status).toBe(503);
  });

  it('still rejects an expired access token', async () => {
    const response = await fetch(`${baseUrl}/me`, {
      headers: { 'X-Yago-App-Token': token(appConfig.jwtAccessSecret, -60) },
    });
    expect(response.status).toBe(401);
  });
});
