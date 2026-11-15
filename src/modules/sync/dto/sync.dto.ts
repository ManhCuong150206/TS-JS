import { SyncEntityType, SyncAction } from '../schemas/sync-operation.schema.js';

export class SyncOperationItemDto {
  operationId: string;
  idempotencyKey: string;
  entityType: SyncEntityType;
  entityClientId: string;
  action: SyncAction;
  payload: Record<string, unknown>;
  clientVersion: number;
  clientUpdatedAt?: string;
}

export class SyncBatchRequestDto {
  operations: SyncOperationItemDto[];
}

export class SyncOperationResultDto {
  operationId: string;
  idempotencyKey: string;
  entityType: SyncEntityType;
  entityClientId: string;
  status: 'applied' | 'conflict' | 'duplicate' | 'error';
  serverVersion?: number;
  conflict?: {
    reason: string;
    serverVersion: number;
    serverData: Record<string, unknown>;
  };
  error?: string;
}

export class SyncBatchResponseDto {
  success: boolean;
  syncedAt: Date;
  results: SyncOperationResultDto[];
}
