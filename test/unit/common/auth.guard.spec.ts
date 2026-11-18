import { describe, expect, it } from '@jest/globals';
import { UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '../../../src/common/guards/auth.guard.js';
import { mockFn } from '../helpers/mock.js';

const userId = '507f1f77bcf86cd799439011';

function fixture() {
  const handler = () => undefined;
  class Controller {}
  const reflector = { getAllAndOverride: mockFn() };
  const config = { get: mockFn() };
  const users = { findById: mockFn() };
  const request: any = {
    session: {
      userId,
      sessionVersion: 2,
      destroy: mockFn((callback: (error?: unknown) => void) => callback()),
    },
  };
  const response = { clearCookie: mockFn() };
  const context: any = {
    getHandler: () => handler,
    getClass: () => Controller,
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  };
  return {
    guard: new AuthGuard(reflector as any, config as any, users as any),
    handler,
    Controller,
    reflector,
    users,
    request,
    response,
    context,
  };
}

describe('AuthGuard', () => {
  it('allows public handlers without reading a session or user model', async () => {
    const f = fixture();
    f.reflector.getAllAndOverride.mockReturnValue(true);
    await expect(f.guard.canActivate(f.context)).resolves.toBe(true);
    expect(f.reflector.getAllAndOverride).toHaveBeenCalledWith('public', [
      f.handler,
      f.Controller,
    ]);
    expect(f.users.findById).not.toHaveBeenCalled();
  });

  it('attaches an active user when the stored session version matches', async () => {
    const f = fixture();
    const account = {
      _id: { toString: () => userId },
      role: 'user',
      status: 'active',
      sessionVersion: 2,
    };
    f.reflector.getAllAndOverride.mockReturnValue(false);
    f.users.findById.mockResolvedValue(account);
    await expect(f.guard.canActivate(f.context)).resolves.toBe(true);
    expect(f.users.findById).toHaveBeenCalledWith(userId);
    expect(f.request.user).toEqual({ userId, role: 'user', account });
    expect(f.request.session.destroy).not.toHaveBeenCalled();
  });

  it('destroys the session and rejects a disabled or stale account', async () => {
    const f = fixture();
    f.reflector.getAllAndOverride.mockReturnValue(false);
    f.users.findById.mockResolvedValue({
      _id: { toString: () => userId },
      status: 'disabled',
      sessionVersion: 2,
    });
    await expect(f.guard.canActivate(f.context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(f.request.session.destroy).toHaveBeenCalledTimes(1);
    expect(f.response.clearCookie).toHaveBeenCalled();
  });
});
