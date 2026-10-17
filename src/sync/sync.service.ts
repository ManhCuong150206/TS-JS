import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SyncOperation, SyncOperationDocument } from './schemas/sync-operation.schema.js';
import {
  SyncBatchRequestDto,
  SyncBatchResponseDto,
  SyncOperationItemDto,
  SyncOperationResultDto,
} from './dto/sync.dto.js';
import { Experiment, ExperimentDocument } from '../experiments/schemas/experiment.schema.js';
import { Dataset, DatasetDocument } from '../datasets/schemas/dataset.schema.js';
import { TrainingRun, TrainingRunDocument } from '../training-runs/schemas/training-run.schema.js';

@Injectable()
export class SyncService {
  constructor(
    @InjectModel(SyncOperation.name) private readonly syncOpModel: Model<SyncOperationDocument>,
    @InjectModel(Experiment.name) private readonly experimentModel: Model<ExperimentDocument>,
    @InjectModel(Dataset.name) private readonly datasetModel: Model<DatasetDocument>,
    @InjectModel(TrainingRun.name) private readonly trainingRunModel: Model<TrainingRunDocument>,
  ) {}

  /**
   * Xử lý Batch Sync từ client offline:
   * 1. Idempotency Check: Ngăn chặn xử lý lặp lại nếu cùng idempotencyKey.
   * 2. Conflict Detection: Phát hiện xung đột phiên bản (clientVersion < serverVersion).
   * 3. Apply changes: Cập nhật hoặc tạo mới và tăng syncVersion.
   * 4. Audit Log: Lưu vết toàn bộ phiên đồng bộ vào syncOperations.
   */
  async processBatch(
    batchDto: SyncBatchRequestDto,
    ownerId?: string,
  ): Promise<SyncBatchResponseDto> {
    if (!batchDto || !Array.isArray(batchDto.operations)) {
      throw new BadRequestException('Request body phải chứa mảng operations.');
    }

    const results: SyncOperationResultDto[] = [];
    const resolvedOwner = ownerId || 'anonymous_user';

    for (const op of batchDto.operations) {
      // 1. Kiểm tra Idempotency
      const existingOp = await this.syncOpModel.findOne({ idempotencyKey: op.idempotencyKey }).exec();
      if (existingOp) {
        results.push({
          operationId: op.operationId,
          idempotencyKey: op.idempotencyKey,
          entityType: op.entityType,
          entityClientId: op.entityClientId,
          status: 'duplicate',
          serverVersion: existingOp.serverVersion,
        });
        continue;
      }

      try {
        let result: SyncOperationResultDto;
        switch (op.entityType) {
          case 'experiment':
            result = await this.syncExperiment(op, resolvedOwner);
            break;
          case 'dataset':
            result = await this.syncDataset(op, resolvedOwner);
            break;
          case 'trainingRun':
            result = await this.syncTrainingRun(op, resolvedOwner);
            break;
          default:
            result = {
              operationId: op.operationId,
              idempotencyKey: op.idempotencyKey,
              entityType: op.entityType,
              entityClientId: op.entityClientId,
              status: 'error',
              error: `EntityType không hợp lệ: ${op.entityType}`,
            };
        }

        // Lưu audit log cho thao tác
        await this.syncOpModel.create({
          operationId: op.operationId,
          idempotencyKey: op.idempotencyKey,
          entityType: op.entityType,
          entityClientId: op.entityClientId,
          action: op.action,
          clientVersion: op.clientVersion,
          serverVersion: result.serverVersion || 1,
          status: result.status,
          conflictReason: result.conflict?.reason,
          serverDataSnapshot: result.conflict?.serverData,
          ownerId: resolvedOwner,
        });

        results.push(result);
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        results.push({
          operationId: op.operationId,
          idempotencyKey: op.idempotencyKey,
          entityType: op.entityType,
          entityClientId: op.entityClientId,
          status: 'error',
          error: errorMsg,
        });
      }
    }

    return {
      success: results.every(r => r.status === 'applied' || r.status === 'duplicate'),
      syncedAt: new Date(),
      results,
    };
  }

