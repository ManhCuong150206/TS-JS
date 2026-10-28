import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  ExperimentStatus,
  PreprocessingStepType,
  SplitMethod,
  SyncStatus,
} from '../experiment.enums.js';
import { AlgorithmDto } from './algorithm.dto.js';

export class DatasetRefDto {
  @IsString()
  @IsNotEmpty()
  datasetId: string;

  @IsOptional()
  @IsString()
  version?: string;
}

/** Một bước tiền xử lý, ví dụ { "type": "standard_scaler", "columns": ["area"] } */
export class PreprocessingStepDto {
  @IsEnum(PreprocessingStepType)
  type: PreprocessingStepType;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  columns?: string[];
}

export class PreprocessingDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PreprocessingStepDto)
  steps: PreprocessingStepDto[];
}

export class SplitConfigDto {
  @IsOptional()
  @IsEnum(SplitMethod)
  method?: SplitMethod;

  @IsNumber() @Min(0) @Max(1) trainRatio: number;
  @IsNumber() @Min(0) @Max(1) validationRatio: number;
  @IsNumber() @Min(0) @Max(1) testRatio: number;
  @IsBoolean() shuffle: boolean;
}

/** Tạo mới: KHÔNG có id (server tự cấp). clientId là tùy chọn. */
export class CreateExperimentDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  clientId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

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

  @ValidateNested()
  @Type(() => AlgorithmDto)
  algorithm: AlgorithmDto;

  /** Cho phép null hoặc bỏ trống */
  @IsOptional()
  @ValidateNested()
  @Type(() => DatasetRefDto)
  datasetRef?: DatasetRefDto | null;

  /** Bỏ trống thì mặc định { steps: [] } */
  @IsOptional()
  @ValidateNested()
  @Type(() => PreprocessingDto)
  preprocessing?: PreprocessingDto;

  @ValidateNested()
  @Type(() => SplitConfigDto)
  splitConfig: SplitConfigDto;

  @IsInt()
  @Min(0)
  seed: number;
}