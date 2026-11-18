import { describe, expect, it } from '@jest/globals';
import { mockFn } from '../../helpers/mock.js';
import { UsersController } from '../../../../src/modules/users/users.controller.js';

describe('UsersController', () => {
  it('delegates profile updates to UsersService', async () => {
    const user = { userId: 'u-1', account: { sessionVersion: 3 } };
    const result = { _id: 'u-1', displayName: 'Updated' };
    const users = { updateProfile: mockFn().mockResolvedValue(result) };
    const controller = new UsersController(users as any, {} as any);
    await expect(
      controller.updateMe(user as any, { displayName: 'Updated' }),
    ).resolves.toBe(result);
    expect(users.updateProfile).toHaveBeenCalledWith(user, 'Updated');
  });
  it('returns the public view of the current account', () => {
    const account = {
      _id: { toString: () => 'u-1' },
      email: 'a@example.com',
      displayName: 'A',
      role: 'user',
      status: 'active',
      passwordHash: 'secret',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const controller = new UsersController({} as any, {} as any);
    const result = controller.me({ account } as any);
    expect(result).not.toHaveProperty('passwordHash');
    expect(result.email).toBe('a@example.com');
  });
});
