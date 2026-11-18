import { describe, expect, it } from '@jest/globals';
import { AuditService } from '../../../../src/modules/login/audit.service.js';
import { mockFn } from '../../helpers/mock.js';

describe('AuditService', () => {
  it('writes only the fixed audit fields and a server timestamp', async () => {
    const logs = { create: mockFn().mockResolvedValue(undefined) };
    const service = new AuditService(logs as any);
    const before = Date.now();

    await service.record('login.success', 'user-1', 'target-1', '127.0.0.1');

    const [entry] = logs.create.mock.calls[0];
    expect(entry).toMatchObject({
      action: 'login.success',
      userId: 'user-1',
      targetId: 'target-1',
      ip: '127.0.0.1',
    });
    expect(entry.at).toBeInstanceOf(Date);
    expect(entry.at.getTime()).toBeGreaterThanOrEqual(before);
    expect(Object.keys(entry).sort()).toEqual(
      ['action', 'at', 'ip', 'targetId', 'userId'].sort(),
    );
  });
});
