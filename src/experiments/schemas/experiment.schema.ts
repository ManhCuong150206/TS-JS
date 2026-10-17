import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';

export type ExperimentDocument = HydratedDocument<Experiment>;
export type AlgorithmType = 'linear' | 'polynomial' | 'ridge' | 'lasso' | 'neural-network';
export type ExperimentStatus = 'draft' | 'ready' | 'running' | 'completed' | 'error';

@Schema({ _id: false })
export class AlgorithmInfo {
  @Prop({ required: true, enum: ['linear', 'polynomial', 'ridge', 'lasso', 'neural-network'] })
  type: AlgorithmType;

  @Prop({ default: '1.0.0' })
  version: string;

  @Prop({ type: MongooseSchema.Types.Mixed, required: true })
  config: Record<string, unknown>;
}

export const AlgorithmInfoSchema = SchemaFactory.createForClass(AlgorithmInfo);

@Schema({ _id: false })
export class PreprocessingConfig {
  @Prop({ enum: ['reject', 'drop-rows', 'mean-imputation'], default: 'reject' })
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

@Schema({ timestamps: true, collection: 'experiments' })
export class Experiment {
  @Prop({ required: true, trim: true, unique: true, index: true })
  clientId: string;

  @Prop({ required: true, trim: true, maxlength: 120 })
  name: string;

  @Prop({ trim: true, maxlength: 1000, default: '' })
  description?: string;

  @Prop({ enum: ['draft', 'ready', 'running', 'completed', 'error'], default: 'draft', index: true })
  status: ExperimentStatus;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Dataset', required: true, index: true })
  datasetId: MongooseSchema.Types.ObjectId;

  @Prop({ type: AlgorithmInfoSchema, required: true })
  algorithm: AlgorithmInfo;

  @Prop({ required: true, trim: true })
  targetColumn: string;

  @Prop({ type: [String], required: true })
  featureColumns: string[];

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
