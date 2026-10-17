import { AlgorithmType, ExperimentStatus } from '../schemas/experiment.schema.js';

export class CreateExperimentDto {
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

export class UpdateExperimentDto {
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
