import { describe, expect, it } from '@jest/globals';
import { mockFn } from '../../helpers/mock.js';
import { SyncController } from '../../../../src/modules/sync/sync.controller.js';

describe('SyncController', () => {
  it('delegates batch sync with the authenticated user', async () => {
    const response = { success: true, results: [] };
    const service = { processBatch: mockFn().mockResolvedValue(response) };
    const controller = new SyncController(service as any);
    const body = { operations: [] };
    await expect(
      controller.batchSync(body as any, { userId: 'u-3' } as any),
    ).resolves.toBe(response);
    expect(service.processBatch).toHaveBeenCalledWith(body, { userId: 'u-3' });
  });
});
