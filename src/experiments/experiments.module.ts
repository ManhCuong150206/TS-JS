import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ExperimentsController } from './experiments.controller.js';
import { ExperimentsService } from './experiments.service.js';
import { Counter, CounterSchema } from './schemas/counter.schema.js';
import { Experiment, ExperimentSchema } from './schemas/experiment.schema.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Experiment.name, schema: ExperimentSchema },
      { name: Counter.name, schema: CounterSchema },
    ]),
  ],
  controllers: [ExperimentsController],
  providers: [ExperimentsService],
})
export class ExperimentsModule {}