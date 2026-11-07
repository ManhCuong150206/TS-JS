import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';

export type TrainingRunDocument = HydratedDocument<TrainingRun>;
export type TrainingRunStatus =
  'queued' | 'running' | 'paused' | 'completed' | 'cancelled' | 'failed';
export type TrainingAlgorithmType =
  'linear' | 'polynomial' | 'ridge' | 'lasso' | 'neural-network';

@Schema({ _id: false })
export class MetricsInfo {
  @Prop()
  mse?: number;

  @Prop()
  rmse?: number;

  @Prop()
  mae?: number;

  @Prop()
  r2?: number;
}

export const MetricsInfoSchema = SchemaFactory.createForClass(MetricsInfo);

@Schema({ _id: false })
export class HistoryPoint {
  @Prop({ required: true, min: 0 })
  step: number;

  @Prop({ required: true })
  loss: number;

  @Prop({ type: MongooseSchema.Types.Mixed, required: true })
  parameters: Record<string, unknown>;

  @Prop({ default: Date.now })
  recordedAt: Date;
}

export const HistoryPointSchema = SchemaFactory.createForClass(HistoryPoint);

@Schema({ timestamps: true, collection: 'trainingRuns', minimize: false })
export class TrainingRun {
  @Prop({ required: true, trim: true, unique: true, index: true })
  clientId: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Experiment',
    required: true,
    index: true,
  })
  experimentId: MongooseSchema.Types.ObjectId;

  @Prop({
    type: String,
    required: true,
    enum: ['queued', 'running', 'paused', 'completed', 'cancelled', 'failed'],
    default: 'queued',
  })
  status: TrainingRunStatus;

  @Prop({
    type: String,
    required: true,
    enum: ['linear', 'polynomial', 'ridge', 'lasso', 'neural-network'],
  })
  algorithmType: TrainingAlgorithmType;

  @Prop({ required: true })
  algorithmVersion: string;

  @Prop({ type: MongooseSchema.Types.Mixed, required: true })
  configSnapshot: Record<string, unknown>;

  @Prop({ match: /^[a-f0-9]{64}$/i })
  datasetSha256?: string;

  @Prop({ default: 42 })
  seed: number;

  @Prop({ type: MetricsInfoSchema })
  metrics?: MetricsInfo;

  @Prop({ type: MongooseSchema.Types.Mixed })
  modelParameters?: Record<string, unknown>;

  @Prop({ type: [HistoryPointSchema], default: [] })
  history: HistoryPoint[];

  @Prop({ type: MongooseSchema.Types.Mixed })
  error?: { code?: string; message?: string };

  @Prop()
  startedAt?: Date;

  @Prop()
  completedAt?: Date;

  @Prop({ type: String, trim: true, index: true })
  ownerId?: string;

  @Prop({ type: Number, default: 1 })
  syncVersion: number;

  @Prop({ type: Date })
  deletedAt?: Date;
}

export const TrainingRunSchema = SchemaFactory.createForClass(TrainingRun);
TrainingRunSchema.index({ experimentId: 1, createdAt: -1 });
TrainingRunSchema.index({ ownerId: 1, createdAt: -1 });
