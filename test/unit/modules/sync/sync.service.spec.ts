import { beforeEach, describe, expect, it } from '@jest/globals';
import { mockFn } from '../../helpers/mock.js';
import { createHash } from 'node:crypto';
import { SyncService } from '../../../../src/modules/sync/sync.service.js';
import { BadRequestException } from '@nestjs/common';
const user = { userId: 'u-1', role: 'user' as const, account: {} as never };

describe('SyncService.processBatch', () => {
  let service: SyncService;
  let syncOps: any;
  let experiments: any;
  let datasets: any;
  let runs: any;
  beforeEach(() => {
    syncOps = { findOne: mockFn(), create: mockFn() };
    experiments = { findOne: mockFn() };
    datasets = { findOne: mockFn(), create: mockFn() };
    runs = { findOne: mockFn(), create: mockFn() };
    service = new SyncService(syncOps, experiments, datasets, runs);
  });
  it('rejects a batch without an operations array', async () => {
    await expect(service.processBatch({} as any, user)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
  it('returns an empty successful batch without model calls', async () => {
    const result = await service.processBatch({ operations: [] }, user);
    expect(result.success).toBe(true);
    expect(result.results).toEqual([]);
    expect(syncOps.create).not.toHaveBeenCalled();
  });
  it('returns duplicate idempotent operations without applying or recording them twice', async () => {
    const op: any = {
      operationId: 'op-1',
      idempotencyKey: 'key-1',
      entityType: 'dataset',
      entityClientId: 'd-1',
      action: 'create',
      payload: {},
      clientVersion: 0,
    };
    const storedKey = createHash('sha256')
      .update(JSON.stringify(['u-1', 'key-1']))
      .digest('hex');
    syncOps.findOne.mockReturnValue({
      exec: mockFn().mockResolvedValue({ serverVersion: 7 }),
    });
    const response = await service.processBatch({ operations: [op] }, user);
    expect(response).toMatchObject({
      success: true,
      results: [{ operationId: 'op-1', status: 'duplicate', serverVersion: 7 }],
    });
    expect(syncOps.findOne).toHaveBeenCalledWith({
      idempotencyKey: storedKey,
      ownerId: 'u-1',
    });
    expect(datasets.create).not.toHaveBeenCalled();
    expect(syncOps.create).not.toHaveBeenCalled();
  });
  it('applies a dataset create and stores an owner-scoped audit record', async () => {
    const op: any = {
      operationId: 'op-2',
      idempotencyKey: 'key-2',
      entityType: 'dataset',
      entityClientId: 'd-2',
      action: 'create',
      payload: { name: 'dataset' },
      clientVersion: 0,
    };
    syncOps.findOne.mockReturnValue({
      exec: mockFn().mockResolvedValue(null),
    });
    datasets.findOne.mockReturnValue({
      exec: mockFn().mockResolvedValue(null),
    });
    datasets.create.mockResolvedValue({ syncVersion: 1 });
    syncOps.create.mockResolvedValue(undefined);
    const response = await service.processBatch({ operations: [op] }, user);
    expect(response).toMatchObject({
      success: true,
      results: [{ status: 'applied', serverVersion: 1 }],
    });
    expect(datasets.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'dataset',
        clientId: 'd-2',
        ownerId: 'u-1',
        syncVersion: 1,
      }),
    );
    expect(syncOps.create).toHaveBeenCalledWith(
      expect.objectContaining({
        operationId: 'op-2',
        ownerId: 'u-1',
        status: 'applied',
      }),
    );
  });
});
