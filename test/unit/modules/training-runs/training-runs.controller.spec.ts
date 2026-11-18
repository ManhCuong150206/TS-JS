import { describe, expect, it } from '@jest/globals';
import { mockFn } from '../../helpers/mock.js';
import { TrainingRunsController } from '../../../../src/modules/training-runs/training-runs.controller.js';

describe('TrainingRunsController', () => {
  it('forwards experiment filter and normalized pagination to the service', async () => {
    const service = { findAll: mockFn().mockResolvedValue({ items: [] }) };
    const controller = new TrainingRunsController(service as any);
    const user = { userId: 'u-1' };
    await controller.findAll(user as any, 'exp-client', '3', '4');
    expect(service.findAll).toHaveBeenCalledWith('exp-client', user, 3, 4);
  });
});
