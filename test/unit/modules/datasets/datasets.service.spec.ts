import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { mockFn } from '../../helpers/mock.js';
import { DatasetsService } from '../../../../src/modules/datasets/datasets.service.js';
import { NotFoundException } from '@nestjs/common';

function query<T>(value: T) {
  const q = {
    sort: mockFn(() => q),
    skip: mockFn(() => q),
    limit: mockFn(() => q),
    exec: mockFn().mockResolvedValue(value),
  };
  return q;
}
const user = { userId: 'u-1', role: 'user' as const, account: {} as never };

describe('DatasetsService', () => {
  let service: DatasetsService;
  let model: any;
  beforeEach(() => {
    service = Object.create(DatasetsService.prototype);
    model = mockFn();
    (service as any).datasetModel = model;
  });

  it('creates metadata with server-owned identity and ownership fields', async () => {
    const saved = { _id: 'db-id', name: 'sample' };
    const save = mockFn().mockResolvedValue(saved);
    model.mockImplementation((data: Record<string, unknown>) => ({
      ...data,
      save,
    }));
    const result = await service.create(
      { name: 'sample', sourceType: 'sample', ownerId: 'forged' } as any,
      user,
    );
    expect(result).toBe(saved);
    expect(model).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'sample',
        ownerId: 'u-1',
        status: 'ready',
        syncVersion: 1,
      }),
    );
    expect(model.mock.calls[0][0]).not.toHaveProperty('ownerId', 'forged');
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('returns owner-scoped, newest-first paginated rows and count', async () => {
    const rows = [{ clientId: 'c-1' }];
    const findQuery = query(rows);
    const countQuery = { exec: mockFn().mockResolvedValue(3) };
    model.find = mockFn().mockReturnValue(findQuery);
    model.countDocuments = mockFn().mockReturnValue(countQuery);
    await expect(service.findAll(user, 2, 2)).resolves.toEqual({
      items: rows,
      total: 3,
      page: 2,
      limit: 2,
      totalPages: 2,
    });
    expect(model.find).toHaveBeenCalledWith({
      deletedAt: { $exists: false },
      ownerId: 'u-1',
    });
    expect(findQuery.sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(findQuery.skip).toHaveBeenCalledWith(2);
    expect(findQuery.limit).toHaveBeenCalledWith(2);
  });

  it('finds records by client id within the current owner scope', async () => {
    const row = { clientId: 'c-1' };
    const findQuery = query(row);
    model.findOne = mockFn().mockReturnValue(findQuery);
    await expect(service.findOne('c-1', user)).resolves.toBe(row);
    expect(model.findOne).toHaveBeenCalledWith({
      clientId: 'c-1',
      ownerId: 'u-1',
      deletedAt: { $exists: false },
    });
  });

  it('raises not found when a dataset is not visible to the caller', async () => {
    model.findOne = mockFn().mockReturnValue(query(null));
    await expect(service.findOne('missing', user)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('soft deletes a visible dataset without deleting its document', async () => {
    const record: any = { save: mockFn().mockResolvedValue(undefined) };
    jest.spyOn(service, 'findOne').mockResolvedValue(record);
    await expect(service.remove('c-1', user)).resolves.toEqual({
      success: true,
      message: 'Đã xóa dataset thành công.',
    });
    expect(record.deletedAt).toBeInstanceOf(Date);
    expect(record.save).toHaveBeenCalledTimes(1);
  });
});
