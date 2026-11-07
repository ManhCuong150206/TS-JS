import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';
export type UserDocument = HydratedDocument<User>;
export type Role = 'user' | 'admin';
@Schema({ timestamps: true, collection: 'users' })
export class User {
  @Prop({ required: true, lowercase: true, trim: true, unique: true })
  email: string;
  @Prop({ required: true, select: false })
  passwordHash: string;
  @Prop({ required: true, trim: true, maxlength: 120 })
  displayName: string;
  @Prop({ type: String, enum: ['user', 'admin'], default: 'user' })
  role: Role;
  @Prop({ type: String, enum: ['active', 'disabled'], default: 'active' })
  status: 'active' | 'disabled';
  @Prop({ default: 0 })
  sessionVersion: number;
  createdAt: Date;
  updatedAt: Date;
}
export const UserSchema = SchemaFactory.createForClass(User);
export function publicUser(user: UserDocument) {
  return {
    _id: user._id.toString(),
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
