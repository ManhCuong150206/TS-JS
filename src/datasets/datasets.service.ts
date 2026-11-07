import { RequestUser } from '../common/auth.guard.js';
import { ownerFilter, idFilter, dataFields } from '../common/ownership.js';
import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { Dataset, DatasetDocument } from './schemas/dataset.schema.js';
import { CsvValidator } from '../common/csv-validator.js';
import { CreateDatasetDto } from './dto/create-dataset.dto.js';

export class UploadedMulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Injectable()
export class DatasetsService {
  private readonly storageDir: string;
  private readonly maxFileSize: number;

  constructor(
    @InjectModel(Dataset.name)
    private readonly datasetModel: Model<DatasetDocument>,
  ) {
    this.storageDir = path.resolve(
      process.env.DATASET_STORAGE_DIR || './data/uploads',
    );
    this.maxFileSize = parseInt(
      process.env.MAX_DATASET_FILE_SIZE || '10485760',
      10,
    ); // 10MB
    void this.ensureStorageDirectory();
  }

  private async ensureStorageDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.storageDir, { recursive: true });
    } catch (err) {
      console.error('Error creating storage directory:', err);
    }
  }

  /**
   * Upload CSV file, validate structure, persist to disk, and save metadata to MongoDB.
   */
  async uploadCsv(
    file: UploadedMulterFile | undefined,
    name: string | undefined,
    user: RequestUser,
  ): Promise<Dataset> {
    if (!file) {
      throw new BadRequestException('Vui lòng chọn tệp CSV để tải lên.');
    }

    // 1. Kiểm tra dung lượng tệp
    if (file.size > this.maxFileSize) {
      const maxMb = (this.maxFileSize / (1024 * 1024)).toFixed(1);
      throw new BadRequestException(
        `Dung lượng tệp vượt quá giới hạn tối đa cho phép (${maxMb} MB).`,
      );
    }

    // 2. Kiểm tra định dạng hỗ trợ
    const ext = path.extname(file.originalname).toLowerCase();
    const validMimes = [
      'text/csv',
      'text/plain',
      'application/vnd.ms-excel',
      'application/csv',
    ];
    if (ext !== '.csv' && !validMimes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Định dạng tệp không được hỗ trợ. Hệ thống chỉ chấp nhận tệp có định dạng .csv.',
      );
    }

    // 3. Phân tích và kiểm tra tính hợp lệ của CSV
    const validation = CsvValidator.validate(file.buffer);
    if (!validation.isValid) {
      throw new BadRequestException({
        message: 'Tệp CSV không hợp lệ hoặc chứa lỗi cấu trúc.',
        details: validation.errors,
      });
    }

    // 4. Lưu tệp vào ổ đĩa (Storage)
    await this.ensureStorageDirectory();
    const storageKey = `${randomUUID()}.csv`;
    const destinationPath = path.join(this.storageDir, storageKey);
    await fs.writeFile(destinationPath, file.buffer);

    // 5. Lưu thông tin metadata vào MongoDB
    const datasetName =
      name && name.trim().length > 0
        ? name.trim()
        : file.originalname.replace(/\.[^/.]+$/, '');
    const clientId = randomUUID();

    const createdDataset = new this.datasetModel({
      clientId,
      name: datasetName,
      sourceType: 'upload',
      originalFileName: file.originalname,
      contentType: file.mimetype || 'text/csv',
      sizeBytes: file.size,
      rowCount: validation.rowCount,
      columns: validation.columns,
      previewRows: validation.previewRows,
      storage: {
        provider: 'local-volume',
        key: storageKey,
        format: 'csv',
        sha256: validation.sha256,
        filePath: destinationPath,
      },
      status: 'ready',
      ownerId: user.userId,
      syncVersion: 1,
    });

    return createdDataset.save();
  }

  /**
   * Tạo dataset từ metadata (dành cho dữ liệu sinh tự động hoặc mẫu có sẵn)
   */
  async create(dto: CreateDatasetDto, user: RequestUser): Promise<Dataset> {
    const clientId = dto.clientId || randomUUID();
    const createdDataset = new this.datasetModel(
      Object.assign({}, dataFields(dto, 'dataset'), {
        clientId,
        ownerId: user.userId,
        status: 'ready',
        syncVersion: 1,
      }),
    );
    return createdDataset.save();
  }

  /**
   * Danh sách dataset có lọc theo ownerId và phân trang
   */
  async findAll(user: RequestUser, page = 1, limit = 20) {
    const filter = { deletedAt: { $exists: false }, ...ownerFilter(user) };

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.datasetModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.datasetModel.countDocuments(filter).exec(),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Lấy chi tiết dataset theo MongoDB _id hoặc clientId
   */
  async findOne(id: string, user: RequestUser): Promise<Dataset> {
    const dataset = await this.datasetModel
      .findOne({
        ...idFilter(id),
        ...ownerFilter(user),
        deletedAt: { $exists: false },
      })
      .exec();

    if (!dataset) {
      throw new NotFoundException(`Không tìm thấy dataset với ID: ${id}`);
    }
    return dataset;
  }

  /**
   * Lấy đường dẫn tệp để tải về hoặc đọc nội dung
   */
  async getFilePath(
    id: string,
    user: RequestUser,
  ): Promise<{ filePath: string; originalFileName: string }> {
    const dataset = await this.findOne(id, user);
    if (!dataset.storage?.key) {
      throw new NotFoundException(
        'Dataset này không lưu trữ tệp trên máy chủ.',
      );
    }

    if(!/^[a-f0-9-]{36}\.csv$/i.test(dataset.storage.key))throw new NotFoundException('Khóa tệp không hợp lệ.');
    const filePath = path.resolve(this.storageDir, dataset.storage.key);
    if(!filePath.startsWith(this.storageDir+path.sep))throw new NotFoundException('Đường dẫn không hợp lệ.');
    try {
      await fs.access(filePath);
    } catch {
      throw new NotFoundException(
        'Tệp dữ liệu không còn tồn tại trên máy chủ.',
      );
    }

    return {
      filePath,
      originalFileName: dataset.originalFileName || `${dataset.name}.csv`,
    };
  }

  /**
   * Xóa mềm dataset
   */
  async remove(
    id: string,
    user: RequestUser,
  ): Promise<{ success: boolean; message: string }> {
    const dataset = await this.findOne(id, user);
    dataset.deletedAt = new Date();
    await (dataset as DatasetDocument).save();
    return { success: true, message: 'Đã xóa dataset thành công.' };
  }
}
