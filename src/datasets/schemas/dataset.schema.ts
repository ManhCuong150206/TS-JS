import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';

export type DatasetDocument = HydratedDocument<Dataset>;

export type DatasetSourceType = 'upload' | 'sample' | 'generated';
export type DatasetStatus = 'processing' | 'ready' | 'failed';
export type DatasetColumnType = 'number' | 'string' | 'date' | 'boolean' | 'unknown';
export type DatasetStorageProvider = 'local-volume' | 'gridfs' | 'object-storage';
export type DatasetFormat = 'csv' | 'json';

@Schema({ _id: false })
export class DatasetColumn {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ type: String, enum: ['number', 'string', 'date', 'boolean', 'unknown'], default: 'unknown' })
  inferredType: DatasetColumnType;

  @Prop({ default: 0, min: 0 })
  missingCount: number;

  @Prop({ type: Number })
  min?: number;

  @Prop({ type: Number })
  max?: number;

  @Prop({ type: Number })
  mean?: number;

  @Prop({ default: 0, min: 0 })
  count: number;
}

export const DatasetColumnSchema = SchemaFactory.createForClass(DatasetColumn);

@Schema({ _id: false })
export class DatasetStorage {
  @Prop({ type: String, required: true, enum: ['local-volume', 'gridfs', 'object-storage'] })
  provider: DatasetStorageProvider;

  @Prop({ required: true, trim: true })
  key: string;

  @Prop({ type: String, required: true, enum: ['csv', 'json'] })
  format: DatasetFormat;

  @Prop({ required: true })
  sha256: string;

  @Prop({ trim: true })
  filePath?: string;
}

export const DatasetStorageSchema = SchemaFactory.createForClass(DatasetStorage);

@Schema({ timestamps: true, collection: 'datasets' })
export class Dataset {
  @Prop({ required: true, trim: true, unique: true, index: true })
  clientId: string;

  @Prop({ required: true, trim: true, maxlength: 120 })
  name: string;

  @Prop({ type: String, required: true, enum: ['upload', 'sample', 'generated'] })
  sourceType: DatasetSourceType;

  @Prop({ trim: true, maxlength: 255 })
  originalFileName?: string;

  @Prop({ trim: true })
  contentType?: string;

  @Prop({ min: 0 })
  sizeBytes?: number;

  @Prop({ min: 0 })
  rowCount?: number;

  @Prop({ type: [DatasetColumnSchema], default: [] })
  columns: DatasetColumn[];

  @Prop({ type: [MongooseSchema.Types.Mixed], default: [] })
  previewRows: Array<Record<string, unknown>>;

  @Prop({ type: DatasetStorageSchema })
  storage?: DatasetStorage;

  @Prop({ type: MongooseSchema.Types.Mixed })
  generationConfig?: Record<string, unknown>;

  @Prop({ type: String, enum: ['processing', 'ready', 'failed'], default: 'ready', index: true })
  status: DatasetStatus;

  @Prop({ type: String, trim: true, index: true })
  ownerId?: string;

  @Prop({ type: Number, default: 1 })
  syncVersion: number;

  @Prop({ type: Date })
  deletedAt?: Date;
}

export const DatasetSchema = SchemaFactory.createForClass(Dataset);
DatasetSchema.index({ ownerId: 1, updatedAt: -1 });
DatasetSchema.index({ status: 1, createdAt: -1 });
