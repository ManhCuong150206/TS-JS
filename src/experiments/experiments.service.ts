import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomUUID } from 'crypto';
import { Model, QueryFilter } from 'mongoose';
import { CreateExperimentDto, SplitConfigDto } from './dto/create-experiment.dto.js';
import { DuplicateExperimentDto } from './dto/duplicate-experiment.dto.js';
import { QueryExperimentsDto } from './dto/query-experiments.dto.js';
import { UpdateExperimentDto } from './dto/update-experiment.dto.js';
import { ReplaceExperimentDto } from './dto/replace-experiment.dto.js';
import { ExperimentStatus, SplitMethod, SyncStatus } from './experiment.enums.js';
import { Counter } from './schemas/counter.schema.js';
import { Experiment, SplitConfigEmbedded } from './schemas/experiment.schema.js';

export type ExperimentResponse = Omit<Experiment, '_id'> & { id: number };

export interface PaginatedExperiments {
  items: ExperimentResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const COUNTER_KEY = 'experiments';

/** Đổi _id thành id cho response */
function toResponse(e: Experiment): ExperimentResponse {
  const { _id, ...rest } = e;
  return { id: _id, ...rest };
}

@Injectable()
export class ExperimentsService {
  constructor(
    @InjectModel(Experiment.name) private readonly model: Model<Experiment>,
    @InjectModel(Counter.name) private readonly counterModel: Model<Counter>,
  ) {}

  // ---------- hàm phụ ----------

  /** Lấy ID kế tiếp bằng $inc nguyên tử: không trùng, không dùng lại ID đã xóa */
  private async nextId(): Promise<number> {
    const counter = await this.counterModel
      .findOneAndUpdate(
        { _id: COUNTER_KEY },
        { $inc: { seq: 1 } },
        { returnDocument: 'after', upsert: true },
      )
      .lean<Counter>();
    if (!counter) throw new Error('Không thể sinh ID tự tăng');
    return counter.seq;
  }

  private assertSplit(split: SplitConfigDto): void {
    const sum = split.trainRatio + split.validationRatio + split.testRatio;
    if (Math.abs(sum - 1) > 0.001) {
      throw new BadRequestException('trainRatio + validationRatio + testRatio phải bằng 1');
    }
  }
  private async updateWithVersion(
    id: number,
    version: number,
    $set: Record<string, unknown>,
  ): Promise<ExperimentResponse> {
    const updated = await this.model
      .findOneAndUpdate(
        { _id: id, syncVersion: version },
        { $set, $inc: { syncVersion: 1 } },
        { returnDocument: 'after' },
      )
      .lean<Experiment>();
    if (updated) return toResponse(updated);

    const current = await this.getOrThrow(id); // không tồn tại thì 404
    throw new ConflictException({
      message: 'Bản ghi đã được sửa ở phiên bản khác, hãy tải lại dữ liệu',
      yourVersion: version,
      currentVersion: current.syncVersion,
    });
  }
  /** Không gửi method thì mặc định là random */
  private normalizeSplit(split: SplitConfigDto): SplitConfigEmbedded {
    return { ...split, method: split.method ?? SplitMethod.RANDOM };
  }

  private async getOrThrow(id: number): Promise<Experiment> {
    const doc = await this.model.findById(id).lean<Experiment>();
    if (!doc) throw new NotFoundException(`Không tìm thấy experiment ${id}`);
    return doc;
  }

  // ---------- nghiệp vụ ----------

