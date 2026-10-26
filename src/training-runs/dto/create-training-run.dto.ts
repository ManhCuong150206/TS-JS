import { TrainingAlgorithmType, TrainingRunStatus } from '../schemas/training-run.schema.js';

export class CreateTrainingRunDto {
  clientId?: string;
  experimentId: string;
  status?: TrainingRunStatus;
  algorithmType: TrainingAlgorithmType;
  algorithmVersion?: string;
  configSnapshot: Record<string, unknown>;
  datasetSha256?: string;
  seed?: number;
  metrics?: {
    mse?: number;
    rmse?: number;
    mae?: number;
    r2?: number;
  };
  modelParameters?: Record<string, unknown>;
  history?: Array<{
    step: number;
    loss: number;
    parameters: Record<string, unknown>;
    recordedAt?: Date;
  }>;
  error?: {
    code?: string;
    message?: string;
  };
  startedAt?: Date;
  completedAt?: Date;
  ownerId?: string;
}
