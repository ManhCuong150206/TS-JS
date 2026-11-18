import { describe, expect, it } from '@jest/globals';
import { pagination } from '../../../src/shared/helpers/pagination.js';
import {
  idFilter,
  ownerFilter,
  dataFields,
  assertOwner,
} from '../../../src/shared/helpers/ownership.js';
import { validateSyntheticConfig } from '../../../src/shared/helpers/synthetic-config.validation.js';
import { BadRequestException, NotFoundException } from '@nestjs/common';

const user = { userId: 'u-1', role: 'user' as const, account: {} as never };

describe('shared helpers', () => {
  it('applies pagination defaults and accepts integer strings', () => {
    expect(pagination(undefined, undefined)).toEqual({ page: 1, limit: 20 });
    expect(pagination('3', '25')).toEqual({ page: 3, limit: 25 });
  });

  it.each(['0', '-1', '1.2', 'abc'])('rejects invalid page %s', (page) => {
    expect(() => pagination(page, '20')).toThrow(BadRequestException);
  });

  it('rejects limits above 100 and unsafe offsets', () => {
    expect(() => pagination('1', '101')).toThrow('limit tối đa là 100.');
    expect(() => pagination(Number.MAX_SAFE_INTEGER, 100)).toThrow(
      'page vượt giới hạn phân trang.',
    );
  });

  it('scopes regular users by owner while administrators see all owners', () => {
    expect(ownerFilter(user)).toEqual({ ownerId: 'u-1' });
    expect(ownerFilter({ ...user, role: 'admin' })).toEqual({});
  });

  it('uses Mongo id or client id for ObjectId-shaped ids and client id otherwise', () => {
    expect(idFilter('507f1f77bcf86cd799439011')).toEqual({
      $or: [
        { _id: '507f1f77bcf86cd799439011' },
        { clientId: '507f1f77bcf86cd799439011' },
      ],
    });
    expect(idFilter('client-x')).toEqual({ clientId: 'client-x' });
    expect(() => idFilter('')).toThrow(NotFoundException);
  });

  it('filters data fields and blocks ownership and Mongo metadata supplied by callers', () => {
    expect(
      dataFields(
        {
          name: 'ok',
          ownerId: 'attacker',
          syncVersion: 99,
          $set: {},
          storage: {},
        },
        'dataset',
      ),
    ).toEqual({ name: 'ok' });
  });

  it('hides records owned by another user', () => {
    expect(() => assertOwner({ ownerId: 'other' }, user)).toThrow(
      NotFoundException,
    );
    expect(() =>
      assertOwner({ ownerId: 'other' }, { ...user, role: 'admin' }),
    ).not.toThrow();
  });

  it('accepts a schema-shaped synthetic config and rejects an invalid range', () => {
    expect(() =>
      validateSyntheticConfig({
        kind: 'linear',
        version: 1,
        sampleCount: 100,
        featureCount: 2,
        noise: 0.1,
        seed: 42,
        trainRatio: 0.8,
      }),
    ).not.toThrow();
    expect(() =>
      validateSyntheticConfig({
        kind: 'invalid',
        version: 1,
        sampleCount: 100,
        featureCount: 2,
        noise: 0.1,
        seed: 42,
        trainRatio: 0.8,
      }),
    ).toThrow(BadRequestException);
    expect(() => validateSyntheticConfig(null)).not.toThrow();
  });
});
