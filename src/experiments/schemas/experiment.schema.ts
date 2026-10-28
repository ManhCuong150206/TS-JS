import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  AlgorithmType,
  ExperimentStatus,
  PreprocessingStepType,
  SplitMethod,
  SyncStatus,
} from '../experiment.enums.js';

@Schema({ _id: false })
export class AlgorithmConfigEmbedded {
  @Prop({ type: Boolean }) fitIntercept?: boolean;
  @Prop({ type: Number }) learningRate?: number;
  @Prop({ type: Number }) maxIterations?: number;
  @Prop({ type: Number }) tolerance?: number;
  @Prop({ type: Number }) degree?: number; // chỉ polynomial_regression
  @Prop({ type: Number }) lambda?: number; // chỉ ridge_regression, lasso_regression
}
const AlgorithmConfigSchema = SchemaFactory.createForClass(AlgorithmConfigEmbedded);

@Schema({ _id: false })
export class AlgorithmEmbedded {
  @Prop({ type: String, enum: Object.values(AlgorithmType), required: true })
  type: AlgorithmType;

  @Prop({ type: String, required: true }) version: string;

  @Prop({ type: AlgorithmConfigSchema, required: true })
  config: AlgorithmConfigEmbedded;
}
const AlgorithmSchema = SchemaFactory.createForClass(AlgorithmEmbedded);

@Schema({ _id: false })
export class DatasetRefEmbedded {
  @Prop({ type: String, required: true }) datasetId: string;
  @Prop({ type: String }) version?: string;
}
const DatasetRefSchema = SchemaFactory.createForClass(DatasetRefEmbedded);

@Schema({ _id: false })
export class PreprocessingStepEmbedded {
  @Prop({ type: String, enum: Object.values(PreprocessingStepType), required: true })
  type: PreprocessingStepType;

  /** Các cột áp dụng. Rỗng nghĩa là áp dụng cho tất cả cột */
  @Prop({ type: [String], default: [] }) columns: string[];
}
const PreprocessingStepSchema = SchemaFactory.createForClass(PreprocessingStepEmbedded);

@Schema({ _id: false })
export class PreprocessingEmbedded {
  @Prop({ type: [PreprocessingStepSchema], default: [] })
  steps: PreprocessingStepEmbedded[];
}
const PreprocessingSchema = SchemaFactory.createForClass(PreprocessingEmbedded);

@Schema({ _id: false })
export class SplitConfigEmbedded {
  @Prop({ type: String, enum: Object.values(SplitMethod), default: SplitMethod.RANDOM })
  method: SplitMethod;

  @Prop({ type: Number, required: true }) trainRatio: number;
  @Prop({ type: Number, required: true }) validationRatio: number;
  @Prop({ type: Number, required: true }) testRatio: number;
  @Prop({ type: Boolean, required: true }) shuffle: boolean;
}
const SplitConfigSchema = SchemaFactory.createForClass(SplitConfigEmbedded);

@Schema({ collection: 'experiments', timestamps: true, versionKey: false })
export class Experiment {
  /** ID tự tăng: 1, 2, 3, ... */
  @Prop({ type: Number })
  _id: number;

  @Prop({ type: String, required: true, unique: true })
  clientId: string;

  @Prop({ type: String, required: true, trim: true }) name: string;
  @Prop({ type: String, default: '' }) description: string;

  @Prop({ type: String, enum: Object.values(ExperimentStatus), default: ExperimentStatus.DRAFT })
  status: ExperimentStatus;

  @Prop({ type: String, enum: Object.values(SyncStatus), default: SyncStatus.SYNCED })
  syncStatus: SyncStatus;

  @Prop({ type: AlgorithmSchema, required: true })
  algorithm: AlgorithmEmbedded;

  /** Cho phép null (chưa gắn dataset) */
  @Prop({ type: DatasetRefSchema, default: null })
  datasetRef: DatasetRefEmbedded | null;

  @Prop({ type: PreprocessingSchema, required: true })
  preprocessing: PreprocessingEmbedded;

  @Prop({ type: SplitConfigSchema, required: true })
  splitConfig: SplitConfigEmbedded;

  @Prop({ type: Number, required: true }) seed: number;

  /** Khóa chống ghi đè: tăng 1 sau mỗi lần PATCH */
  @Prop({ type: Number, default: 1 }) syncVersion: number;

  // Mongoose tự sinh nhờ timestamps: true
  createdAt: Date;
  updatedAt: Date;
}

export const ExperimentSchema = SchemaFactory.createForClass(Experiment);
ExperimentSchema.index({ updatedAt: -1 });
ExperimentSchema.index({ status: 1, updatedAt: -1 });
ExperimentSchema.index({ 'algorithm.type': 1, updatedAt: -1 });