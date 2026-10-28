import {
  Body,
  Controller,
  Delete,
  Get,
  Put,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiExtraModels,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { LinearConfigDto, PolynomialConfigDto, RegularizedConfigDto } from './dto/algorithm.dto.js';
import { CreateExperimentDto } from './dto/create-experiment.dto.js';
import { DuplicateExperimentDto } from './dto/duplicate-experiment.dto.js';
import { QueryExperimentsDto } from './dto/query-experiments.dto.js';
import { UpdateExperimentDto } from './dto/update-experiment.dto.js';
import { ReplaceExperimentDto } from './dto/replace-experiment.dto.js';
import {
  ExperimentResponse,
  ExperimentsService,
  PaginatedExperiments,
} from './experiments.service.js';

@ApiTags('experiments')
@ApiExtraModels(LinearConfigDto, PolynomialConfigDto, RegularizedConfigDto)
@Controller('experiments')
export class ExperimentsController {
  constructor(private readonly service: ExperimentsService) {}

  @Post()
  @ApiOperation({ summary: 'Tạo experiment (ID tự tăng, không cần truyền ID)' })
  create(@Body() dto: CreateExperimentDto): Promise<ExperimentResponse> {
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Danh sách: phân trang, lọc algorithm/status, sort updatedAt' })
  findAll(@Query() query: QueryExperimentsDto): Promise<PaginatedExperiments> {
    return this.service.findAll(query);
  }

  @Get(':id')
  @ApiNotFoundResponse({ description: 'Không tìm thấy' })
  findOne(@Param('id', ParseIntPipe) id: number): Promise<ExperimentResponse> {
    return this.service.findOne(id);
  }
  /** PUT /experiments/:id: thay thế toàn bộ, bắt buộc gửi "version" */
  @Put(':id')
  replace(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReplaceExperimentDto,
  ): Promise<ExperimentResponse> {
    return this.service.replace(id, dto);
  }
  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật (bắt buộc gửi `version` = syncVersion hiện tại)' })
  @ApiNotFoundResponse({ description: 'Không tìm thấy' })
  @ApiConflictResponse({ description: 'Version lệch: bản Version không đúng vui lòng tải lại dữ liệu' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateExperimentDto,
  ): Promise<ExperimentResponse> {
    return this.service.update(id, dto);
  }

  @Post(':id/duplicate')
  @ApiOperation({ summary: 'Nhân bản experiment (ID mới, status = draft)' })
  @ApiNotFoundResponse({ description: 'Không tìm thấy' })
  duplicate(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DuplicateExperimentDto,
  ): Promise<ExperimentResponse> {
    return this.service.duplicate(id, dto);
  }

  @Delete(':id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Xóa hẳn khỏi MongoDB' })
  @ApiNotFoundResponse({ description: 'Không tìm thấy' })
  remove(@Param('id', ParseIntPipe) id: number): Promise<{ id: number; deleted: true }> {
    return this.service.remove(id);
  }
}