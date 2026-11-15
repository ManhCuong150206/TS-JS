import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { DatasetsModule } from './modules/datasets/datasets.module.js';
import { ExperimentsModule } from './modules/experiments/experiments.module.js';
import {
  TrainingRunsModule,
} from './modules/training-runs/training-runs.module.js';
import { SyncModule } from './modules/sync/sync.module.js';
import { LoginModule } from './modules/login/login.module.js';
import { mongoUri } from './config/database.config.js';
import { UsersModule } from './modules/users/users.module.js';

@Module({
  controllers: [AppController],
  providers: [AppService],
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: process.env.NODE_ENV === 'test',
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: mongoUri(config),
      }),
    }),
    DatasetsModule,
    ExperimentsModule,
    TrainingRunsModule,
    SyncModule,
    LoginModule,
    UsersModule,
  ],
})
export class AppModule {}
