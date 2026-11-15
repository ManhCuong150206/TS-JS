import { Module } from '@nestjs/common';
import { DatasetsModule } from '../datasets/datasets.module.js';
import { ExperimentsModule } from '../experiments/experiments.module.js';
import { TrainingRunsModule } from '../training-runs/training-runs.module.js';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

@Module({
  imports: [DatasetsModule, ExperimentsModule, TrainingRunsModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
