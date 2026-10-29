import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  Query,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { DatasetsService, UploadedMulterFile } from './datasets.service.js';
import { OptionalAuthGuard, CurrentUser, RequestUser } from '../common/auth.guard.js';
import { CreateDatasetDto } from './dto/create-dataset.dto.js';

@Controller('datasets')
@UseGuards(OptionalAuthGuard)
export class DatasetsController {
  constructor(private readonly datasetsService: DatasetsService) {}

  /**
   * API Tải lên tệp CSV dataset
   * Validate dung lượng, định dạng, cấu trúc và lưu vào thư mục lưu trữ
   */
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: Number(process.env.MAX_DATASET_FILE_SIZE || 10 * 1024 * 1024),
        files: 1,
      },
    }),
  )
  async uploadFile(
    @UploadedFile() file: UploadedMulterFile,
    @Body('name') name: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.datasetsService.uploadCsv(file, name, user.userId);
  }

  /**
   * API Tạo dataset từ metadata
   */
  @Post()
  async create(
    @Body() createDatasetDto: CreateDatasetDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.datasetsService.create(createDatasetDto, user.userId);
  }

  /**
   * API Lấy danh sách dataset có phân trang
   */
  @Get()
  async findAll(
    @CurrentUser() user: RequestUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return this.datasetsService.findAll(user.userId, pageNum, limitNum);
  }

  /**
   * API Lấy chi tiết dataset theo ID
   */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.datasetsService.findOne(id);
  }

  /**
   * API Tải tệp dữ liệu CSV gốc
   */
  @Get(':id/download')
  async downloadFile(
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const { filePath, originalFileName } = await this.datasetsService.getFilePath(id);
    res.download(filePath, originalFileName);
  }

  /**
   * API Xóa dataset
   */
  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.datasetsService.remove(id);
  }
}
