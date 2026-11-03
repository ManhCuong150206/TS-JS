import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomUUID } from 'node:crypto';
import { Experiment, ExperimentDocument, AlgorithmType } from './schemas/experiment.schema.js';
import { CreateExperimentDto, UpdateExperimentDto } from './dto/create-experiment.dto.js';
import { Dataset, DatasetDocument } from '../datasets/schemas/dataset.schema.js';

@Injectable()
export class ExperimentsService {
  constructor(
    @InjectModel(Experiment.name) private readonly experimentModel: Model<ExperimentDocument>,
    @InjectModel(Dataset.name) private readonly datasetModel: Model<DatasetDocument>,
  ) {}

  /**
   * Validate algorithm config matching algorithm type
   */
  private validateAlgorithm(type: AlgorithmType, config: Record<string, unknown>): void {
    if (!config || typeof config !== 'object') {
      throw new BadRequestException('Algorithm config must be an object.');
    }

    switch (type) {
      case 'linear': {
        const solver = config.solver ?? 'gradient-descent';
        if (!['ordinary-least-squares', 'gradient-descent'].includes(solver as string)) {
          throw new BadRequestException('Linear solver must be "ordinary-least-squares" or "gradient-descent".');
        }
        break;
      }
      case 'polynomial': {
        const degree = config.degree;
        if (typeof degree !== 'number' || !Number.isInteger(degree) || degree < 1 || degree > 10) {
          throw new BadRequestException('Polynomial degree must be an integer between 1 and 10.');
        }
        break;
      }
      case 'ridge':
      case 'lasso': {
        const lambda = config.lambda;
        if (typeof lambda !== 'number' || isNaN(lambda) || lambda < 0) {
          throw new BadRequestException(`${type} requires non-negative lambda parameter.`);
        }
        break;
      }
      case 'neural-network': {
        const layers = config.hiddenLayers;
        if (!Array.isArray(layers) || !layers.every(w => Number.isInteger(w) && w > 0)) {
          throw new BadRequestException('Neural network hiddenLayers must be an array of positive integers.');
        }
        break;
      }
      default:
        throw new BadRequestException(`Unsupported algorithm type: ${type as string}`);
    }
  }

  private validateSynthetic(value: unknown): void {
    if (value === undefined) return;
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new BadRequestException('synthetic phải là object.');
    const c = value as Record<string, unknown>;
    const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
    if (!['linear', 'curved', 'correlated', 'sparse'].includes(String(c.kind)) || c.version !== 1 ||
        !finite(c.sampleCount) || !Number.isInteger(c.sampleCount) || c.sampleCount < 2 ||
        !finite(c.featureCount) || !Number.isInteger(c.featureCount) || c.featureCount < 1 ||
        !finite(c.noise) || c.noise < 0 || c.noise > 50 || !finite(c.seed) || !Number.isInteger(c.seed) ||
        !finite(c.trainRatio) || c.trainRatio < .01 || c.trainRatio > .99 ||
        Math.floor(c.sampleCount*c.trainRatio) < 1 || Math.floor(c.sampleCount*c.trainRatio) >= c.sampleCount) {
      throw new BadRequestException('Cấu hình bộ sinh dữ liệu không hợp lệ hoặc phiên bản chưa hỗ trợ.');
    }
  }

