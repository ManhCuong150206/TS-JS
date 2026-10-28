import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ExperimentStatus, SyncStatus } from '../experiment.enums.js';
import { AlgorithmDto } from './algorithm.dto.js';
import { DatasetRefDto, PreprocessingDto, SplitConfigDto } from './create-experiment.dto.js';

export class UpdateExperimentDto {
  /** syncVersion hiện tại client đang giữ. Lệch với DB thì trả 409. */
  @IsInt()
  @Min(1)
  version: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsEnum(ExperimentStatus)
  status?: ExperimentStatus;

  @IsOptional()
  @IsEnum(SyncStatus)
  syncStatus?: SyncStatus;

  @IsOptional()
  @ValidateNested()
  @Type(() => AlgorithmDto)
  algorithm?: AlgorithmDto;

  /** Gửi null để gỡ dataset */
  @IsOptional()
  @ValidateNested()
  @Type(() => DatasetRefDto)
  datasetRef?: DatasetRefDto | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => PreprocessingDto)
  preprocessing?: PreprocessingDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => SplitConfigDto)
  splitConfig?: SplitConfigDto;

  @IsOptional()
  @IsInt()
  @Min(0)
  seed?: number;
}