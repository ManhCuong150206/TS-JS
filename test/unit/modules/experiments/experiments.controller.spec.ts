import { describe, expect, it } from '@jest/globals';
import { mockFn } from '../../helpers/mock.js';
import { ExperimentsController } from '../../../../src/modules/experiments/experiments.controller.js';

describe('ExperimentsController', () => {
  it('converts list query strings to pagination numbers before delegation', async () => {
    const service = {
      findAll: mockFn().mockResolvedValue({ items: [], total: 0 }),
    };
    const controller = new ExperimentsController(service as any);
    await controller.findAll({ userId: 'u-1' } as any, '2', '7');
    expect(service.findAll).toHaveBeenCalledWith({ userId: 'u-1' }, 2, 7);
  });
  it('delegates a bulk payload and preserves the service result', async () => {
    const result = {
      success: true,
      count: 1,
      items: [{ id: 'e-1', syncVersion: 2 }],
    };
    const service = { bulkUpsert: mockFn().mockResolvedValue(result) };
    const controller = new ExperimentsController(service as any);
    const body = [{ id: 'e-1' }];
    await expect(
      controller.bulkUpsert(body, { userId: 'u-1' } as any),
    ).resolves.toBe(result);
    expect(service.bulkUpsert).toHaveBeenCalledWith(body, { userId: 'u-1' });
  });
});
