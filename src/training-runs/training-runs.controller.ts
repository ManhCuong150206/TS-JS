import { Controller, Post, Get, Param, Body, Query } from '@nestjs/common';
import { TrainingRunsService } from './training-runs.service.js';
import { pagination } from '../common/pagination.js';
import { CurrentUser, RequestUser } from '../common/auth.guard.js';
import { CreateTrainingRunDto } from './dto/create-training-run.dto.js';

@Controller('training-runs')
export class TrainingRunsController {
  constructor(private readonly trainingRunsService: TrainingRunsService) { }

  @Post()
  async create(
    @Body() dto: CreateTrainingRunDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.trainingRunsService.create(dto, user);
  }

  @Get()
  async findAll(
    @CurrentUser() user: RequestUser,
    @Query('experimentId') experimentId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const { page: pageNum, limit: limitNum } = pagination(page, limit);
    return this.trainingRunsService.findAll(
      experimentId,
      user,
      pageNum,
      limitNum,
    );
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.trainingRunsService.findOne(id, user);
  }
}
