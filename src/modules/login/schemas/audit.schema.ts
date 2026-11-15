import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ collection: 'auditLogs', versionKey: false })
export class AuditLog {
  @Prop({ type: String, default: null, index: true })
  userId: string | null;
  @Prop({ required: true })
  action: string;
  @Prop({ type: String, default: null })
  targetId: string | null;
  @Prop({ required: true })
  ip: string;
  @Prop({ default: Date.now, index: true })
  at: Date;
}
export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);
