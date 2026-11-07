import { Transform, Type } from 'class-transformer';
import {
  IsByteLength,
  IsIn,
  IsInt,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import type { Role } from '../login/user.schema.js';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const present = (_object: unknown, value: unknown) => value !== undefined;

export class UpdateProfileDto {
  @Transform(trim)
  @IsString()
  @Length(1, 120)
  displayName: string;
}
export class ChangePasswordDto {
  @IsString()
  @Length(8, 72)
  @IsByteLength(0, 72, {
    message: 'Mật khẩu không được vượt quá 72 byte UTF-8',
  })
  currentPassword: string;
  @IsString()
  @Length(8, 72)
  @IsByteLength(0, 72, {
    message: 'Mật khẩu không được vượt quá 72 byte UTF-8',
  })
  newPassword: string;
}
export class DeleteAccountDto {
  @IsString()
  @Length(8, 72)
  @IsByteLength(0, 72, {
    message: 'Mật khẩu không được vượt quá 72 byte UTF-8',
  })
  password: string;
}
export class AdminUpdateUserDto {
  @ValidateIf(present)
  @Transform(trim)
  @IsString()
  @Length(1, 120)
  displayName?: string;
  @ValidateIf(present)
  @IsIn(['user', 'admin'])
  role?: Role;
  @ValidateIf(present)
  @IsIn(['active', 'disabled'])
  status?: 'active' | 'disabled';
}
export class ListUsersDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
  @ValidateIf(present)
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  search?: string;
}
