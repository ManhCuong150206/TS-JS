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
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { DatasetsService, UploadedMulterFile } from './datasets.service.js';
import { CurrentUser, RequestUser } from '../common/auth.guard.js';
import { CreateDatasetDto } from './dto/create-dataset.dto.js';

@Controller('datasets')
export class DatasetsController {
  constructor(private readonly datasetsService: DatasetsService) {}

  /**
   * API Tải lên tệp CSV dataset
   * Validate dung lượng, định dạng, cấu trúc và lưu vào thư mục lưu trữ
   */
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: UploadedMulterFile,
    @Body('name') name: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.datasetsService.uploadCsv(file, name, user);
  }

  /**
   * API Tạo dataset từ metadata
   */
  @Post()
  async create(
    @Body() createDatasetDto: CreateDatasetDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.datasetsService.create(createDatasetDto, user);
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
    return this.datasetsService.findAll(user, pageNum, limitNum);
  }

  /**
   * API Lấy chi tiết dataset theo ID
   */
  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.datasetsService.findOne(id, user);
  }

  /**
   * API Tải tệp dữ liệu CSV gốc
   */
  @Get(':id/download')
  async downloadFile(
    @Param('id') id: string,
    @Res() res: Response,
    @CurrentUser() user: RequestUser,
  ) {
    const { filePath, originalFileName } =
      await this.datasetsService.getFilePath(id, user);
    res.download(filePath, originalFileName);
  }

  /**
   * API Xóa dataset
   */
  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.datasetsService.remove(id, user);
  }
}
