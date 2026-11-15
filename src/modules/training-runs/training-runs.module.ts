import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TrainingRunsController } from './training-runs.controller.js';
import { TrainingRunsService } from './training-runs.service.js';
import { TrainingRun, TrainingRunSchema } from './schemas/training-run.schema.js';
import { ExperimentsModule } from '../experiments/experiments.module.js';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: TrainingRun.name, schema: TrainingRunSchema }]),
    ExperimentsModule,
  ],
  controllers: [TrainingRunsController],
  providers: [TrainingRunsService],
  exports: [TrainingRunsService, MongooseModule],
})
export class TrainingRunsModule {}
