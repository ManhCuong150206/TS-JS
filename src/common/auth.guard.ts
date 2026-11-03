import { Injectable, CanActivate, ExecutionContext, createParamDecorator, UnauthorizedException } from '@nestjs/common';
import type { SessionRequest } from '../auth/auth.service.js';
export class RequestUser {userId:string;isAnonymous:boolean;}
/** Historical name retained for imports. Identity is now resolved by server-side sessions. */
@Injectable()
export class OptionalAuthGuard implements CanActivate {
 canActivate(context:ExecutionContext){const req=context.switchToHttp().getRequest<SessionRequest>();if(!req.user)throw new UnauthorizedException('Vui lòng đăng nhập hoặc chọn Guest.');const expected=req.headers['x-expected-user'];if(expected&&expected!==req.user.userId)throw new UnauthorizedException('Phiên đăng nhập đã đổi tài khoản.');return true;}
}
export const CurrentUser=createParamDecorator((_data:unknown,ctx:ExecutionContext):RequestUser=>{
 const user=ctx.switchToHttp().getRequest<SessionRequest>().user;if(!user)throw new UnauthorizedException();return user;
});
