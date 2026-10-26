import mongoose from 'mongoose';

const { Schema, model } = mongoose;

export type DatasetSourceType = 'upload' | 'sample' | 'generated';
export type DatasetStatus = 'processing' | 'ready' | 'failed';
export type DatasetColumnType = 'number' | 'string' | 'date' | 'boolean' | 'unknown';
export type DatasetStorageProvider = 'local-volume' | 'gridfs' | 'object-storage';
export type DatasetFormat = 'csv' | 'json';

export interface DatasetRecord {
  clientId: string;
  name: string;
  sourceType: DatasetSourceType;
  originalFileName?: string;
  contentType?: string;
  sizeBytes?: number;
  rowCount?: number;
  columns?: Array<{ name: string; inferredType?: DatasetColumnType; missingCount?: number }>;
  previewRows?: Array<Record<string, unknown>>;
  storage?: { provider: DatasetStorageProvider; key: string; format: DatasetFormat; sha256: string };
  generationConfig?: Record<string, unknown>;
  status?: DatasetStatus;
  ownerId?: mongoose.Types.ObjectId;
  deletedAt?: Date;
}

const columnSchema = new Schema({
  name: { type: String, required: true, trim: true },
  inferredType: { type: String, enum: ['number', 'string', 'date', 'boolean', 'unknown'], default: 'unknown' },
  missingCount: { type: Number, min: 0, default: 0 }
}, { _id: false });

const storageSchema = new Schema({
  provider: { type: String, enum: ['local-volume', 'gridfs', 'object-storage'], required: true },
  key: { type: String, required: true, trim: true },
  format: { type: String, enum: ['csv', 'json'], required: true },
  sha256: { type: String, required: true, match: /^[a-f0-9]{64}$/i }
}, { _id: false });

const datasetSchema = new Schema<DatasetRecord>({
  clientId: { type: String, required: true, trim: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  sourceType: { type: String, required: true, enum: ['upload', 'sample', 'generated'] },
  originalFileName: { type: String, trim: true, maxlength: 255 },
  contentType: { type: String, trim: true },
  sizeBytes: { type: Number, min: 0 },
  rowCount: { type: Number, min: 0 },
  columns: { type: [columnSchema], default: [] },
  previewRows: {
    type: [Schema.Types.Mixed],
    default: [],
    validate: {
      validator: (rows: unknown[]) => rows.length <= 20,
      message: 'Store at most 20 preview rows in MongoDB.'
    }
  },
  storage: { type: storageSchema },
  generationConfig: { type: Schema.Types.Mixed },
  status: { type: String, enum: ['processing', 'ready', 'failed'], default: 'processing' },
  ownerId: { type: Schema.Types.ObjectId, ref: 'User' },
  deletedAt: { type: Date }
}, { timestamps: true, collection: 'datasets', strict: 'throw' });

datasetSchema.index({ clientId: 1 }, { unique: true });
datasetSchema.index({ ownerId: 1, updatedAt: -1 });
datasetSchema.index({ status: 1, createdAt: -1 });

export const Dataset = model<DatasetRecord>('Dataset', datasetSchema);
