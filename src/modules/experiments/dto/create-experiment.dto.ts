import {
  AlgorithmType,
  ExperimentStatus,
  SyntheticConfig,
  Experiment,
} from '../schemas/experiment.schema.js';

// Các trường đã có trong schema, dùng để lưu và dựng lại một lần chạy.
export class ExperimentSnapshotDto {
  learningReport?: Record<string, unknown>;
  clientCreatedAt?: number;
  learningRate?: number;
  maxIterations?: number;
  degree?: number;
  lambda?: number;
  dataSource?: 'synthetic' | 'csv';
  csvName?: string | null;
  sampleCount?: number;
  featureCount?: number;
  noise?: number;
  seed?: number;
  trainRatio?: number;
  iterations?: number;
  w?: number[];
  b?: number;
  train?: Experiment['train'];
  test?: Experiment['test'];
  csvData?: Record<string, unknown>;
  lastMutationId?: string;
}

export class CreateExperimentDto extends ExperimentSnapshotDto {
  synthetic?: SyntheticConfig;
  clientId?: string;
  name: string;
  description?: string;
  status?: ExperimentStatus;
  datasetId: string;
  algorithm: {
    type: AlgorithmType;
    version?: string;
    config: Record<string, unknown>;
  };
  targetColumn: string;
  featureColumns: string[];
  preprocessing?: {
    missingValues?: string;
    standardizeFeatures?: boolean;
  };
  split?: {
    testRatio?: number;
    seed?: number;
  };
  ownerId?: string;
}

export class UpdateExperimentDto extends ExperimentSnapshotDto {
  synthetic?: SyntheticConfig;
  name?: string;
  description?: string;
  status?: ExperimentStatus;
  algorithm?: {
    type?: AlgorithmType;
    version?: string;
    config?: Record<string, unknown>;
  };
  targetColumn?: string;
  featureColumns?: string[];
  preprocessing?: {
    missingValues?: string;
    standardizeFeatures?: boolean;
  };
  split?: {
    testRatio?: number;
    seed?: number;
  };
}
