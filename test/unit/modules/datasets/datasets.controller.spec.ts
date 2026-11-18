import { describe, expect, it } from '@jest/globals';
import { mockFn } from '../../helpers/mock.js';
import { DatasetsController } from '../../../../src/modules/datasets/datasets.controller.js';

describe('DatasetsController', () => {
  it('uses shared pagination and forwards the current user', async () => {
    const service = {
      findAll: mockFn().mockResolvedValue({ items: [], total: 0 }),
    };
    const controller = new DatasetsController(service as any);
    const user = { userId: 'u-2' };
    await controller.findAll(user as any, undefined, '5');
    expect(service.findAll).toHaveBeenCalledWith(user, 1, 5);
  });
  it('forwards the validated DTO and current user to create', async () => {
    const service = {
      create: mockFn().mockResolvedValue({ clientId: 'd-1' }),
    };
    const controller = new DatasetsController(service as any);
    const dto = { name: 'sample', sourceType: 'sample' };
    const user = { userId: 'u-1' };
    const result = await controller.create(dto as any, user as any);
    expect(result).toEqual({ clientId: 'd-1' });
    expect(service.create).toHaveBeenCalledWith(dto, user);
  });
});
