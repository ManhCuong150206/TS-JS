import { AuthModule } from './auth/auth.module.js';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { DatasetsModule } from './datasets/datasets.module.js';
import { ExperimentsModule } from './experiments/experiments.module.js';
import { TrainingRunsModule } from './training-runs/training-runs.module.js';
import { SyncModule } from './sync/sync.module.js';

@Module({
  controllers: [AppController],
  providers: [AppService],
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('MONGODB_URI') || config.get<string>('connection_string'),
        dbName: config.get<string>('MONGODB_DB_NAME'),
      }),
    }),
    AuthModule,
    DatasetsModule,
    ExperimentsModule,
    TrainingRunsModule,
    SyncModule,
  ],
})
export class AppModule {}