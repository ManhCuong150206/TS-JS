import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { mockFn } from '../../helpers/mock.js';
import * as bcrypt from 'bcrypt';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../../../../src/modules/users/users.service.js';

const id = '507f1f77bcf86cd799439011';
const doc = (overrides: Record<string, unknown> = {}) => ({
  _id: { toString: () => id },
  email: 'student@example.com',
  displayName: 'Student',
  role: 'user',
  status: 'active',
  sessionVersion: 2,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  ...overrides,
});
const requestUser = (account = doc()) => ({
  userId: id,
  role: account.role as 'user' | 'admin',
  account: account as any,
});

describe('UsersService', () => {
  let users: any;
  let datasets: any;
  let experiments: any;
  let runs: any;
  let audit: any;
  let service: UsersService;
  beforeEach(() => {
    jest.clearAllMocks();
    users = {
      findOne: mockFn(),
      findOneAndUpdate: mockFn(),
      findById: mockFn(),
      updateOne: mockFn(),
      deleteOne: mockFn(),
      countDocuments: mockFn(),
    };
    datasets = { updateMany: mockFn().mockResolvedValue({}) };
    experiments = { updateMany: mockFn().mockResolvedValue({}) };
    runs = { updateMany: mockFn().mockResolvedValue({}) };
    audit = { record: mockFn().mockResolvedValue(undefined) };
    service = new UsersService(users, datasets, experiments, runs, audit);
  });

  it('updates profile only when the active session version still matches', async () => {
    const updated = doc({ displayName: 'New Name' });
    users.findOneAndUpdate.mockResolvedValue(updated);
    await expect(
      service.updateProfile(requestUser(), 'New Name'),
    ).resolves.toMatchObject({ displayName: 'New Name' });
    expect(users.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: id, status: 'active', sessionVersion: 2 },
      { $set: { displayName: 'New Name' } },
      { returnDocument: 'after', runValidators: true },
    );
  });

  it('rejects a profile update after the session version becomes stale', async () => {
    users.findOneAndUpdate.mockResolvedValue(null);
    await expect(
      service.updateProfile(requestUser(), 'New Name'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('changes password, advances session version, and records an audit event', async () => {
    const passwordHash = await bcrypt.hash('old-password', 4);
    const account = doc({ passwordHash });
    const updated = doc({ passwordHash: 'new-hash', sessionVersion: 3 });
    users.findOne.mockReturnValue({
      select: mockFn().mockResolvedValue(account),
    });
    users.findOneAndUpdate.mockResolvedValue(updated);
    const result = await service.changePassword(
      requestUser(account),
      { currentPassword: 'old-password', newPassword: 'new-password' } as any,
      '127.0.0.1',
    );
    expect(result).toBe(updated);
    expect(users.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: account._id, sessionVersion: 2, status: 'active' },
      {
        $set: { passwordHash: expect.any(String) },
        $inc: { sessionVersion: 1 },
      },
      { returnDocument: 'after' },
    );
    expect(audit.record).toHaveBeenCalledWith(
      'password.change',
      id,
      id,
      '127.0.0.1',
    );
  });

  it('does not update the password when current password verification fails', async () => {
    const passwordHash = await bcrypt.hash('old-password', 4);
    const account = doc({ passwordHash });
    users.findOne.mockReturnValue({
      select: mockFn().mockResolvedValue(account),
    });
    await expect(
      service.changePassword(
        requestUser(account),
        {
          currentPassword: 'wrong-password',
          newPassword: 'new-password',
        } as any,
        '127.0.0.1',
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(users.findOneAndUpdate).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('soft deletes owned data before deleting a non-admin account and records the event', async () => {
    const account = doc();
    users.findById.mockResolvedValue(account);
    await expect(
      service.deleteAccount(id, requestUser(account), '127.0.0.1'),
    ).resolves.toEqual({ success: true });
    const expectedFilter = { ownerId: id, deletedAt: { $exists: false } };
    expect(users.updateOne).toHaveBeenCalledWith(
      { _id: account._id },
      { $set: { status: 'disabled' }, $inc: { sessionVersion: 1 } },
    );
    expect(datasets.updateMany).toHaveBeenCalledWith(
      expectedFilter,
      expect.objectContaining({
        $set: { deletedAt: expect.any(Date) },
        $inc: { syncVersion: 1 },
      }),
    );
    expect(experiments.updateMany).toHaveBeenCalledWith(
      expectedFilter,
      expect.any(Object),
    );
    expect(runs.updateMany).toHaveBeenCalledWith(
      expectedFilter,
      expect.any(Object),
    );
    expect(users.deleteOne).toHaveBeenCalledWith({ _id: account._id });
    expect(audit.record).toHaveBeenCalledWith(
      'account.delete',
      id,
      id,
      '127.0.0.1',
    );
  });

  it('protects the last active admin from self deletion', async () => {
    const admin = doc({ role: 'admin' });
    users.findById.mockResolvedValue(admin);
    users.countDocuments.mockResolvedValue(1);
    await expect(
      service.deleteAccount(id, requestUser(admin), '127.0.0.1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(users.updateOne).not.toHaveBeenCalled();
    expect(datasets.updateMany).not.toHaveBeenCalled();
    expect(users.deleteOne).not.toHaveBeenCalled();
  });
});
