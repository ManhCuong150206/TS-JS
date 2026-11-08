import { RequestUser } from '../common/auth.guard.js';
import { ownerFilter, idFilter, dataFields } from '../common/ownership.js';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomUUID } from 'node:crypto';
import {
  TrainingRun,
  TrainingRunDocument,
} from './schemas/training-run.schema.js';
import { CreateTrainingRunDto } from './dto/create-training-run.dto.js';
import {
  Experiment,
  ExperimentDocument,
} from '../experiments/schemas/experiment.schema.js';

@Injectable()
export class TrainingRunsService {
  constructor(
    @InjectModel(TrainingRun.name)
    private readonly trainingRunModel: Model<TrainingRunDocument>,
    @InjectModel(Experiment.name)
    private readonly experimentModel: Model<ExperimentDocument>,
  ) {}

  async create(
    dto: CreateTrainingRunDto,
    user: RequestUser,
  ): Promise<TrainingRun> {
    const experiment = await this.experimentModel.findOne({
      ...idFilter(dto.experimentId),
      ...ownerFilter(user),
      deletedAt: { $exists: false },
    });
    if (!experiment) throw new NotFoundException('Không tìm thấy thí nghiệm');
    const experimentObjectId = experiment._id;

    const clientId = dto.clientId || randomUUID();
    const createdRun = new this.trainingRunModel(
      Object.assign({}, dataFields(dto, 'trainingRun'), {
        experimentId: experimentObjectId,
        clientId,
        algorithmVersion: dto.algorithmVersion || '1.0.0',
        ownerId: user.userId,
        syncVersion: 1,
      }),
    );

    return createdRun.save();
  }

  async findAll(
    experimentId: string | undefined,
    user: RequestUser,
    page = 1,
    limit = 20,
  ) {
    const filter: Record<string, unknown> = {
      deletedAt: { $exists: false },
      ...ownerFilter(user),
    };
    if (experimentId) {
      const experiment = await this.experimentModel.findOne({
        ...idFilter(experimentId),
        ...ownerFilter(user),
        deletedAt: { $exists: false },
      });
      if (!experiment) throw new NotFoundException('Không tìm thấy thí nghiệm');
      filter.experimentId = experiment._id;
    }

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.trainingRunModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
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

  async findOne(id: string, user: RequestUser): Promise<TrainingRun> {
    const run = await this.trainingRunModel
      .findOne({
        ...idFilter(id),
        ...ownerFilter(user),
        deletedAt: { $exists: false },
      })
      .populate({
        path: 'experimentId',
        match: { ...ownerFilter(user), deletedAt: { $exists: false } },
      })
      .exec();

    if (!run) {
      throw new NotFoundException(
        `Không tìm thấy phiên huấn luyện với ID: ${id}`,
      );
    }
    return run;
  }
}
