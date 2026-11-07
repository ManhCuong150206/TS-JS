import { describe, it, expect, vi } from 'vitest';
import { Model, model } from 'mongoose';
import { ExperimentsService } from './experiments.service.js';
import { Experiment, ExperimentSchema } from './schemas/experiment.schema.js';
import { Dataset } from '../datasets/schemas/dataset.schema.js';

const synthetic = { kind: 'curved', version: 1, sampleCount: 100, featureCount: 2, noise: 8, seed: 42, trainRatio: .8 };
describe('synthetic configuration persistence', () => {
  it('keeps the configuration through the bulk endpoint mapping and Mongoose schema', async () => {
    const write = vi.fn((_filter: unknown, update: { $set: Record<string, unknown> }) => ({ exec: async () => ({ ...update.$set, syncVersion: 1 }) }));
    const service = new ExperimentsService({ findOne: () => ({ exec: async () => null }), findOneAndUpdate: write } as unknown as Model<Experiment>, {} as Model<Dataset>);
    await service.bulkUpsert([{ id: 'one', name: 'curve', algorithm: 'polynomial', degree: 2, synthetic }], 'owner');
    expect(write.mock.calls[0][1].$set.synthetic).toEqual(synthetic);
    const Document = model('SyntheticPersistenceCheck', ExperimentSchema);
    const doc = new Document({ clientId: 'one', name: 'curve', algorithm: { type: 'polynomial', config: { degree: 2 } }, synthetic });
    await expect(doc.validate()).resolves.toBeUndefined(); expect(doc.toObject().synthetic).toEqual(synthetic);
  });
  it('rejects bad kind, unsupported version and invalid numeric generation settings before writing', async () => {
    const write = vi.fn(); const service = new ExperimentsService({ findOne: () => ({ exec: async () => null }), findOneAndUpdate: write } as unknown as Model<Experiment>, {} as Model<Dataset>);
    for (const change of [{ kind: 'bad' }, { version: 2 }, { seed: NaN }, { featureCount: 0 }, { sampleCount: 2, trainRatio: .01 }, { noise: -1 }]) {
      await expect(service.bulkUpsert([{ id: 'one', synthetic: { ...synthetic, ...change } }])).rejects.toThrow();
    }
    expect(write).not.toHaveBeenCalled();
  });
  it('continues accepting legacy payloads with no synthetic configuration', async () => {
    const write = vi.fn((_filter: unknown, update: { $set: Record<string, unknown> }) => ({ exec: async () => ({ ...update.$set, syncVersion: 1 }) }));
    const service = new ExperimentsService({ findOne: () => ({ exec: async () => null }), findOneAndUpdate: write } as unknown as Model<Experiment>, {} as Model<Dataset>);
    await expect(service.bulkUpsert([{ id: 'old', name: 'Legacy', algorithm: 'linear' }])).resolves.toMatchObject({ success: true, count: 1, items: [{ id: 'old', syncVersion: 1 }] });
  });
});