  async create(dto: CreateExperimentDto, ownerId?: string): Promise<Experiment> {
    this.validateSynthetic(dto.synthetic);
    // 1. Kiểm tra datasetId có hợp lệ và tồn tại không
    let datasetObjectId: Types.ObjectId;
    try {
      if (Types.ObjectId.isValid(dto.datasetId)) {
        datasetObjectId = new Types.ObjectId(dto.datasetId);
      } else {
        const ds = await this.datasetModel.findOne({ clientId: dto.datasetId }).exec();
        if (!ds) {
          throw new BadRequestException(`Không tìm thấy dataset với mã: ${dto.datasetId}`);
        }
        datasetObjectId = ds._id;
      }
    } catch {
      throw new BadRequestException(`datasetId không hợp lệ: ${dto.datasetId}`);
    }

    const dataset = await this.datasetModel.findById(datasetObjectId).exec();
    if (!dataset) {
      throw new BadRequestException(`Không tìm thấy dataset với ID: ${dto.datasetId}`);
    }

    // 2. Validate algorithm
    this.validateAlgorithm(dto.algorithm.type, dto.algorithm.config);

    // 3. Validate feature columns & target column
    if (!dto.targetColumn || !dto.targetColumn.trim()) {
      throw new BadRequestException('targetColumn không được để trống.');
    }
    if (!Array.isArray(dto.featureColumns) || dto.featureColumns.length === 0) {
      throw new BadRequestException('featureColumns phải chứa ít nhất 1 đặc trưng.');
    }

    const clientId = dto.clientId || randomUUID();
    const created = new this.experimentModel(
      Object.assign(
        {},
        dto,
        {
          datasetId: datasetObjectId,
          clientId,
          ownerId: ownerId || dto.ownerId || 'anonymous_user',
          syncVersion: 1,
        },
      ),
    );

    return created.save();
  }

  async findAll(ownerId?: string, page = 1, limit = 20) {
    const filter: Record<string, unknown> = { deletedAt: { $exists: false } };
    if (ownerId && ownerId !== 'anonymous_user') {
      filter.$or = [{ ownerId }, { ownerId: 'anonymous_user' }];
    }

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.experimentModel.find(filter).populate('datasetId').sort({ updatedAt: -1 }).skip(skip).limit(limit).exec(),
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

  async findOne(id: string): Promise<Experiment> {
    const experiment = await this.experimentModel.findOne({
      $or: [{ _id: Types.ObjectId.isValid(id) ? id : undefined }, { clientId: id }],
      deletedAt: { $exists: false },
    }).populate('datasetId').exec();

    if (!experiment) {
      throw new NotFoundException(`Không tìm thấy thí nghiệm với ID: ${id}`);
    }
    return experiment;
  }

  async update(id: string, dto: UpdateExperimentDto): Promise<Experiment> {
    this.validateSynthetic(dto.synthetic);
    const experiment = await this.findOne(id);

    if (dto.algorithm?.type && dto.algorithm?.config) {
      this.validateAlgorithm(dto.algorithm.type, dto.algorithm.config);
    }

    Object.assign(experiment, dto);
    experiment.syncVersion = (experiment.syncVersion || 1) + 1;

    return (experiment as ExperimentDocument).save();
  }

  async remove(id: string): Promise<{ success: boolean; message: string }> {
    const experiment = await this.findOne(id);
    experiment.deletedAt = new Date();
    await (experiment as ExperimentDocument).save();
    return { success: true, message: 'Đã xóa thí nghiệm thành công.' };
  }

  async bulkUpsert(
    experiments: Record<string, unknown>[],
    ownerId?: string,
  ): Promise<{ success: boolean; count: number }> {
    if (!Array.isArray(experiments) || experiments.length === 0) {
      return { success: true, count: 0 };
    }

    const operations = experiments.map((exp) => {
      this.validateSynthetic(exp['synthetic']);
      const clientId = String(exp['id'] || exp['clientId'] || randomUUID());
      const algorithm =
        typeof exp['algorithm'] === 'string'
          ? {
              type: exp['algorithm'],
              version: '1.0.0',
              config: { degree: exp['degree'], lambda: exp['lambda'] },
            }
          : exp['algorithm'];

      return {
        updateOne: {
          filter: { clientId },
          update: {
            $set: {
              ...exp,
              clientId,
              algorithm,
              ownerId: ownerId || exp['ownerId'] || 'anonymous_user',
              syncVersion: Number(exp['syncVersion'] || 1),
            },
          },
          upsert: true,
        },
      };
    });

    const result = await this.experimentModel.bulkWrite(operations);
    return {
      success: true,
      count: (result.upsertedCount || 0) + (result.modifiedCount || 0),
    };
  }
}
