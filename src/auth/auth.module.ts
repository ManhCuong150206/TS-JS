import { Global, Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Schema } from 'mongoose';
import { AuthService, SessionMiddleware } from './auth.service.js';
import { AuthController } from './auth.controller.js';
const UserSchema=new Schema({email:{type:String,unique:true,sparse:true},displayName:String,
  passwordHash:{type:String,select:false},salt:{type:String,select:false},isAnonymous:{type:Boolean,default:false}}, {timestamps:true});
const SessionSchema=new Schema({tokenHash:{type:String,unique:true},userId:{type:Schema.Types.ObjectId,ref:'AuthUser'},
  expiresAt:{type:Date,index:{expires:0}}});
@Global()
@Module({imports:[MongooseModule.forFeature([{name:'AuthUser',schema:UserSchema},{name:'AuthSession',schema:SessionSchema}])],
 controllers:[AuthController],providers:[AuthService,SessionMiddleware],exports:[AuthService]})
export class AuthModule implements NestModule {
 configure(consumer:MiddlewareConsumer){consumer.apply(SessionMiddleware).forRoutes('{*path}');}
}
