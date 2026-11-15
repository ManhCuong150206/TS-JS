import { Transform } from 'class-transformer';
import {
  IsByteLength,
  IsEmail,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';
import {
  Injectable,
  type PipeTransform,
  type ArgumentMetadata,
} from '@nestjs/common';
export class LoginDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email: string;
  @IsString()
  @Length(8, 72)
  // bcrypt chỉ xử lý 72 byte đầu; phải kiểm tra byte cả với tiếng Việt/emoji.
  @IsByteLength(0, 72, {
    message: 'Mật khẩu không được vượt quá 72 byte UTF-8',
  })
  password: string;
}
export class RegisterDto extends LoginDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 120)
  displayName: string;
}
// Đăng ký bỏ qua role/ownerId, còn trường lạ khác vẫn báo 400.
@Injectable()
export class IgnoreRegistrationPrivileges implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata) {
    if (
      metadata.metatype === RegisterDto &&
      value &&
      typeof value === 'object' &&
      !Array.isArray(value)
    ) {
      const body = { ...value } as Record<string, unknown>;
      delete body.role;
      delete body.ownerId;
      return body;
    }
    return value;
  }
}
