import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuditLog } from './audit.schema.js';

@Injectable()
export class AuditService {
  constructor(
    @InjectModel(AuditLog.name) private readonly logs: Model<AuditLog>,
  ) {}
  async record(
    action: string,
    userId: string | null,
    targetId: string | null,
    ip: string,
  ) {
    // Chỉ nhận các trường cố định, tuyệt đối không truyền request body/session vào log.
    await this.logs.create({ action, userId, targetId, ip, at: new Date() });
  }
}
