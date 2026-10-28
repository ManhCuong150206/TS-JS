import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class DuplicateExperimentDto {
  @ApiPropertyOptional({ description: 'Tên bản sao. Mặc định: "<tên gốc> (copy)"' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;
}