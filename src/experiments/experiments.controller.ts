import {
  Controller,
  HttpCode,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { ExperimentsService } from './experiments.service.js';
import { pagination } from '../common/pagination.js';
import { CurrentUser, RequestUser } from '../common/auth.guard.js';
import {
  CreateExperimentDto,
  UpdateExperimentDto,
} from './dto/create-experiment.dto.js';

@Controller('experiments')
export class ExperimentsController {
  constructor(private readonly experimentsService: ExperimentsService) {}

  @Post()
  async create(
    @Body() dto: CreateExperimentDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.experimentsService.create(dto, user);
  }

  @Post('bulk')
  @HttpCode(200)
  async bulkUpsert(
    @Body() experiments: unknown,
    @CurrentUser() user: RequestUser,
  ) {
    return this.experimentsService.bulkUpsert(experiments, user);
  }

  @Get()
  async findAll(
    @CurrentUser() user: RequestUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const { page: pageNum, limit: limitNum } = pagination(page, limit);
    return this.experimentsService.findAll(user, pageNum, limitNum);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.experimentsService.findOne(id, user);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateExperimentDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.experimentsService.update(id, dto, user);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.experimentsService.remove(id, user);
  }
}
