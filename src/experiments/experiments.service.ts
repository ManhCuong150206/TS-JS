import { RequestUser } from '../common/auth.guard.js';
import {
  ownerFilter,
  idFilter,
  dataFields,
  assertOwner,
} from '../common/ownership.js';
import {
  Injectable,
  BadRequestException,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Error as MongooseError, Model, UpdateQuery } from 'mongoose';
import { randomUUID } from 'node:crypto';
import {
  Experiment,
  ExperimentDocument,
  AlgorithmType,
} from './schemas/experiment.schema.js';
import {
  CreateExperimentDto,
  UpdateExperimentDto,
} from './dto/create-experiment.dto.js';
import {
  Dataset,
  DatasetDocument,
} from '../datasets/schemas/dataset.schema.js';
import { validateSyntheticConfig } from './synthetic-config.validation.js';

export interface BulkItem {
  id: string;
  syncVersion: number;
}

interface BulkConflict {
  id: string;
  syncVersion: number | null;
}

@Injectable()
export class ExperimentsService {
  private readonly logger = new Logger(ExperimentsService.name);
  constructor(
    @InjectModel(Experiment.name)
    private readonly experimentModel: Model<ExperimentDocument>,
    @InjectModel(Dataset.name)
    private readonly datasetModel: Model<DatasetDocument>,
  ) {}

  /**
   * Validate algorithm config matching algorithm type
   */
  private validateAlgorithm(
    type: AlgorithmType,
    config: Record<string, unknown>,
  ): void {
    if (!config || typeof config !== 'object') {
      throw new BadRequestException('Algorithm config must be an object.');
    }

    switch (type) {
      case 'linear': {
        const solver = config.solver ?? 'gradient-descent';
        if (
          !['ordinary-least-squares', 'gradient-descent'].includes(
            solver as string,
          )
        ) {
          throw new BadRequestException(
            'Linear solver must be "ordinary-least-squares" or "gradient-descent".',
          );
        }
        break;
      }
      case 'polynomial': {
        const degree = config.degree;
        if (
          typeof degree !== 'number' ||
          !Number.isInteger(degree) ||
          degree < 1 ||
          degree > 10
        ) {
          throw new BadRequestException(
            'Polynomial degree must be an integer between 1 and 10.',
          );
        }
        break;
      }
      case 'ridge':
      case 'lasso': {
        const lambda = config.lambda;
        if (typeof lambda !== 'number' || !Number.isFinite(lambda) || lambda < 0) {
          throw new BadRequestException(
            `${type} requires non-negative lambda parameter.`,
          );
        }
        break;
      }
      case 'neural-network': {
        const layers = config.hiddenLayers;
        if (
          !Array.isArray(layers) ||
          !layers.every((w) => Number.isInteger(w) && w > 0)
        ) {
          throw new BadRequestException(
            'Neural network hiddenLayers must be an array of positive integers.',
          );
        }
        break;
      }
      default:
        throw new BadRequestException(
          `Unsupported algorithm type: ${type as string}`,
        );
    }
  }

  async create(
    dto: CreateExperimentDto,
    user: RequestUser,
  ): Promise<Experiment> {
    const dataset = await this.datasetModel
      .findOne({
        ...idFilter(dto.datasetId),
        ...ownerFilter(user),
        deletedAt: { $exists: false },
      })
      .exec();
    if (!dataset) throw new NotFoundException('Không tìm thấy dataset');
    const datasetObjectId = dataset._id;

    this.validateAlgorithm(dto.algorithm.type, dto.algorithm.config);
    validateSyntheticConfig(dto.synthetic);

    if (!dto.targetColumn || !dto.targetColumn.trim()) {
      throw new BadRequestException('targetColumn không được để trống.');
    }
    if (!Array.isArray(dto.featureColumns) || dto.featureColumns.length === 0) {
      throw new BadRequestException(
        'featureColumns phải chứa ít nhất 1 đặc trưng.',
      );
    }

    const clientId = dto.clientId || randomUUID();
    const created = new this.experimentModel(
      Object.assign({}, dataFields(dto, 'experiment'), {
        datasetId: datasetObjectId,
        clientId,
        ownerId: user.userId,
        syncVersion: 1,
      }),
    );

    return created.save();
  }