  /**
   * Xử lý đồng bộ cho Experiment
   */
  private async syncExperiment(
    op: SyncOperationItemDto,
    ownerId: string,
  ): Promise<SyncOperationResultDto> {
    const existing = await this.experimentModel.findOne({ clientId: op.entityClientId }).exec();

    if (op.action === 'create') {
      if (existing) {
        // Đã tồn tại trên server: kiểm tra xung đột
        if ((existing.syncVersion || 1) > op.clientVersion) {
          return {
            operationId: op.operationId,
            idempotencyKey: op.idempotencyKey,
            entityType: op.entityType,
            entityClientId: op.entityClientId,
            status: 'conflict',
            serverVersion: existing.syncVersion,
            conflict: {
              reason: 'Bản ghi đã tồn tại trên server với phiên bản mới hơn.',
              serverVersion: existing.syncVersion,
              serverData: existing.toObject() as unknown as Record<string, unknown>,
            },
          };
        }
      }

      // Tạo mới
      const created = await this.experimentModel.create({
        ...op.payload,
        clientId: op.entityClientId,
        ownerId,
        syncVersion: 1,
      });

      return {
        operationId: op.operationId,
        idempotencyKey: op.idempotencyKey,
        entityType: op.entityType,
        entityClientId: op.entityClientId,
        status: 'applied',
        serverVersion: created.syncVersion,
      };
    }

    if (op.action === 'update') {
      if (!existing) {
        // Nếu server chưa có, tạo mới
        const created = await this.experimentModel.create({
          ...op.payload,
          clientId: op.entityClientId,
          ownerId,
          syncVersion: 1,
        });
        return {
          operationId: op.operationId,
          idempotencyKey: op.idempotencyKey,
          entityType: op.entityType,
          entityClientId: op.entityClientId,
          status: 'applied',
          serverVersion: created.syncVersion,
        };
      }

      // PHÁT HIỆN XUNG ĐỘT: Nếu serverVersion > clientVersion
      const currentServerVersion = existing.syncVersion || 1;
      if (currentServerVersion > op.clientVersion) {
        return {
          operationId: op.operationId,
          idempotencyKey: op.idempotencyKey,
          entityType: op.entityType,
          entityClientId: op.entityClientId,
          status: 'conflict',
          serverVersion: currentServerVersion,
          conflict: {
            reason: `Xung đột dữ liệu: Phiên bản trên máy chủ (${currentServerVersion}) mới hơn phiên bản offline của bạn (${op.clientVersion}).`,
            serverVersion: currentServerVersion,
            serverData: existing.toObject() as unknown as Record<string, unknown>,
          },
        };
      }

      // Cập nhật hợp lệ
      Object.assign(existing, op.payload);
      existing.syncVersion = currentServerVersion + 1;
      await existing.save();

      return {
        operationId: op.operationId,
        idempotencyKey: op.idempotencyKey,
        entityType: op.entityType,
        entityClientId: op.entityClientId,
        status: 'applied',
        serverVersion: existing.syncVersion,
      };
    }

    if (op.action === 'delete') {
      if (!existing) {
        return {
          operationId: op.operationId,
          idempotencyKey: op.idempotencyKey,
          entityType: op.entityType,
          entityClientId: op.entityClientId,
          status: 'applied',
        };
      }

      existing.deletedAt = new Date();
      existing.syncVersion = (existing.syncVersion || 1) + 1;
      await existing.save();

      return {
        operationId: op.operationId,
        idempotencyKey: op.idempotencyKey,
        entityType: op.entityType,
        entityClientId: op.entityClientId,
        status: 'applied',
        serverVersion: existing.syncVersion,
      };
    }

    throw new BadRequestException(`Hành động không được hỗ trợ: ${op.action}`);
  }

