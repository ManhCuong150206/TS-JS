import { Injectable, CanActivate, ExecutionContext, createParamDecorator } from '@nestjs/common';
import type { Request } from 'express';

export class RequestUser {
  userId: string;
  isAnonymous: boolean;
}

/**
 * Optional Auth Guard:
 * Accepts user ID from 'x-user-id' header, 'Authorization: Bearer <userId>',
 * or assigns a default anonymous user if none is supplied.
 */
@Injectable()
export class OptionalAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { user?: RequestUser }>();
    const headerUserId = request.headers['x-user-id'] as string;
    const authHeader = request.headers['authorization'];

    let userId = '';
    if (headerUserId && headerUserId.trim().length > 0) {
      userId = headerUserId.trim();
    } else if (authHeader && authHeader.startsWith('Bearer ')) {
      userId = authHeader.substring(7).trim();
    }

    if (userId) {
      request.user = { userId, isAnonymous: false };
    } else {
      request.user = { userId: 'anonymous_user', isAnonymous: true };
    }

    return true;
  }
}

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): RequestUser => {
    const request = ctx.switchToHttp().getRequest<Request & { user?: RequestUser }>();
    return request.user || { userId: 'anonymous_user', isAnonymous: true };
  },
);