  async findAll(user: RequestUser, page = 1, limit = 20) {
    const filter = { deletedAt: { $exists: false }, ...ownerFilter(user) };

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.experimentModel
        .find(filter)
        .populate({
          path: 'datasetId',
          match: { ...ownerFilter(user), deletedAt: { $exists: false } },
        })
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.experimentModel.countDocuments(filter).exec(),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string, user: RequestUser): Promise<Experiment> {
    const experiment = await this.experimentModel
      .findOne({
        ...idFilter(id),
        ...ownerFilter(user),
        deletedAt: { $exists: false },
      })
      .populate({
        path: 'datasetId',
        match: { ...ownerFilter(user), deletedAt: { $exists: false } },
      })
      .exec();

    if (!experiment) {
      throw new NotFoundException(`Không tìm thấy thí nghiệm với ID: ${id}`);
    }
    return experiment;
  }

  async update(
    id: string,
    dto: UpdateExperimentDto,
    user: RequestUser,
  ): Promise<Experiment> {
    const experiment = await this.findOne(id, user);

    if (dto.algorithm?.type && dto.algorithm?.config) {
      this.validateAlgorithm(dto.algorithm.type, dto.algorithm.config);
    }
    if (dto.synthetic !== undefined) {
      validateSyntheticConfig(dto.synthetic);
    }

    const fields = dataFields(dto, 'experiment');
    delete fields.datasetId; // API PATCH cũ không hỗ trợ thay dataset.
    Object.assign(experiment, fields);
    experiment.syncVersion = (experiment.syncVersion || 1) + 1;

    return (experiment as ExperimentDocument).save();
  }

  async remove(
    id: string,
    user: RequestUser,
  ): Promise<{ success: boolean; message: string }> {
    const experiment = await this.findOne(id, user);
    experiment.deletedAt = new Date();
    experiment.syncVersion = (experiment.syncVersion || 1) + 1;
    await (experiment as ExperimentDocument).save();
    return { success: true, message: 'Đã xóa thí nghiệm thành công.' };
  }

