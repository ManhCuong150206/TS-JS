import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';

export type SyncOperationDocument = HydratedDocument<SyncOperation>;
export type SyncEntityType = 'experiment' | 'dataset' | 'trainingRun';
export type SyncAction = 'create' | 'update' | 'delete';
export type SyncOperationStatus = 'applied' | 'conflict' | 'rejected' | 'duplicate' | 'error';

@Schema({ timestamps: true, collection: 'syncOperations' })
export class SyncOperation {
  @Prop({ required: true, trim: true })
  operationId: string;

  @Prop({ required: true, trim: true, unique: true, index: true })
  idempotencyKey: string;

  @Prop({ type: String, required: true, enum: ['experiment', 'dataset', 'trainingRun'] })
  entityType: SyncEntityType;

  @Prop({ required: true, trim: true, index: true })
  entityClientId: string;

  @Prop({ type: String, required: true, enum: ['create', 'update', 'delete'] })
  action: SyncAction;

  @Prop({ required: true, default: 1 })
  clientVersion: number;

  @Prop({ default: 1 })
  serverVersion: number;

  @Prop({
    type: String,
    required: true,
    enum: ['applied', 'conflict', 'rejected', 'duplicate', 'error'],
    default: 'applied',
  })
  status: SyncOperationStatus;

  @Prop()
  conflictReason?: string;

  @Prop({ type: MongooseSchema.Types.Mixed })
  serverDataSnapshot?: Record<string, unknown>;

  @Prop({ type: String, trim: true, index: true })
  ownerId?: string;
}

export const SyncOperationSchema = SchemaFactory.createForClass(SyncOperation);
SyncOperationSchema.index({ ownerId: 1, createdAt: -1 });
SyncOperationSchema.index({ entityClientId: 1, createdAt: -1 });
