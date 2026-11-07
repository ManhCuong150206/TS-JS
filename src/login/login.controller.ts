import {
  Body,
  Controller,
  Get,
  Post,
  HttpCode,
  Req,
  Res,
  UseGuards,
  UsePipes,
  ValidationPipe,
  Inject,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { LoginService } from './login.service.js';
import {
  LoginDto,
  RegisterDto,
  IgnoreRegistrationPrivileges,
} from './auth.dto.js';
import { CurrentUser, Public, RequestUser } from '../common/auth.guard.js';
import { destroySession, saveSession } from '../common/session.config.js';
import { publicUser } from './user.schema.js';
import { AuditService } from './audit.service.js';

@Controller('auth')
@UsePipes(
  new IgnoreRegistrationPrivileges(),
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }),
)
export class LoginController {
  constructor(
    @Inject(LoginService) private readonly login: LoginService,
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}
  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('register')
  register(@Body() dto: RegisterDto, @Req() req: Request) {
    return this.login.register(dto, req.ip || 'unknown');
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('login')
  @HttpCode(200)
  async signIn(@Body() dto: LoginDto, @Req() req: Request) {
    const user = await this.login.authenticate(dto, req.ip || 'unknown');
    await new Promise<void>((resolve, reject) =>
      req.session.regenerate((err: unknown) => (err ? reject(err) : resolve())),
    );
    req.session.userId = user._id.toString();
    req.session.sessionVersion = user.sessionVersion;
    await saveSession(req);
    await this.audit.record(
      'login.success',
      user._id.toString(),
      user._id.toString(),
      req.ip || 'unknown',
    );
    return publicUser(user);
  }
  @Post('logout')
  @HttpCode(200)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @CurrentUser() user: RequestUser,
  ) {
    await destroySession(req, res, this.config);
    await this.audit.record(
      'logout',
      user.userId,
      user.userId,
      req.ip || 'unknown',
    );
    return { success: true };
  }
  @Get('me')
  me(@CurrentUser() user: RequestUser) {
    return publicUser(user.account);
  }
}
