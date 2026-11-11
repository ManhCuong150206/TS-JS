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
  vi.fn((_filter: unknown, update: { $set: Record<string, unknown> }, _options?: unknown) => ({
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
  it.each(['linear', 'curved', 'correlated', 'sparse'])('keeps %s configuration through bulk mapping and Mongoose schema', async (kind) => {
    const syntheticConfig = { ...synthetic, kind };
    const write = echoWrite();
    const service = makeService(write);

    await service.bulkUpsert(
      [
        {
          id: 'one',
          name: 'curve',
          algorithm: 'polynomial',
          degree: 2,
          synthetic: syntheticConfig,
        },
      ],
      user,
    );
    expect(write.mock.calls[0][1].$set.synthetic).toEqual(syntheticConfig);

    const Document = model('SyntheticPersistenceCheck' + kind, ExperimentSchema);
    const doc = new Document({
      clientId: 'one',
      ownerId: user.userId,
      name: 'curve',
      algorithm: { type: 'polynomial', config: { degree: 2 } },
      synthetic: syntheticConfig,
    });
    await expect(doc.validate()).resolves.toBeUndefined();
    expect(doc.toObject().synthetic).toEqual(syntheticConfig);
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

describe('compact bulk records', () => {
 it('stores synthetic settings and algorithm parameters once without default insertion', async () => {
  const write=echoWrite(); const service=makeService(write);
  await service.bulkUpsert([{id:'compact',name:'Tên test',createdAt:1234,algorithm:'polynomial',degree:2,
   dataSource:'synthetic',synthetic,csvName:null,noise:8,seed:42,trainRatio:.8,sampleCount:100,featureCount:2,w:[1,2],b:0}],user);
  const fields=write.mock.calls[0][1].$set;
  expect(fields).toMatchObject({name:'Tên test',clientCreatedAt:1234,status:'completed',synthetic,algorithm:{type:'polynomial',config:{degree:2}}});
  for(const key of ['csvName','csvData','noise','seed','trainRatio','sampleCount','featureCount','degree','lambda','createdAt','description','preprocessing','split'])expect(fields).not.toHaveProperty(key);
  expect((write.mock.calls[0] as unknown[])[2]).toMatchObject({setDefaultsOnInsert:false});
 });
 it('preserves CSV name and snapshot without synthetic fields', async () => {
  const write=echoWrite(); const service=makeService(write);
  const csvData={trainX:[[1]],trainY:[1],testX:[[2]],testY:[2],trainIndices:[0]};
  await service.bulkUpsert([{id:'csv',name:'Test CSV',algorithm:'ridge',lambda:.1,dataSource:'csv',csvName:'test.csv',csvData,
   synthetic,noise:8,sampleCount:2,featureCount:1,w:[1],b:0}],user);
  const fields=write.mock.calls[0][1].$set;
  expect(fields).toMatchObject({csvName:'test.csv',csvData,algorithm:{type:'ridge',config:{lambda:.1}}});
  for(const key of ['synthetic','noise','degree','lambda'])expect(fields).not.toHaveProperty(key);
 });
});
