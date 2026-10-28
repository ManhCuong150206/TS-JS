import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { AlgorithmType, ExperimentStatus } from '../experiment.enums.js';

export class QueryExperimentsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 10;

  @IsOptional()
  @IsEnum(AlgorithmType)
  algorithm?: AlgorithmType;

  @IsOptional()
  @IsEnum(ExperimentStatus)
  status?: ExperimentStatus;

  /** Tìm theo tên, không phân biệt hoa thường */
  @IsOptional()
  @IsString()
  search?: string;

  /** Sắp xếp theo updatedAt */
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder: 'asc' | 'desc' = 'desc';
}