import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { mockFn } from '../../helpers/mock.js';
import { TrainingRunsService } from '../../../../src/modules/training-runs/training-runs.service.js';
import { NotFoundException } from '@nestjs/common';
function query<T>(value: T) {
  const q = {
    populate: mockFn(() => q),
    sort: mockFn(() => q),
    skip: mockFn(() => q),
    limit: mockFn(() => q),
    exec: mockFn().mockResolvedValue(value),
  };
  return q;
}
const user = { userId: 'u-1', role: 'user' as const, account: {} as never };

describe('TrainingRunsService', () => {
  let service: TrainingRunsService;
  let runs: any;
  let experiments: any;
  beforeEach(() => {
    runs = mockFn();
    experiments = { findOne: mockFn().mockResolvedValue({ _id: 'exp-db' }) };
    service = new TrainingRunsService(runs, experiments);
  });
  it('creates a training run with server ownership and default algorithm version', async () => {
    const saved = { _id: 'run-db' };
    const save = mockFn().mockResolvedValue(saved);
    runs.mockImplementation((data: Record<string, unknown>) => ({
      ...data,
      save,
    }));
    await expect(
      service.create(
        {
          experimentId: 'exp-1',
          algorithmType: 'linear',
          configSnapshot: {},
        } as any,
        user,
      ),
    ).resolves.toBe(saved);
    expect(runs).toHaveBeenCalledWith(
      expect.objectContaining({
        experimentId: 'exp-db',
        algorithmVersion: '1.0.0',
        ownerId: 'u-1',
        syncVersion: 1,
      }),
    );
    expect(save).toHaveBeenCalledTimes(1);
  });
  it('rejects a run when the referenced experiment is missing', async () => {
    experiments.findOne.mockResolvedValue(null);
    await expect(
      service.create({ experimentId: 'missing' } as any, user),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(runs).not.toHaveBeenCalled();
  });
  it('filters a paginated list by a caller-owned experiment', async () => {
    const list = query([{ clientId: 'r1' }]);
    runs.find = mockFn().mockReturnValue(list);
    runs.countDocuments = jest
      .fn()
      .mockReturnValue({ exec: mockFn().mockResolvedValue(1) });
    await expect(service.findAll('exp-1', user, 2, 5)).resolves.toMatchObject({
      total: 1,
      page: 2,
      limit: 5,
    });
    expect(experiments.findOne).toHaveBeenCalledWith({
      clientId: 'exp-1',
      ownerId: 'u-1',
      deletedAt: { $exists: false },
    });
    expect(list.skip).toHaveBeenCalledWith(5);
  });
  it('does not query runs when the requested experiment is not visible', async () => {
    experiments.findOne.mockResolvedValue(null);
    await expect(service.findAll('other', user)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(runs.find).toBeUndefined();
  });
});
