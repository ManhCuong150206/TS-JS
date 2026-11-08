import { BadRequestException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface.js';
import { extname } from 'node:path';

export const DEFAULT_DATASET_FILE_SIZE = 10 * 1024 * 1024;

export function datasetFileSize(config: ConfigService): number {
  const max = Number(
    config.get('MAX_DATASET_FILE_SIZE') ?? DEFAULT_DATASET_FILE_SIZE,
  );
  if (!Number.isSafeInteger(max) || max <= 0) {
    throw new Error('MAX_DATASET_FILE_SIZE phải là số nguyên dương (byte)');
  }
  return max;
}

export function assertCsvFile(file: {
  originalname: string;
  mimetype: string;
}) {
  // MIME do client gửi, không đủ để xác nhận CSV. Luôn kiểm tra cả tên và nội dung.
  const allowedMimes = [
    'text/csv',
    'application/csv',
    'text/plain',
    'application/vnd.ms-excel',
    'application/octet-stream',
  ];
  if (
    extname(file.originalname).toLowerCase() !== '.csv' ||
    !allowedMimes.includes(file.mimetype.toLowerCase())
  ) {
    throw new BadRequestException(
      'Chỉ được tải lên tệp .csv với nội dung CSV hợp lệ.',
    );
  }
}

export function datasetUploadOptions(config: ConfigService): MulterOptions {
  return {
    limits: { fileSize: datasetFileSize(config), files: 1 },
    fileFilter: (_req, file, callback) => {
      try {
        assertCsvFile(file);
        callback(null, true);
      } catch (error) {
        callback(error as Error, false);
      }
    },
  };
}
