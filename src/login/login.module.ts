import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoginService } from './login.service.js';
import { LoginController } from './login.controller.js';
import { User, UserSchema } from './user.schema.js';
import { AuthGuard } from '../common/auth.guard.js';
import { AuditLog, AuditLogSchema } from './audit.schema.js';
import { AuditService } from './audit.service.js';
@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: AuditLog.name, schema: AuditLogSchema },
    ]),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 5 }]),
  ],
  providers: [
    LoginService,
    AuditService,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  controllers: [LoginController],
  exports: [LoginService, AuditService, MongooseModule],
})
export class LoginModule {}
