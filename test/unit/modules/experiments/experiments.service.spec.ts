import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { mockFn } from '../../helpers/mock.js';
import { ExperimentsService } from '../../../../src/modules/experiments/experiments.service.js';
import { BadRequestException, NotFoundException } from '@nestjs/common';

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
const dto: any = {
  name: 'exp',
  datasetId: 'dataset-client',
  algorithm: { type: 'linear', config: {} },
  targetColumn: 'y',
  featureColumns: ['x'],
};

describe('ExperimentsService', () => {
  let service: ExperimentsService;
  let experiments: any;
  let datasets: any;
  beforeEach(() => {
    experiments = mockFn();
    datasets = {
      findOne: mockFn().mockReturnValue(query({ _id: 'dataset-db-id' })),
    };
    service = new ExperimentsService(experiments, datasets);
  });

  it('creates an owned experiment linked to the resolved dataset', async () => {
    const saved = { _id: 'exp-db-id' };
    const save = mockFn().mockResolvedValue(saved);
    experiments.mockImplementation((data: Record<string, unknown>) => ({
      ...data,
      save,
    }));
    await expect(service.create(dto, user)).resolves.toBe(saved);
    expect(datasets.findOne).toHaveBeenCalledWith({
      clientId: 'dataset-client',
      ownerId: 'u-1',
      deletedAt: { $exists: false },
    });
    expect(experiments).toHaveBeenCalledWith(
      expect.objectContaining({
        datasetId: 'dataset-db-id',
        ownerId: 'u-1',
        syncVersion: 1,
      }),
    );
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('does not create an experiment when its dataset is missing', async () => {
    datasets.findOne.mockReturnValue(query(null));
    await expect(service.create(dto, user)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(experiments).not.toHaveBeenCalled();
  });

  it('rejects invalid polynomial configuration before persistence', async () => {
    await expect(
      service.create(
        { ...dto, algorithm: { type: 'polynomial', config: { degree: 11 } } },
        user,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(experiments).not.toHaveBeenCalled();
  });

  it('returns paginated experiments with owner-safe dataset population', async () => {
    const rows = [{ clientId: 'e-1' }];
    const list = query(rows);
    const count = { exec: mockFn().mockResolvedValue(1) };
    experiments.find = mockFn().mockReturnValue(list);
    experiments.countDocuments = mockFn().mockReturnValue(count);
    await expect(service.findAll(user, 1, 10)).resolves.toEqual({
      items: rows,
      total: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
    });
    expect(list.populate).toHaveBeenCalledWith({
      path: 'datasetId',
      match: { ownerId: 'u-1', deletedAt: { $exists: false } },
    });
    expect(list.sort).toHaveBeenCalledWith({ updatedAt: -1 });
  });

  it('updates allowed fields, ignores dataset reassignment, and advances sync version', async () => {
    const record: any = {
      datasetId: 'original',
      syncVersion: 4,
      save: mockFn().mockImplementation(function (
        this: Record<string, unknown>,
      ) {
        return Promise.resolve(this);
      }),
    };
    jest.spyOn(service, 'findOne').mockResolvedValue(record);
    const result = await service.update(
      'e-1',
      { name: 'renamed', datasetId: 'other' } as any,
      user,
    );
    expect(result.name).toBe('renamed');
    expect(result.datasetId).toBe('original');
    expect(result.syncVersion).toBe(5);
    expect(record.save).toHaveBeenCalledTimes(1);
  });

  it('rejects duplicate client identifiers in a bulk request', async () => {
    experiments.findOne = mockFn().mockReturnValue(query(null));
    await expect(
      service.bulkUpsert(
        [
          {
            id: 'e-1',
            name: 'First',
            algorithm: { type: 'linear', config: {} },
          },
          {
            id: 'e-1',
            name: 'Duplicate',
            algorithm: { type: 'linear', config: {} },
          },
        ],
        user,
      ),
    ).rejects.toThrow('Trùng id trong lô đồng bộ.');
    expect(experiments.findOneAndUpdate).toBeUndefined();
  });
});
