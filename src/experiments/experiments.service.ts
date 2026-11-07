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
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
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

@Injectable()
export class ExperimentsService {
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
        if (typeof lambda !== 'number' || isNaN(lambda) || lambda < 0) {
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
    const dataset = await this.datasetModel.findOne({
      ...idFilter(dto.datasetId),
      ...ownerFilter(user),
      deletedAt: { $exists: false },
    });
    if (!dataset) throw new NotFoundException('Không tìm thấy dataset');
    const datasetObjectId = dataset._id;

    // 2. Validate algorithm
    this.validateAlgorithm(dto.algorithm.type, dto.algorithm.config);

    // 3. Validate feature columns & target column
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
    experiments: Record<string, unknown>[],
    user: RequestUser,
  ): Promise<{ success: boolean; count: number }> {
    if (!Array.isArray(experiments) || experiments.length === 0) {
      return { success: true, count: 0 };
    }

    let count = 0;
    for (const exp of experiments) {
      const rawId = exp.id ?? exp.clientId;
      const clientId =
        typeof rawId === 'string' && rawId ? rawId : randomUUID();
      const existing = await this.experimentModel.findOne({ clientId });
      if (existing) {
        assertOwner(existing, user);
        if (existing.deletedAt)
          throw new NotFoundException('Không tìm thấy thí nghiệm');
      }
      const fields = dataFields(exp, 'experiment');
      if (typeof fields.algorithm === 'string') {
        fields.algorithm = {
          type: fields.algorithm,
          version: '1.0.0',
          config: { degree: exp.degree, lambda: exp.lambda },
        };
      }
      if (fields.datasetId) {
        const dataset = await this.datasetModel.findOne({
          ...idFilter(
            typeof fields.datasetId === 'string' ? fields.datasetId : '',
          ),
          ...ownerFilter(user),
          deletedAt: { $exists: false },
        });
        if (!dataset) throw new NotFoundException('Không tìm thấy dataset');
        fields.datasetId = dataset._id;
      }
      if (existing) {
        Object.assign(existing, fields); // Giữ chủ sở hữu đã lưu; bỏ qua ownerId client gửi.
        existing.syncVersion += 1;
        await existing.save();
      } else {
        await this.experimentModel.create({
          ...fields,
          clientId,
          ownerId: user.userId,
          syncVersion: 1,
        });
      }
      count++;
    }
    return { success: true, count };
  }
}
