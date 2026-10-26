import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SyncController } from './sync.controller.js';
import { SyncService } from './sync.service.js';
import { SyncOperation, SyncOperationSchema } from './schemas/sync-operation.schema.js';
import { ExperimentsModule } from '../experiments/experiments.module.js';
import { DatasetsModule } from '../datasets/datasets.module.js';
import { TrainingRunsModule } from '../training-runs/training-runs.module.js';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: SyncOperation.name, schema: SyncOperationSchema }]),
    ExperimentsModule,
    DatasetsModule,
    TrainingRunsModule,
  ],
  controllers: [SyncController],
  providers: [SyncService],
  exports: [SyncService],
})
export class SyncModule {}