  /**
   * Xử lý đồng bộ cho Dataset
   */
  private async syncDataset(
    op: SyncOperationItemDto,
    ownerId: string,
  ): Promise<SyncOperationResultDto> {
    const existing = await this.datasetModel.findOne({ clientId: op.entityClientId }).exec();

    if (op.action === 'create') {
      if (existing) {
        return {
          operationId: op.operationId,
          idempotencyKey: op.idempotencyKey,
          entityType: op.entityType,
          entityClientId: op.entityClientId,
          status: 'duplicate',
          serverVersion: existing.syncVersion,
        };
      }

      const created = await this.datasetModel.create({
        ...op.payload,
        clientId: op.entityClientId,
        ownerId,
        syncVersion: 1,
      });

      return {
        operationId: op.operationId,
        idempotencyKey: op.idempotencyKey,
        entityType: op.entityType,
        entityClientId: op.entityClientId,
        status: 'applied',
        serverVersion: created.syncVersion,
      };
    }

    if (op.action === 'update') {
      if (!existing) {
        const created = await this.datasetModel.create({
          ...op.payload,
          clientId: op.entityClientId,
          ownerId,
          syncVersion: 1,
        });
        return {
          operationId: op.operationId,
          idempotencyKey: op.idempotencyKey,
          entityType: op.entityType,
          entityClientId: op.entityClientId,
          status: 'applied',
          serverVersion: created.syncVersion,
        };
      }

      const serverVersion = existing.syncVersion || 1;
      if (serverVersion > op.clientVersion) {
        return {
          operationId: op.operationId,
          idempotencyKey: op.idempotencyKey,
          entityType: op.entityType,
          entityClientId: op.entityClientId,
          status: 'conflict',
          serverVersion,
          conflict: {
            reason: 'Dataset trên máy chủ có phiên bản mới hơn.',
            serverVersion,
            serverData: existing.toObject() as unknown as Record<string, unknown>,
          },
        };
      }

      Object.assign(existing, op.payload);
      existing.syncVersion = serverVersion + 1;
      await existing.save();

      return {
        operationId: op.operationId,
        idempotencyKey: op.idempotencyKey,
        entityType: op.entityType,
        entityClientId: op.entityClientId,
        status: 'applied',
        serverVersion: existing.syncVersion,
      };
    }

    if (op.action === 'delete') {
      if (existing) {
        existing.deletedAt = new Date();
        existing.syncVersion = (existing.syncVersion || 1) + 1;
        await existing.save();
      }
      return {
        operationId: op.operationId,
        idempotencyKey: op.idempotencyKey,
        entityType: op.entityType,
        entityClientId: op.entityClientId,
        status: 'applied',
      };
    }

    throw new BadRequestException(`Hành động không hợp lệ: ${op.action}`);
  }

  /**
   * Xử lý đồng bộ cho TrainingRun
   */
  private async syncTrainingRun(
    op: SyncOperationItemDto,
    ownerId: string,
  ): Promise<SyncOperationResultDto> {
    const existing = await this.trainingRunModel.findOne({ clientId: op.entityClientId }).exec();

    if (op.action === 'create') {
      if (existing) {
        return {
          operationId: op.operationId,
          idempotencyKey: op.idempotencyKey,
          entityType: op.entityType,
          entityClientId: op.entityClientId,
          status: 'duplicate',
          serverVersion: existing.syncVersion,
        };
      }

      const created = await this.trainingRunModel.create({
        ...op.payload,
        clientId: op.entityClientId,
        ownerId,
        syncVersion: 1,
      });

      return {
        operationId: op.operationId,
        idempotencyKey: op.idempotencyKey,
        entityType: op.entityType,
        entityClientId: op.entityClientId,
        status: 'applied',
        serverVersion: created.syncVersion,
      };
    }

    if (op.action === 'update' && existing) {
      Object.assign(existing, op.payload);
      existing.syncVersion = (existing.syncVersion || 1) + 1;
      await existing.save();

      return {
        operationId: op.operationId,
        idempotencyKey: op.idempotencyKey,
        entityType: op.entityType,
        entityClientId: op.entityClientId,
        status: 'applied',
        serverVersion: existing.syncVersion,
      };
    }

    return {
      operationId: op.operationId,
      idempotencyKey: op.idempotencyKey,
      entityType: op.entityType,
      entityClientId: op.entityClientId,
      status: 'applied',
    };
  }

  /**
   * API Lấy tất cả các thay đổi từ máy chủ kể từ thời điểm `since` (Pull sync changes)
   */
  async getChanges(sinceStr?: string, ownerId?: string) {
    const sinceDate = sinceStr ? new Date(sinceStr) : new Date(0);
    const filter: Record<string, unknown> = {
      updatedAt: { $gte: sinceDate },
    };

    if (ownerId && ownerId !== 'anonymous_user') {
      filter.$or = [{ ownerId }, { ownerId: 'anonymous_user' }];
    }

    const [experiments, datasets, trainingRuns] = await Promise.all([
      this.experimentModel.find(filter).exec(),
      this.datasetModel.find(filter).exec(),
      this.trainingRunModel.find(filter).exec(),
    ]);

    return {
      serverTime: new Date(),
      since: sinceDate,
      changes: {
        experiments,
        datasets,
        trainingRuns,
      },
    };
  }
}
