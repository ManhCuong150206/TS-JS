import mongoose from 'mongoose';

const { Schema, model } = mongoose;

export type AlgorithmType = 'linear' | 'polynomial' | 'ridge' | 'lasso' | 'neural-network';
export type ExperimentStatus = 'draft' | 'ready' | 'running' | 'completed' | 'error';

export interface AlgorithmConfig {
  solver?: string;
  learningRate?: number;
  epochs?: number;
  degree?: number;
  lambda?: number;
  hiddenLayers?: number[];
  [key: string]: unknown;
}

export interface ExperimentRecord {
  clientId: string;
  name: string;
  description?: string;
  status?: ExperimentStatus;
  datasetId: mongoose.Types.ObjectId;
  algorithm: { type: AlgorithmType; version?: string; config: AlgorithmConfig };
  targetColumn: string;
  featureColumns: string[];
  preprocessing?: { missingValues?: string; standardizeFeatures?: boolean };
  split?: { testRatio?: number; seed?: number };
  ownerId?: mongoose.Types.ObjectId;
  syncVersion?: number;
  deletedAt?: Date;
}

const algorithmSchema = new Schema({
  type: {
    type: String,
    required: true,
    enum: ['linear', 'polynomial', 'ridge', 'lasso', 'neural-network']
  },
  version: { type: String, default: '1.0.0' },
  config: { type: Schema.Types.Mixed, required: true }
}, { _id: false, strict: 'throw' });

const isFinitePositive = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

algorithmSchema.path('config').validate(function validateAlgorithmConfig(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const config = value as AlgorithmConfig;
  const algorithmType = (this as unknown as { type: AlgorithmType }).type;

  switch (algorithmType) {
    case 'linear':
      return ['ordinary-least-squares', 'gradient-descent'].includes(config.solver ?? 'gradient-descent')
        && (config.learningRate === undefined || isFinitePositive(config.learningRate))
        && (config.epochs === undefined || (Number.isInteger(config.epochs) && config.epochs > 0));
    case 'polynomial':
      return Number.isInteger(config.degree) && (config.degree ?? 0) >= 1 && (config.degree ?? 11) <= 10;
    case 'ridge':
    case 'lasso':
      return typeof config.lambda === 'number' && Number.isFinite(config.lambda) && config.lambda >= 0;
    case 'neural-network':
      return Array.isArray(config.hiddenLayers)
        && config.hiddenLayers.every((width) => Number.isInteger(width) && width > 0);
    default:
      return false;
  }
}, 'Algorithm config does not match algorithm.type.');

const preprocessingSchema = new Schema({
  missingValues: { type: String, enum: ['reject', 'drop-rows', 'mean-imputation'], default: 'reject' },
  standardizeFeatures: { type: Boolean, default: false }
}, { _id: false });

const splitSchema = new Schema({
  testRatio: { type: Number, min: 0.05, max: 0.5, default: 0.2 },
  seed: { type: Number, default: 42 }
}, { _id: false });

const experimentSchema = new Schema<ExperimentRecord>({
  clientId: { type: String, required: true, trim: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, trim: true, maxlength: 1000, default: '' },
  status: { type: String, enum: ['draft', 'ready', 'running', 'completed', 'error'], default: 'draft' },
  datasetId: { type: Schema.Types.ObjectId, ref: 'Dataset', required: true },
  algorithm: { type: algorithmSchema, required: true },
  targetColumn: { type: String, required: true, trim: true },
  featureColumns: {
    type: [String],
    required: true,
    validate: {
      validator: (columns: string[]) => columns.length > 0 && new Set(columns).size === columns.length,
      message: 'Select at least one unique feature column.'
    }
  },
  preprocessing: { type: preprocessingSchema, default: () => ({}) },
  split: { type: splitSchema, default: () => ({}) },
  ownerId: { type: Schema.Types.ObjectId, ref: 'User' },
  syncVersion: { type: Number, min: 1, default: 1 },
  deletedAt: { type: Date }
}, { timestamps: true, collection: 'experiments', strict: 'throw' });

experimentSchema.index({ clientId: 1 }, { unique: true });
experimentSchema.index({ ownerId: 1, updatedAt: -1 });
experimentSchema.index({ status: 1, updatedAt: -1 });

export const Experiment = model<ExperimentRecord>('Experiment', experimentSchema);
