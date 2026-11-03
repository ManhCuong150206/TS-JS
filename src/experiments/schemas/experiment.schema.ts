import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';

export type ExperimentDocument = HydratedDocument<Experiment>;
export type AlgorithmType = 'linear' | 'polynomial' | 'ridge' | 'lasso' | 'neural-network';
export type ExperimentStatus = 'draft' | 'ready' | 'running' | 'completed' | 'error';

@Schema({ _id: false })
export class AlgorithmInfo {
  @Prop({ type: String, required: true, enum: ['linear', 'polynomial', 'ridge', 'lasso', 'neural-network'] })
  type: AlgorithmType;

  @Prop({ default: '1.0.0' })
  version: string;

  @Prop({ type: MongooseSchema.Types.Mixed, required: true })
  config: Record<string, unknown>;
}

export const AlgorithmInfoSchema = SchemaFactory.createForClass(AlgorithmInfo);

@Schema({ _id: false })
export class PreprocessingConfig {
  @Prop({ type: String, enum: ['reject', 'drop-rows', 'mean-imputation'], default: 'reject' })
  missingValues: string;

  @Prop({ default: false })
  standardizeFeatures: boolean;
}

export const PreprocessingConfigSchema = SchemaFactory.createForClass(PreprocessingConfig);

@Schema({ _id: false })
export class SplitConfig {
  @Prop({ min: 0.05, max: 0.5, default: 0.2 })
  testRatio: number;

  @Prop({ default: 42 })
  seed: number;
}

export const SplitConfigSchema = SchemaFactory.createForClass(SplitConfig);

@Schema({ _id: false })
export class SyntheticConfig {
  @Prop({ required: true, enum: ['linear', 'curved', 'correlated', 'sparse'] }) kind: string;
  @Prop({ required: true, enum: [1] }) version: number;
  @Prop({ required: true, min: 2 }) sampleCount: number;
  @Prop({ required: true, min: 1 }) featureCount: number;
  @Prop({ required: true, min: 0, max: 50 }) noise: number;
  @Prop({ required: true }) seed: number;
  @Prop({ required: true, min: 0.01, max: 0.99 }) trainRatio: number;
}
export const SyntheticConfigSchema = SchemaFactory.createForClass(SyntheticConfig);

@Schema({ timestamps: true, collection: 'experiments' })
export class Experiment {
  @Prop({ type: SyntheticConfigSchema, required: false })
  synthetic?: SyntheticConfig;

  @Prop({ required: true, trim: true, unique: true, index: true })
  clientId: string;

  @Prop({ required: true, trim: true, maxlength: 120 })
  name: string;

  @Prop({ trim: true, maxlength: 1000, default: '' })
  description?: string;

  @Prop({ type: String, enum: ['draft', 'ready', 'running', 'completed', 'error'], default: 'draft', index: true })
  status: ExperimentStatus;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Dataset', required: false, index: true })
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

  @Prop({ type: String, trim: true, index: true })
  ownerId?: string;

  @Prop({ type: Number, default: 1 })
  syncVersion: number;

  @Prop({ type: Date })
  deletedAt?: Date;
}

export const ExperimentSchema = SchemaFactory.createForClass(Experiment);
ExperimentSchema.index({ ownerId: 1, updatedAt: -1 });
