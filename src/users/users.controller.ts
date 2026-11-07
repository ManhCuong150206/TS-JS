import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Query,
  Req,
  Res,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { CurrentUser, RequestUser } from '../common/auth.guard.js';
import { Roles, RolesGuard } from '../common/roles.guard.js';
import { destroySession, saveSession } from '../common/session.config.js';
import { publicUser } from '../login/user.schema.js';
import { UsersService } from './users.service.js';
import {
  AdminUpdateUserDto,
  ChangePasswordDto,
  DeleteAccountDto,
  ListUsersDto,
  UpdateProfileDto,
} from './users.dto.js';

@Controller('users')
@UseGuards(RolesGuard)
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
  @Patch('me')
  updateMe(@CurrentUser() user: RequestUser, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(user, dto.displayName);
  }
  @Patch('me/password')
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
  @Roles('admin')
  @Get()
  list(@Query() query: ListUsersDto) {
    return this.users.list(query);
  }
  @Roles('admin')
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return publicUser(await this.users.findOne(id));
  }
  @Roles('admin')
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: AdminUpdateUserDto,
    @CurrentUser() actor: RequestUser,
    @Req() req: Request,
  ) {
    return this.users.adminUpdate(id, dto, actor, req.ip || 'unknown');
  }
  @Roles('admin')
  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @CurrentUser() actor: RequestUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.users.deleteAccount(
      id,
      actor,
      req.ip || 'unknown',
    );
    if (id.toLowerCase() === actor.userId)
      await destroySession(req, res, this.config);
    return result;
  }
}
