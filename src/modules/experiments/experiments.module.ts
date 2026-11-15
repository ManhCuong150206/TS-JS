import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ExperimentsController } from './experiments.controller.js';
import { ExperimentsService } from './experiments.service.js';
import { Experiment, ExperimentSchema } from './schemas/experiment.schema.js';
import { DatasetsModule } from '../datasets/datasets.module.js';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Experiment.name, schema: ExperimentSchema }]),
    DatasetsModule,
  ],
  controllers: [ExperimentsController],
  providers: [ExperimentsService],
  exports: [ExperimentsService, MongooseModule],
})
export class ExperimentsModule {}
