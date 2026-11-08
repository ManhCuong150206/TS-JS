import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DatasetsController } from './datasets.controller.js';
import { DatasetsService } from './datasets.service.js';
import { Dataset, DatasetSchema } from './schemas/dataset.schema.js';
import { ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { datasetUploadOptions } from './upload.config.js';

@Module({
  imports: [
    // Đọc config sau khi .env đã được nạp, không đọc tại lúc import controller.
    MulterModule.registerAsync({
      inject: [ConfigService],
      useFactory: datasetUploadOptions,
    }),
    MongooseModule.forFeature([{ name: Dataset.name, schema: DatasetSchema }]),
  ],
  controllers: [DatasetsController],
  providers: [DatasetsService],
  exports: [DatasetsService, MongooseModule],
})
export class DatasetsModule {}
