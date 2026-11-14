import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';

export type ExperimentDocument = HydratedDocument<Experiment>;
export type AlgorithmType =
  'linear' | 'polynomial' | 'ridge' | 'lasso' | 'neural-network';
export type ExperimentStatus =
  'draft' | 'ready' | 'running' | 'completed' | 'error';

@Schema({ _id: false, minimize: false })
export class AlgorithmInfo {
  @Prop({
    type: String,
    required: true,
    enum: ['linear', 'polynomial', 'ridge', 'lasso', 'neural-network'],
  })
  type: AlgorithmType;

  @Prop({ default: '1.0.0' })
  version: string;

  @Prop({
    type: MongooseSchema.Types.Mixed,
    required: true,
    default: () => ({}),
  })
  config: Record<string, unknown>;
}

export const AlgorithmInfoSchema = SchemaFactory.createForClass(AlgorithmInfo);

@Schema({ _id: false })
export class PreprocessingConfig {
  @Prop({
    type: String,
    enum: ['reject', 'drop-rows', 'mean-imputation'],
    default: 'reject',
  })
  missingValues: string;

  @Prop({ default: false })
  standardizeFeatures: boolean;
}

export const PreprocessingConfigSchema =
  SchemaFactory.createForClass(PreprocessingConfig);

@Schema({ _id: false })
export class SplitConfig {
  @Prop({ min: 0.05, max: 0.5, default: 0.2 })
  testRatio: number;

  @Prop({ default: 42 })
  seed: number;
}

export const SplitConfigSchema = SchemaFactory.createForClass(SplitConfig);

// Phải khai báo trước Experiment: decorator @Prop của Experiment
// cần SyntheticConfigSchema ngay khi class được định nghĩa.
// Danh sách kind phải khớp với SYNTHETIC_KINDS trong synthetic-config.validation.ts
@Schema({ _id: false })
export class SyntheticConfig {
  @Prop({ type: String, required: true, enum: ['linear', 'curved', 'correlated', 'sparse'] })
  kind: string;

  @Prop({ type: Number, default: 1, enum: [1] })
  version: number;

  @Prop({ type: Number, required: true }) sampleCount: number;
  @Prop({ type: Number, required: true }) featureCount: number;
  @Prop({ type: Number, required: true }) noise: number;
  @Prop({ type: Number, required: true }) seed: number;
  @Prop({ type: Number, required: true }) trainRatio: number;
}

export const SyntheticConfigSchema =
  SchemaFactory.createForClass(SyntheticConfig);

@Schema({ timestamps: true, collection: 'experiments', minimize: false })
export class Experiment {
  @Prop({ type: MongooseSchema.Types.Mixed }) learningReport?: Record<string, unknown>;
  @Prop({ type: Number }) clientCreatedAt?: number;
  @Prop({ type: Number }) learningRate?: number;
  @Prop({ type: Number }) maxIterations?: number;
  @Prop({ type: Number }) degree?: number;
  @Prop({ type: Number }) lambda?: number;
  @Prop({ enum: ['synthetic', 'csv'] }) dataSource?: string;
  @Prop({ type: String }) csvName?: string | null;
  @Prop({ type: Number }) sampleCount?: number;
  @Prop({ type: Number }) featureCount?: number;
  @Prop({ type: Number }) noise?: number;
  @Prop({ type: Number }) seed?: number;
  @Prop({ type: Number }) trainRatio?: number;
  @Prop({ type: Number }) iterations?: number;
  @Prop({ type: [Number], default: undefined }) w?: number[];
  @Prop({ type: Number }) b?: number;
  @Prop({
    type: {
      mse: Number,
      rmse: Number,
      mae: Number,
      r2: { type: Number, default: null },
    },
    _id: false,
  })
  train?: { mse: number; rmse: number; mae: number; r2: number | null };
  @Prop({
    type: {
      mse: Number,
      rmse: Number,
      mae: Number,
      r2: { type: Number, default: null },
    },
    _id: false,
  })
  test?: { mse: number; rmse: number; mae: number; r2: number | null };
  @Prop({ type: MongooseSchema.Types.Mixed }) csvData?: Record<string, unknown>;
  @Prop({ type: String }) lastMutationId?: string;

  @Prop({ type: SyntheticConfigSchema, required: false })
  synthetic?: SyntheticConfig;

  // Đã bỏ index: true vì unique: true đã tạo index.
  @Prop({ required: true, trim: true, unique: true })
  clientId: string;

  @Prop({ required: true, trim: true, maxlength: 120 })
  name: string;

  @Prop({ trim: true, maxlength: 1000, default: '' })
  description?: string;

  @Prop({
    type: String,
    enum: ['draft', 'ready', 'running', 'completed', 'error'],
    default: 'draft',
    index: true,
  })
  status: ExperimentStatus;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Dataset',
    required: false,
    index: true,
  })
  datasetId?: MongooseSchema.Types.ObjectId;

  @Prop({ type: AlgorithmInfoSchema, required: true })
  algorithm: AlgorithmInfo;

  @Prop({ required: false, trim: true, default: 'y' })
  targetColumn?: string;

  @Prop({ type: [String], default: [] })
  featureColumns?: string[];

  @Prop({ type: PreprocessingConfigSchema, default: () => ({}) })
  preprocessing: PreprocessingConfig;

  @Prop({ type: SplitConfigSchema, default: () => ({}) })
  split: SplitConfig;

  @Prop({ type: String, required: true, trim: true, index: true })
  ownerId: string;

  @Prop({ type: Number, default: 1 })
  syncVersion: number;

  @Prop({ type: Date })
  deletedAt?: Date;
}

export const ExperimentSchema = SchemaFactory.createForClass(Experiment);
ExperimentSchema.index({ ownerId: 1, updatedAt: -1 });
