import { plainToInstance, Transform, type TransformFnParams } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { AlgorithmType } from '../experiment.enums.js';

/**
 * Config của linear_regression.
 * Mọi field đều tùy chọn, nhưng nếu có gửi thì phải hợp lệ.
 */
export class LinearConfigDto {
  @IsOptional()
  @IsBoolean()
  fitIntercept?: boolean;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  learningRate?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxIterations?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  tolerance?: number;
}

/** polynomial_regression: bắt buộc có degree (số nguyên >= 2) */
export class PolynomialConfigDto extends LinearConfigDto {
  @IsInt()
  @Min(2)
  degree: number;
}

/** ridge_regression, lasso_regression: bắt buộc có lambda >= 0 */
export class RegularizedConfigDto extends LinearConfigDto {
  @IsNumber()
  @Min(0)
  lambda: number;
}

export type AlgorithmConfig = LinearConfigDto | PolynomialConfigDto | RegularizedConfigDto;

/** Loại thuật toán nào thì dùng class nào để kiểm tra config */
const CONFIG_CLASS: Record<AlgorithmType, new () => AlgorithmConfig> = {
  [AlgorithmType.LINEAR_REGRESSION]: LinearConfigDto,
  [AlgorithmType.POLYNOMIAL_REGRESSION]: PolynomialConfigDto,
  [AlgorithmType.RIDGE_REGRESSION]: RegularizedConfigDto,
  [AlgorithmType.LASSO_REGRESSION]: RegularizedConfigDto,
};

export class AlgorithmDto {
  @IsEnum(AlgorithmType)
  type: AlgorithmType;

  @IsString()
  @IsNotEmpty()
  version: string;

  @IsObject()
  @ValidateNested()
  @Transform(({ value, obj }: TransformFnParams): unknown => {
    const type = (obj as { type?: AlgorithmType }).type;
    const target = type ? CONFIG_CLASS[type] : undefined;
    if (target && typeof value === 'object' && value !== null) {
      return plainToInstance(target, value as Record<string, unknown>);
    }
    return value;
  })
  config: AlgorithmConfig;
}