  async bulkUpsert(
    experiments: unknown,
    user: RequestUser,
  ): Promise<{ success: true; count: number; items: BulkItem[] }> {
    if (!Array.isArray(experiments) || experiments.length > 100) {
      throw new BadRequestException('Gửi một mảng tối đa 100 thí nghiệm.');
    }

    const seen = new Set<string>();
    const plan: {
      clientId: string;
      fields: Record<string, unknown>;
      expectedVersion?: number;
      mutationId?: string;
      existing: ExperimentDocument | null;
    }[] = [];

    for (const input of experiments as unknown[]) {
      if (!input || typeof input !== 'object' || Array.isArray(input)) {
        throw new BadRequestException('Mỗi mục đồng bộ phải là một object.');
      }
      const exp = input as Record<string, unknown>;
      const rawId = exp.id ?? exp.clientId;
      if (typeof rawId !== 'string' || !rawId.trim() || rawId.length > 128) {
        throw new BadRequestException('Mỗi thí nghiệm cần id hợp lệ, tối đa 128 ký tự.');
      }
      const clientId = rawId.trim();
      if (seen.has(clientId)) throw new BadRequestException('Trùng id trong lô đồng bộ.');
      seen.add(clientId);
      const expectedVersion = exp.expectedVersion;
      const mutationId = exp.lastMutationId;
      if (mutationId !== undefined && (typeof mutationId !== 'string' || !mutationId.trim() || mutationId.length > 128)) {
        throw new BadRequestException('lastMutationId phải là chuỗi từ 1 đến 128 ký tự.');
      }
      if (expectedVersion !== undefined && (
        typeof expectedVersion !== 'number' || !Number.isSafeInteger(expectedVersion) ||
        expectedVersion < 0 || expectedVersion >= Number.MAX_SAFE_INTEGER || typeof mutationId !== 'string'
      )) {
        throw new BadRequestException('expectedVersion cần là số nguyên không âm và đi cùng lastMutationId.');
      }

      const existing = await this.experimentModel.findOne({ clientId }).exec();
      if (existing) {
        assertOwner(existing, user);
        if (existing.deletedAt && expectedVersion === undefined) {
          throw new NotFoundException('Không tìm thấy thí nghiệm');
        }
      }

      const fields = dataFields(exp, 'experiment') as Record<string, unknown>;
      // Các field do server quyết định, không nhận từ client.
      delete fields.clientId;
      delete fields.ownerId;
      delete fields.syncVersion;

      if (typeof fields.algorithm === 'string') {
        fields.algorithm = {
          type: fields.algorithm,
          version: '1.0.0',
          config: { degree: exp.degree, lambda: exp.lambda },
        };
      }

      // Accept legacy flat payloads; persist one canonical copy of each setting.
      if (typeof exp.clientCreatedAt === 'number' || typeof exp.createdAt === 'number') fields.clientCreatedAt = exp.clientCreatedAt ?? exp.createdAt;
      if (fields.algorithm !== undefined && (
        !fields.algorithm || typeof fields.algorithm !== 'object' || Array.isArray(fields.algorithm)
      )) throw new BadRequestException('Thuật toán không hợp lệ.');
      const algorithm = fields.algorithm as { type?: string; config?: Record<string, unknown> } | undefined;
      if (algorithm) {
        if (algorithm.config !== undefined && (
          !algorithm.config || typeof algorithm.config !== 'object' || Array.isArray(algorithm.config)
        )) throw new BadRequestException('Cấu hình thuật toán không hợp lệ.');
        const config = { ...algorithm.config };
        if (algorithm.type === 'polynomial') config.degree = config.degree ?? exp.degree;
        else delete config.degree;
        if (algorithm.type === 'ridge' || algorithm.type === 'lasso') config.lambda = config.lambda ?? exp.lambda;
        else delete config.lambda;
        algorithm.config = config;
      }
      delete fields.degree;
      delete fields.lambda;
      if (fields.dataSource === 'synthetic') {
        fields.synthetic ??= {
          kind: 'linear', version: 1, sampleCount: exp.sampleCount, featureCount: exp.featureCount,
          noise: exp.noise, seed: exp.seed, trainRatio: exp.trainRatio,
        };
        for (const key of ['csvName', 'csvData', 'sampleCount', 'featureCount', 'noise', 'seed', 'trainRatio']) delete fields[key];
      } else if (fields.dataSource === 'csv') {
        delete fields.synthetic;
        delete fields.noise;
        if (!fields.csvName) delete fields.csvName;
      }
      fields.status ??= existing?.status ?? (Array.isArray(fields.w) ? 'completed' : 'draft');
      if (fields.name !== undefined || !existing) {
        if (typeof fields.name !== 'string' || !fields.name.trim() || fields.name.length > 120) {
          throw new BadRequestException('Tên thí nghiệm cần từ 1 đến 120 ký tự.');
        }
      }
      if (algorithm) this.validateAlgorithm(algorithm.type as AlgorithmType, algorithm.config ?? {});
      else if (!existing) throw new BadRequestException('Thiếu thuật toán cho thí nghiệm mới.');
      if (fields.status !== undefined && !['draft', 'ready', 'running', 'completed', 'error'].includes(String(fields.status))) {
        throw new BadRequestException('Trạng thái thí nghiệm không hợp lệ.');
      }
      validateSyntheticConfig(fields.synthetic);

      if (fields.datasetId) {
        const dataset = await this.datasetModel
          .findOne({
            ...idFilter(
              typeof fields.datasetId === 'string' ? fields.datasetId : '',
            ),
            ...ownerFilter(user),
            deletedAt: { $exists: false },
          })
          .exec();
        if (!dataset) throw new NotFoundException('Không tìm thấy dataset');
        fields.datasetId = dataset._id;
      }

      plan.push({ clientId, fields, expectedVersion, mutationId, existing });
    }

    const items: BulkItem[] = [];
    const conflicts: BulkConflict[] = [];
    const errors: { id: string; message: string }[] = [];
    const report = () => ({ success: false, count: items.length, items, conflicts, errors });

    for (const { clientId, fields, expectedVersion, mutationId, existing } of plan) {
      const guarded = expectedVersion !== undefined;
      const replay = (record: ExperimentDocument | null) =>
        guarded && record && !record.deletedAt &&
        record.lastMutationId === mutationId && record.syncVersion === expectedVersion + 1;
      if (replay(existing) && existing) {
        items.push({ id: clientId, syncVersion: existing.syncVersion });
        continue;
      }
      if (guarded && (existing?.deletedAt || (existing?.syncVersion ?? 0) !== expectedVersion)) {
        conflicts.push({ id: clientId, syncVersion: existing?.syncVersion ?? null });
        continue;
      }

      const filter = { clientId, ...ownerFilter(user), deletedAt: { $exists: false } };
      const versionFilter = expectedVersion === 1
        ? { $or: [{ syncVersion: 1 }, { syncVersion: { $exists: false } }] }
        : { syncVersion: expectedVersion };
      // Match and update the version in the same database operation.
      const updateQuery: UpdateQuery<ExperimentDocument> = {
        $set: guarded ? { ...fields, syncVersion: expectedVersion + 1 } : fields,
        $setOnInsert: { ownerId: user.userId },
        ...(guarded ? {} : { $inc: { syncVersion: 1 } }),
      };

      try {
        let saved: ExperimentDocument | null = null;
        try {
          saved = await this.experimentModel.findOneAndUpdate(
            guarded ? { ...filter, ...versionFilter } : filter,
            updateQuery,
            {
              upsert: !guarded || !existing,
              returnDocument: 'after',
              setDefaultsOnInsert: false,
              runValidators: true,
            },
          ).exec();
        } catch (error) {
          // Concurrent creates can both miss the record. The unique clientId index picks one.
          if (!guarded || !(error instanceof Error) || !('code' in error) || error.code !== 11000) throw error;
        }

        if (saved) {
          items.push({ id: clientId, syncVersion: saved.syncVersion });
          continue;
        }
        const current = await this.experimentModel.findOne({ clientId, ...ownerFilter(user) }).exec();
        if (replay(current) && current) {
          items.push({ id: clientId, syncVersion: current.syncVersion });
        } else {
          conflicts.push({ id: clientId, syncVersion: current?.syncVersion ?? null });
        }
      } catch (error) {
        if (error instanceof MongooseError.ValidationError || error instanceof MongooseError.CastError) {
          errors.push({ id: clientId, message: 'Dữ liệu thí nghiệm không hợp lệ.' });
          continue;
        }
        this.logger.error('Không thể ghi lô thí nghiệm.', error instanceof Error ? error.stack : undefined);
        throw new HttpException({ ...report(), message: 'Đồng bộ gián đoạn. Có thể thử lại các mục còn chờ.' }, HttpStatus.INTERNAL_SERVER_ERROR);
      }
    }

    if (conflicts.length || errors.length) {
      const status = conflicts.length ? HttpStatus.CONFLICT : HttpStatus.BAD_REQUEST;
      const message = conflicts.length
        ? 'Có thí nghiệm đã thay đổi trên máy chủ.'
        : 'Có thí nghiệm không hợp lệ.';
      throw new HttpException({ ...report(), message }, status);
    }
    return { success: true, count: items.length, items };
  }
}
