import { describe, it, expect, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { Model, model } from 'mongoose';
import { ExperimentsService } from './experiments.service.js';
import {
  ExperimentDocument,
  ExperimentSchema,
} from './schemas/experiment.schema.js';
import { DatasetDocument } from '../datasets/schemas/dataset.schema.js';
import type { RequestUser } from '../common/auth.guard.js';

const user = { userId: 'owner' } as RequestUser;
const synthetic = {
  kind: 'curved',
  version: 1,
  sampleCount: 100,
  featureCount: 2,
  noise: 8,
  seed: 42,
  trainRatio: 0.8,
};

// Ghi lại $set và trả về bản ghi giả với syncVersion = 1.
const echoWrite = () =>
  vi.fn((_filter: unknown, update: { $set: Record<string, unknown> }) => ({
    exec: async () => ({ ...update.$set, syncVersion: 1 }),
  }));

function makeService(write: unknown) {
  return new ExperimentsService(
    {
      findOne: () => ({ exec: async () => null }),
      findOneAndUpdate: write,
    } as unknown as Model<ExperimentDocument>,
    {} as unknown as Model<DatasetDocument>,
  );
}

describe('synthetic configuration persistence', () => {
  it('keeps the configuration through the bulk endpoint mapping and Mongoose schema', async () => {
    const write = echoWrite();
    const service = makeService(write);

    await service.bulkUpsert(
      [{ id: 'one', name: 'curve', algorithm: 'polynomial', degree: 2, synthetic }],
      user,
    );
    expect(write.mock.calls[0][1].$set.synthetic).toEqual(synthetic);

    const Document = model('SyntheticPersistenceCheck', ExperimentSchema);
    const doc = new Document({
      clientId: 'one',
      name: 'curve',
      algorithm: { type: 'polynomial', config: { degree: 2 } },
      synthetic,
    });
    await expect(doc.validate()).resolves.toBeUndefined();
    expect(doc.toObject().synthetic).toEqual(synthetic);
  });

  it('rejects bad kind, unsupported version and invalid numeric generation settings before writing', async () => {
    const write = vi.fn();
    const service = makeService(write);

    const badChanges = [
      { kind: 'bad' },
      { version: 2 },
      { seed: NaN },
      { featureCount: 0 },
      { sampleCount: 2, trainRatio: 0.01 },
      { noise: -1 },
    ];

    for (const change of badChanges) {
      await expect(
        service.bulkUpsert(
          [
            {
              id: 'one',
              name: 'curve',
              algorithm: 'polynomial',
              degree: 2,
              synthetic: { ...synthetic, ...change },
            },
          ],
          user,
        ),
      ).rejects.toThrow(BadRequestException);
    }
    expect(write).not.toHaveBeenCalled();
  });

  it('continues accepting legacy payloads with no synthetic configuration', async () => {
    const write = echoWrite();
    const service = makeService(write);

    await expect(
      service.bulkUpsert(
        [{ id: 'old', name: 'Legacy', algorithm: 'linear' }],
        user,
      ),
    ).resolves.toMatchObject({
      success: true,
      count: 1,
      items: [{ id: 'old', syncVersion: 1 }],
    });
  });
});