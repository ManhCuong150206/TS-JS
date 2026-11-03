import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomUUID } from 'node:crypto';
import { TrainingRun, TrainingRunDocument } from './schemas/training-run.schema.js';
import { CreateTrainingRunDto } from './dto/create-training-run.dto.js';
import { Experiment, ExperimentDocument } from '../experiments/schemas/experiment.schema.js';

@Injectable()
export class TrainingRunsService {
  constructor(
    @InjectModel(TrainingRun.name) private readonly trainingRunModel: Model<TrainingRunDocument>,
    @InjectModel(Experiment.name) private readonly experimentModel: Model<ExperimentDocument>,
  ) {}

  async create(dto: CreateTrainingRunDto, ownerId?: string): Promise<TrainingRun> {
    let experimentObjectId: Types.ObjectId;
    try {
      if (Types.ObjectId.isValid(dto.experimentId)) {
        experimentObjectId = new Types.ObjectId(dto.experimentId);
      } else {
        const exp = await this.experimentModel.findOne({ clientId: dto.experimentId }).exec();
        if (!exp) {
          throw new BadRequestException(`Không tìm thấy experiment với mã: ${dto.experimentId}`);
        }
        experimentObjectId = exp._id;
      }
    } catch {
      throw new BadRequestException(`experimentId không hợp lệ: ${dto.experimentId}`);
    }

    const experiment = await this.experimentModel.findOne({_id:experimentObjectId,ownerId:ownerId||'anonymous_user'}).exec();
    if (!experiment) {
      throw new BadRequestException(`Không tìm thấy thí nghiệm với ID: ${dto.experimentId}`);
    }

    const clientId = dto.clientId || randomUUID();
    const createdRun = new this.trainingRunModel(
      Object.assign(
        {},
        dto,
        {
          experimentId: experimentObjectId,
          clientId,
          algorithmVersion: dto.algorithmVersion || '1.0.0',
          ownerId: ownerId || dto.ownerId || 'anonymous_user',
          syncVersion: 1,
        },
      ),
    );

    return createdRun.save();
  }

  async findAll(experimentId?: string, ownerId?: string, page = 1, limit = 20) {
    const filter: Record<string, unknown> = {};
    if (experimentId) {
      if (Types.ObjectId.isValid(experimentId)) {
        filter.experimentId = new Types.ObjectId(experimentId);
      }
    }
    filter.ownerId=ownerId||'anonymous_user';
    page=Number.isFinite(page)?Math.max(1,Math.floor(page)):1;limit=Number.isFinite(limit)?Math.min(100,Math.max(1,Math.floor(limit))):20;

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.trainingRunModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      this.trainingRunModel.countDocuments(filter).exec(),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string, ownerId = 'anonymous_user'): Promise<TrainingRun> {
    const run = await this.trainingRunModel.findOne({
      ownerId,
      $or: [{ _id: Types.ObjectId.isValid(id) ? id : undefined }, { clientId: id }],
    }).populate({path:'experimentId',match:{ownerId}}).exec();

    if (!run) {
      throw new NotFoundException(`Không tìm thấy phiên huấn luyện với ID: ${id}`);
    }
    return run;
  }
}
