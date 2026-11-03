import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ExperimentsService } from './experiments.service.js';
import { OptionalAuthGuard, CurrentUser, RequestUser } from '../common/auth.guard.js';
import { CreateExperimentDto, UpdateExperimentDto } from './dto/create-experiment.dto.js';

@Controller('experiments')
@UseGuards(OptionalAuthGuard)
export class ExperimentsController {
  constructor(private readonly experimentsService: ExperimentsService) {}

  @Post()
  async create(
    @Body() dto: CreateExperimentDto,
    @CurrentUser() user?: RequestUser,
  ) {
    return this.experimentsService.create(dto, user?.userId || 'anonymous_user');
  }

  @Post('bulk')
  async bulkUpsert(
    @Body() experiments: Record<string, unknown>[],
    @CurrentUser() user?: RequestUser,
  ) {
    return this.experimentsService.bulkUpsert(experiments, user?.userId || 'anonymous_user');
  }

  @Get()
  async findAll(
    @CurrentUser() user?: RequestUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('includeDeleted') includeDeleted?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return this.experimentsService.findAll(user?.userId || 'anonymous_user', pageNum, limitNum, includeDeleted === 'true');
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user?:RequestUser) {
    return this.experimentsService.findOne(id,user?.userId);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateExperimentDto,
    @CurrentUser() user?:RequestUser,
  ) {
    return this.experimentsService.update(id, dto,user?.userId);
  }

  @Delete(':id')
  async remove(@Param('id') id: string,@CurrentUser() user?:RequestUser) {
    return this.experimentsService.remove(id,user?.userId);
  }
}
