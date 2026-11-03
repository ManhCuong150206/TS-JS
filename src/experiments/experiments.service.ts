import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { snapshotFields } from './saved-snapshot.js';
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
        if (typeof lambda !== 'number' || !Number.isFinite(lambda) || lambda < 0) {
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

    const dataset = await this.datasetModel.findOne({_id:datasetObjectId,ownerId:ownerId||'anonymous_user'}).exec();
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

  async findAll(ownerId?: string, page = 1, limit = 20, includeDeleted = false) {
    const filter: Record<string,unknown>={ownerId:ownerId||'anonymous_user',...(includeDeleted?{}:{deletedAt:{$exists:false}})};
    page=Number.isFinite(page)?Math.max(1,Math.floor(page)):1;limit=Number.isFinite(limit)?Math.min(100,Math.max(1,Math.floor(limit))):20;

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.experimentModel.find(filter).populate({path:'datasetId',match:{ownerId:ownerId||'anonymous_user'}}).sort({ updatedAt: -1 }).skip(skip).limit(limit).exec(),
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

  async findOne(id: string, ownerId = 'anonymous_user'): Promise<Experiment> {
    const experiment = await this.experimentModel.findOne({
      $or: [{ _id: Types.ObjectId.isValid(id) ? id : undefined }, { clientId: id }],
      ownerId, deletedAt: { $exists: false },
    }).populate({path:'datasetId',match:{ownerId:ownerId||'anonymous_user'}}).exec();

    if (!experiment) {
      throw new NotFoundException(`Không tìm thấy thí nghiệm với ID: ${id}`);
    }
    return experiment;
  }

  async update(id: string, dto: UpdateExperimentDto, ownerId = 'anonymous_user'): Promise<Experiment> {
    this.validateSynthetic(dto.synthetic);
    const experiment = await this.findOne(id, ownerId);

    if (dto.algorithm?.type && dto.algorithm?.config) {
      this.validateAlgorithm(dto.algorithm.type, dto.algorithm.config);
    }

    for(const key of ['name','description','status','algorithm','targetColumn','featureColumns','preprocessing','split','synthetic'] as const)if(dto[key]!==undefined)Object.assign(experiment,{[key]:dto[key]});
    experiment.syncVersion = (experiment.syncVersion || 1) + 1;

    return (experiment as ExperimentDocument).save();
  }

  async remove(id: string, ownerId = 'anonymous_user'): Promise<{ success: boolean; message: string }> {
    const experiment = await this.findOne(id, ownerId);
    experiment.deletedAt = new Date();
    experiment.syncVersion = (experiment.syncVersion || 1) + 1;
    await (experiment as ExperimentDocument).save();
    return { success: true, message: 'Đã xóa thí nghiệm thành công.' };
  }

  async bulkUpsert(
    experiments: Record<string, unknown>[],
    ownerId?: string,
  ): Promise<{ success: boolean; count: number; items?: {id:string;syncVersion:number;mutationId:string;deletedAt?:number}[] }> {
    if (!Array.isArray(experiments) || experiments.length === 0) {
      return { success: true, count: 0 };
    }

    if(experiments.length>100)throw new BadRequestException('Mỗi lô tối đa 100 thí nghiệm.');
    const items:{id:string;syncVersion:number;mutationId:string;deletedAt?:number}[]=[];
    const owner=ownerId||'anonymous_user';
    for(const exp of experiments){
      this.validateSynthetic(exp.synthetic);
      const clientId=String(exp.id||exp.clientId||randomUUID());
      if(clientId.length>120)throw new BadRequestException('ID quá dài.');
      const mutationId=typeof exp.mutationId==='string'?exp.mutationId:clientId;
      let existing=await this.experimentModel.findOne({clientId}).exec();
      if(existing&&existing.ownerId!==owner)throw new ConflictException({message:'ID thí nghiệm đã được sử dụng. Hãy giữ bản cục bộ thành bản sao.',id:clientId});
      if(existing?.lastMutationId===mutationId){items.push({id:clientId,syncVersion:existing.syncVersion,mutationId,deletedAt:existing.deletedAt?.getTime()});continue;}
      const version=typeof exp.serverVersion==='number'?exp.serverVersion:0;
      if(existing&&(existing.syncVersion!==version||!!existing.deletedAt&&!exp.deletedAt))throw new ConflictException({message:'Thí nghiệm có phiên bản mới hơn trên máy chủ.',id:clientId,serverVersion:existing.syncVersion});
      let values:Record<string,unknown>;
      if(exp.deletedAt){values={deletedAt:new Date(),lastMutationId:mutationId,...(!existing?{name:'Đã xóa',algorithm:{type:'linear',config:{solver:'gradient-descent'}}}:{})};}
      else{
        values=snapshotFields(exp);
        const algorithm=typeof exp.algorithm==='string'?{type:exp.algorithm,version:'1.0.0',config:exp.algorithm==='linear'?{solver:'gradient-descent'}:{degree:exp.degree,lambda:exp.lambda}}:exp.algorithm;
        if(!algorithm||typeof algorithm!=='object')throw new BadRequestException('Thiếu thuật toán.');
        const info=algorithm as {type:AlgorithmType;config:Record<string,unknown>};this.validateAlgorithm(info.type,info.config);
        if(Array.isArray(values.w)){
          const dimension=Number(values.featureCount);let expected=dimension;
          if(info.type==='polynomial'){const degree=Number(info.config.degree);expected=1;for(let i=1;i<=degree;i++)expected=expected*(dimension+i)/i;expected=Math.round(expected)-1;}
          if(values.w.length!==expected)throw new BadRequestException('Số trọng số không khớp đặc trưng/thuật toán.');
        }
        values={...values,algorithm:{...algorithm,config:info.type==='linear'?{solver:'gradient-descent',...info.config}:info.config},clientCreatedAt:typeof exp.createdAt==='number'?exp.createdAt:Date.now(),lastMutationId:mutationId};
      }
      const filter=existing?{clientId,ownerId:owner,syncVersion:version}:{clientId,ownerId:owner,syncVersion:{$exists:false}};
      try{
        const updated=await this.experimentModel.findOneAndUpdate(filter,{$set:{...values,ownerId:owner,clientId},$inc:{syncVersion:1}},{upsert:!existing,returnDocument:'after',runValidators:true,setDefaultsOnInsert:false}).exec();
        if(!updated)throw new ConflictException('Thí nghiệm vừa được cập nhật trên thiết bị khác.');
        items.push({id:clientId,syncVersion:updated.syncVersion,mutationId,deletedAt:updated.deletedAt?.getTime()});
      }catch(error){if((error as {code?:number}).code===11000)throw new ConflictException('Thí nghiệm vừa được đồng bộ ở nơi khác.');throw error;}
    }
    return {success:true,count:items.length,items};
  }
}
