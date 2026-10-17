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
    @CurrentUser() user: RequestUser,
  ) {
    return this.experimentsService.create(dto, user.userId);
  }

  @Get()
  async findAll(
    @CurrentUser() user: RequestUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return this.experimentsService.findAll(user.userId, pageNum, limitNum);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.experimentsService.findOne(id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateExperimentDto,
  ) {
    return this.experimentsService.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.experimentsService.remove(id);
  }
}