  // POST
  async create(dto: CreateExperimentDto): Promise<ExperimentResponse> {
    this.assertSplit(dto.splitConfig);

    // Kiểm tra clientId trước khi cấp ID để không bị hụt số
    if (dto.clientId && (await this.model.exists({ clientId: dto.clientId }))) {
      throw new ConflictException(`clientId "${dto.clientId}" đã tồn tại`);
    }

    const _id = await this.nextId();
    try {
      const doc = await this.model.create({
        _id,
        clientId: dto.clientId ?? randomUUID(),
        name: dto.name,
        description: dto.description ?? '',
        status: dto.status ?? ExperimentStatus.DRAFT,
        syncStatus: dto.syncStatus ?? SyncStatus.SYNCED,
        algorithm: dto.algorithm,
        datasetRef: dto.datasetRef ?? null,
        preprocessing: dto.preprocessing ?? { steps: [] },
        splitConfig: this.normalizeSplit(dto.splitConfig),
        seed: dto.seed,
        syncVersion: 1,
      });
      return toResponse(doc.toObject<Experiment>());
    } catch (err) {
      // Phòng trường hợp 2 request cùng clientId gửi cùng lúc
      if ((err as { code?: number }).code === 11000) {
        throw new ConflictException(`clientId "${dto.clientId}" đã tồn tại`);
      }
      throw err;
    }
  }

  // GET danh sách
  async findAll(query: QueryExperimentsDto): Promise<PaginatedExperiments> {
    const filter: QueryFilter<Experiment> = {};
    if (query.algorithm) filter['algorithm.type'] = query.algorithm;
    if (query.status) filter.status = query.status;
    if (query.search) {
      const escaped = query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.name = { $regex: escaped, $options: 'i' };
    }

    const [docs, total] = await Promise.all([
      this.model
        .find(filter)
        .sort({ updatedAt: query.sortOrder === 'asc' ? 1 : -1, _id: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean<Experiment[]>(),
      this.model.countDocuments(filter),
    ]);

    return {
      items: docs.map(toResponse),
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  // GET chi tiết
  async findOne(id: number): Promise<ExperimentResponse> {
    return toResponse(await this.getOrThrow(id));
  }

    // PATCH: sửa một phần
  async update(id: number, dto: UpdateExperimentDto): Promise<ExperimentResponse> {
    const { version, ...changes } = dto;

    const data: Record<string, unknown> = { ...changes };
    if (changes.splitConfig) {
      this.assertSplit(changes.splitConfig);
      data.splitConfig = this.normalizeSplit(changes.splitConfig);
    }

    // Bỏ field client không gửi (giữ null để cho phép gỡ datasetRef)
    const $set = Object.fromEntries(
      Object.entries(data).filter(([, value]) => value !== undefined),
    );

    return this.updateWithVersion(id, version, $set);
  }
  // PUT: thay thế toàn bộ. Field không gửi sẽ về giá trị mặc định
  async replace(id: number, dto: ReplaceExperimentDto): Promise<ExperimentResponse> {
    const { version, ...body } = dto;
    this.assertSplit(body.splitConfig);

    return this.updateWithVersion(id, version, {
      name: body.name,
      description: body.description ?? '',
      status: body.status ?? ExperimentStatus.DRAFT,
      syncStatus: body.syncStatus ?? SyncStatus.SYNCED,
      algorithm: body.algorithm,
      datasetRef: body.datasetRef ?? null,
      preprocessing: body.preprocessing ?? { steps: [] },
      splitConfig: this.normalizeSplit(body.splitConfig),
      seed: body.seed,
    });
  }
  // POST nhân bản
  async duplicate(id: number, dto: DuplicateExperimentDto): Promise<ExperimentResponse> {
    const src = await this.getOrThrow(id);
    return this.create({
      name: dto.name ?? `${src.name} (copy)`.slice(0, 120),
      description: src.description,
      status: ExperimentStatus.DRAFT, // bản sao luôn là bản nháp
      syncStatus: SyncStatus.SYNCED,
      algorithm: src.algorithm,
      datasetRef: src.datasetRef,
      preprocessing: src.preprocessing,
      splitConfig: src.splitConfig,
      seed: src.seed,
    });
  }

  // DELETE: xóa hẳn khỏi MongoDB
  async remove(id: number): Promise<{ id: number; deleted: true }> {
    const result = await this.model.deleteOne({ _id: id });
    if (result.deletedCount === 0) {
      throw new NotFoundException(`Không tìm thấy experiment ${id}`);
    }
    return { id, deleted: true };
  }
}