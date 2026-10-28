import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

/**
 * Bộ đếm ID tự tăng. Chỉ tăng, không bao giờ giảm,
 * nên xóa id 2 rồi tạo mới sẽ ra 4, không dùng lại 2.
 */
@Schema({ collection: 'counters', versionKey: false })
export class Counter {
  @Prop({ type: String })
  _id: string;

  @Prop({ type: Number, default: 0 })
  seq: number;
}

export const CounterSchema = SchemaFactory.createForClass(Counter);