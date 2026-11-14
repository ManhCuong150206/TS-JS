import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Post,
  Req,
  Res,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { CurrentUser, RequestUser } from '../common/auth.guard.js';
import { destroySession, saveSession } from '../common/session.config.js';
import { publicUser } from '../login/user.schema.js';
import { UsersService } from './users.service.js';
import {
  ChangePasswordDto,
  DeleteAccountDto,
  UpdateProfileDto,
} from './users.dto.js';

@Controller('users')
@UsePipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }),
)
export class UsersController {
  constructor(
    @Inject(UsersService) private readonly users: UsersService,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}
  @Get('me')
  me(@CurrentUser() user: RequestUser) {
    return publicUser(user.account);
  }
  @Post('me')
  @HttpCode(200)
  updateMe(@CurrentUser() user: RequestUser, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(user, dto.displayName);
  }
  @Post('me/password')
  @HttpCode(200)
  async password(
    @CurrentUser() user: RequestUser,
    @Body() dto: ChangePasswordDto,
    @Req() req: Request,
  ) {
    const updated = await this.users.changePassword(
      user,
      dto,
      req.ip || 'unknown',
    );
    req.session.sessionVersion = updated.sessionVersion;
    await saveSession(req);
    return publicUser(updated);
  }
  @Delete('me')
  async deleteMe(
    @CurrentUser() user: RequestUser,
    @Body() dto: DeleteAccountDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.users.verifyPassword(user, dto.password);
    const result = await this.users.deleteAccount(
      user.userId,
      user,
      req.ip || 'unknown',
    );
    await destroySession(req, res, this.config);
    return result;
  }
}
