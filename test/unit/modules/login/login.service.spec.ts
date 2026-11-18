import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { mockFn } from '../../helpers/mock.js';
import * as bcrypt from 'bcrypt';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { LoginService } from '../../../../src/modules/login/login.service.js';

const config = { get: mockFn() } as any;
const audit = { record: mockFn().mockResolvedValue(undefined) };
const makeUser = (overrides: Record<string, unknown> = {}) => ({
  _id: { toString: () => '507f1f77bcf86cd799439011' },
  email: 'student@example.com',
  displayName: 'Student',
  role: 'user',
  status: 'active',
  sessionVersion: 0,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  ...overrides,
});

describe('LoginService', () => {
  let users: any;
  let service: LoginService;
  beforeEach(() => {
    jest.clearAllMocks();
    users = { create: mockFn(), findOne: mockFn() };
    service = new LoginService(users, config, audit as any);
  });
  it('registers a user and records registration without exposing passwordHash', async () => {
    const user = makeUser();
    users.create.mockResolvedValue(user);
    const result = await service.register(
      {
        email: 'student@example.com',
        password: 'password123',
        displayName: 'Student',
      } as any,
      '127.0.0.1',
    );
    expect(users.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'student@example.com',
        displayName: 'Student',
        role: 'user',
        passwordHash: expect.any(String),
      }),
    );
    expect(result).toMatchObject({
      email: 'student@example.com',
      role: 'user',
    });
    expect(result).not.toHaveProperty('passwordHash');
    expect(audit.record).toHaveBeenCalledWith(
      'register',
      '507f1f77bcf86cd799439011',
      '507f1f77bcf86cd799439011',
      '127.0.0.1',
    );
  });
  it('maps Mongo duplicate key on registration to a conflict response', async () => {
    users.create.mockRejectedValue(
      Object.assign(new Error('duplicate'), { code: 11000 }),
    );
    await expect(
      service.register(
        {
          email: 'taken@example.com',
          password: 'password123',
          displayName: 'Taken',
        } as any,
        '127.0.0.1',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(audit.record).not.toHaveBeenCalled();
  });
  it('authenticates an active user with the matching password', async () => {
    const passwordHash = await bcrypt.hash('password123', 4);
    const user = makeUser({ passwordHash });
    const selected = { select: mockFn().mockResolvedValue(user) };
    users.findOne.mockReturnValue(selected);
    (service as any).dummyHash = await bcrypt.hash('dummy-password', 4);
    await expect(
      service.authenticate(
        { email: 'student@example.com', password: 'password123' } as any,
        '127.0.0.1',
      ),
    ).resolves.toBe(user);
    expect(users.findOne).toHaveBeenCalledWith({
      email: 'student@example.com',
    });
    expect(selected.select).toHaveBeenCalledWith('+passwordHash');
    expect(audit.record).not.toHaveBeenCalled();
  });
  it('rejects an inactive account and records a failed login', async () => {
    const passwordHash = await bcrypt.hash('password123', 4);
    const user = makeUser({ passwordHash, status: 'disabled' });
    users.findOne.mockReturnValue({
      select: mockFn().mockResolvedValue(user),
    });
    (service as any).dummyHash = await bcrypt.hash('dummy-password', 4);
    await expect(
      service.authenticate(
        { email: user.email, password: 'password123' } as any,
        '10.0.0.2',
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(audit.record).toHaveBeenCalledWith(
      'login.failure',
      '507f1f77bcf86cd799439011',
      null,
      '10.0.0.2',
    );
  });
});
