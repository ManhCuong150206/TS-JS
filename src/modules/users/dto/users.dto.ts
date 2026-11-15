import { Transform } from 'class-transformer';
import {
  IsByteLength,
  IsString,
  Length,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

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
