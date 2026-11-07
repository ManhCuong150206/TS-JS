import {
  Injectable,
  CanActivate,
  ExecutionContext,
  createParamDecorator,
  SetMetadata,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { Request } from 'express';
import { User, type UserDocument, type Role } from '../login/user.schema.js';
import { destroySession } from './session.config.js';

export class RequestUser {
  userId: string;
  role: Role;
  account: UserDocument;
}
export const Public = () => SetMetadata('public', true);
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(ConfigService) private readonly config: ConfigService,
    @InjectModel(User.name) private readonly users: Model<User>,
  ) {}
  async canActivate(context: ExecutionContext) {
    if (
      this.reflector.getAllAndOverride<boolean>('public', [
        context.getHandler(),
        context.getClass(),
      ])
    )
      return true;
    const req = context
      .switchToHttp()
      .getRequest<Request & { user: RequestUser }>();
    const id = req.session?.userId;
    const user =
      id && Types.ObjectId.isValid(id) ? await this.users.findById(id) : null;
    if (
      !user ||
      user.status !== 'active' ||
      user.sessionVersion !== req.session.sessionVersion
    ) {
      if (req.session)
        await destroySession(
          req,
          context.switchToHttp().getResponse(),
          this.config,
        );
      throw new UnauthorizedException('Vui lòng đăng nhập');
    }
    req.user = { userId: user._id.toString(), role: user.role, account: user };
    return true;
  }
}
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestUser =>
    ctx.switchToHttp().getRequest<Request & { user: RequestUser }>().user,
);
