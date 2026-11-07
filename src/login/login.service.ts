import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  Inject,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';
import { isEmail } from 'class-validator';
import { User, publicUser } from './user.schema.js';
import type { LoginDto, RegisterDto } from './auth.dto.js';
import { AuditService } from './audit.service.js';

@Injectable()
export class LoginService implements OnModuleInit {
  private dummyHash: string;
  constructor(
    @InjectModel(User.name) readonly users: Model<User>,
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}
  async onModuleInit() {
    await this.users.init();
    this.dummyHash = await bcrypt.hash(randomBytes(32), 12);
    if (await this.users.exists({ role: 'admin' })) return;
    const email = this.config.get<string>('ADMIN_EMAIL')?.trim().toLowerCase();
    const password = this.config.get<string>('ADMIN_PASSWORD');
    if (!email && !password) return;
    if (
      !email ||
      !isEmail(email) ||
      !password ||
      password.length < 8 ||
      Buffer.byteLength(password, 'utf8') > 72
    ) {
      throw new Error('ADMIN_EMAIL hoặc ADMIN_PASSWORD không hợp lệ');
    }
    // Không chiếm tài khoản đã đăng ký bằng cách ghi đè email trùng.
    if (await this.users.exists({ email }))
      throw new Error('ADMIN_EMAIL đã tồn tại; chọn email admin khác');
    await this.users.create({
      email,
      displayName: 'Administrator',
      role: 'admin',
      passwordHash: await bcrypt.hash(password, 12),
    });
  }
  async register(dto: RegisterDto, ip: string) {
    try {
      const user = await this.users.create({
        email: dto.email,
        displayName: dto.displayName,
        passwordHash: await bcrypt.hash(dto.password, 12),
        role: 'user',
      });
      await this.audit.record(
        'register',
        user._id.toString(),
        user._id.toString(),
        ip,
      );
      return publicUser(user);
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 11000
      ) {
        throw new ConflictException('Email đã tồn tại');
      }
      throw error;
    }
  }
  async authenticate(dto: LoginDto, ip: string) {
    const user = await this.users
      .findOne({ email: dto.email })
      .select('+passwordHash');
    // Luôn chạy bcrypt một lần, kể cả email không tồn tại.
    const valid = await bcrypt.compare(
      dto.password,
      user?.passwordHash || this.dummyHash,
    );
    if (!valid || !user || user.status !== 'active') {
      await this.audit.record(
        'login.failure',
        user?._id.toString() || null,
        null,
        ip,
      );
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }
    return user;
  }
}
