import { ConfigService } from '@nestjs/config';
import { datasetFileSize, DEFAULT_DATASET_FILE_SIZE } from './upload.config.js';

describe('CSV upload size configuration', () => {
  it('defaults to 10 MiB and accepts a size in bytes', () => {
    expect(datasetFileSize(new ConfigService())).toBe(
      DEFAULT_DATASET_FILE_SIZE,
    );
    expect(
      datasetFileSize(new ConfigService({ MAX_DATASET_FILE_SIZE: '1024' })),
    ).toBe(1024);
  });
  it.each(['0', '-1', '1.5', 'NaN', '10MB'])(
    'refuses invalid size %s',
    (value) => {
      expect(() =>
        datasetFileSize(new ConfigService({ MAX_DATASET_FILE_SIZE: value })),
      ).toThrow('MAX_DATASET_FILE_SIZE');
    },
  );
});
