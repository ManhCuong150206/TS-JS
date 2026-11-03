import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TrainingRunsService } from './training-runs.service.js';
import { OptionalAuthGuard, CurrentUser, RequestUser } from '../common/auth.guard.js';
import { CreateTrainingRunDto } from './dto/create-training-run.dto.js';

@Controller('training-runs')
@UseGuards(OptionalAuthGuard)
export class TrainingRunsController {
  constructor(private readonly trainingRunsService: TrainingRunsService) {}

  @Post()
  async create(
    @Body() dto: CreateTrainingRunDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.trainingRunsService.create(dto, user.userId);
  }

  @Get()
  async findAll(
    @CurrentUser() user: RequestUser,
    @Query('experimentId') experimentId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return this.trainingRunsService.findAll(experimentId, user.userId, pageNum, limitNum);
  }

  @Get(':id')
  async findOne(@Param('id') id: string,@CurrentUser() user:RequestUser) {
    return this.trainingRunsService.findOne(id,user.userId);
  }
}
