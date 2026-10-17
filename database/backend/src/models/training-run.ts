import mongoose from 'mongoose';

const { Schema, model } = mongoose;

export type TrainingRunStatus = 'queued' | 'running' | 'paused' | 'completed' | 'cancelled' | 'failed';
export type TrainingAlgorithmType = 'linear' | 'polynomial' | 'ridge' | 'lasso' | 'neural-network';

export interface TrainingRunRecord {
  clientId: string;
  experimentId: mongoose.Types.ObjectId;
  status?: TrainingRunStatus;
  algorithmType: TrainingAlgorithmType;
  algorithmVersion: string;
  configSnapshot: Record<string, unknown>;
  datasetSha256?: string;
  seed?: number;
  metrics?: { mse?: number; rmse?: number; mae?: number; r2?: number };
  modelParameters?: Record<string, unknown>;
  history?: Array<{ step: number; loss: number; parameters: Record<string, unknown>; recordedAt?: Date }>;
  error?: { code?: string; message?: string };
  startedAt?: Date;
  completedAt?: Date;
  ownerId?: mongoose.Types.ObjectId;
}

const metricsSchema = new Schema({
  mse: { type: Number },
  rmse: { type: Number },
  mae: { type: Number },
  r2: { type: Number }
}, { _id: false });

const errorSchema = new Schema({
  code: { type: String },
  message: { type: String, maxlength: 500 }
}, { _id: false });

const historyPointSchema = new Schema({
  step: { type: Number, required: true, min: 0 },
  loss: { type: Number, required: true },
  parameters: { type: Schema.Types.Mixed, required: true },
  recordedAt: { type: Date, default: Date.now }
}, { _id: false });

const trainingRunSchema = new Schema<TrainingRunRecord>({
  clientId: { type: String, required: true, trim: true },
  experimentId: { type: Schema.Types.ObjectId, ref: 'Experiment', required: true },
  status: { type: String, required: true, enum: ['queued', 'running', 'paused', 'completed', 'cancelled', 'failed'], default: 'queued' },
  algorithmType: { type: String, required: true, enum: ['linear', 'polynomial', 'ridge', 'lasso', 'neural-network'] },
  algorithmVersion: { type: String, required: true },
  configSnapshot: { type: Schema.Types.Mixed, required: true },
  datasetSha256: { type: String, match: /^[a-f0-9]{64}$/i },
  seed: { type: Number, default: 42 },
  metrics: { type: metricsSchema },
  modelParameters: { type: Schema.Types.Mixed },
  history: {
    type: [historyPointSchema],
    default: [],
    validate: {
      validator: (points: unknown[]) => points.length <= 2000,
      message: 'Store no more than 2000 sampled history points in a run.'
    }
  },
  error: { type: errorSchema },
  startedAt: { type: Date },
  completedAt: { type: Date },
  ownerId: { type: Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true, collection: 'trainingRuns', strict: 'throw' });

trainingRunSchema.index({ clientId: 1 }, { unique: true });
trainingRunSchema.index({ experimentId: 1, createdAt: -1 });
trainingRunSchema.index({ ownerId: 1, createdAt: -1 });

export const TrainingRun = model<TrainingRunRecord>('TrainingRun', trainingRunSchema);
