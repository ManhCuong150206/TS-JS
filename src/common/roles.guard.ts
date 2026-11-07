import {
  Injectable,
  CanActivate,
  ExecutionContext,
  SetMetadata,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { RequestUser } from './auth.guard.js';
import type { Role } from '../login/user.schema.js';

export const Roles = (...roles: Role[]) => SetMetadata('roles', roles);
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}
  canActivate(context: ExecutionContext) {
    const roles = this.reflector.getAllAndOverride<Role[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);
    const { user } = context.switchToHttp().getRequest<{ user: RequestUser }>();
    if (roles && !roles.includes(user.role))
      throw new ForbiddenException('Không đủ quyền');
    return true;
  }
}
