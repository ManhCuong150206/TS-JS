import { Injectable, NestMiddleware, BadRequestException, UnauthorizedException, ConflictException, HttpException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomBytes, scrypt, createHash, timingSafeEqual } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
export interface AuthUser {email?:string;displayName:string;passwordHash?:string;salt?:string;isAnonymous:boolean}
interface Session {tokenHash:string;userId:Types.ObjectId;expiresAt:Date}
export interface Identity {userId:string;displayName:string;email?:string;isAnonymous:boolean}
export type SessionRequest=Request & {user?:Identity;sessionHash?:string};
export const hashToken=(token:string)=>createHash('sha256').update(token).digest('hex');
export const passwordKey=(password:string,salt:string)=>new Promise<Buffer>((resolve,reject)=>scrypt(password,salt,64,(error,key)=>error?reject(error):resolve(key)));
@Injectable()
export class AuthService {
 private attempts=new Map<string,{count:number;until:number}>();
 constructor(@InjectModel('AuthUser') private users:Model<AuthUser>,@InjectModel('AuthSession') private sessions:Model<Session>){}
 private publicUser(user:AuthUser & {_id:Types.ObjectId}):Identity{return {userId:String(user._id),email:user.email,displayName:user.displayName,isAnonymous:user.isAnonymous};}
 private credentials(body:Record<string,unknown>){
  const email=typeof body.email==='string'?body.email.trim().toLowerCase():'';
  const password=typeof body.password==='string'?body.password:'';
  if(email.length>254||!/^\S+@\S+\.\S+$/.test(email)||password.length<8||password.length>128)throw new BadRequestException('Email hoặc mật khẩu không hợp lệ (8–128 ký tự).');
  return {email,password};
 }
 private throttle(ip:string,limit=10){const now=Date.now(),old=this.attempts.get(ip);if(old&&old.until>now&&old.count>=limit)throw new HttpException('Thử lại sau 15 phút.',429);
  if(this.attempts.size>10000)for(const [key,value]of this.attempts)if(value.until<=now)this.attempts.delete(key);
  this.attempts.set(ip,{count:old&&old.until>now?old.count+1:1,until:old&&old.until>now?old.until:now+900000});}
 async register(body:Record<string,unknown>,ip:string){this.throttle(ip);const {email,password}=this.credentials(body);
  const displayName=typeof body.displayName==='string'?body.displayName.trim():'';
  if(!displayName||displayName.length>80)throw new BadRequestException('Tên hiển thị cần từ 1 đến 80 ký tự.');
  const salt=randomBytes(16).toString('hex'),passwordHash=(await passwordKey(password,salt)).toString('hex');
  await this.users.init();try{return this.publicUser(await this.users.create({email,displayName,salt,passwordHash,isAnonymous:false}));}
  catch(error){if((error as {code?:number}).code===11000)throw new ConflictException('Email đã được đăng ký.');throw error;}
 }
 async login(body:Record<string,unknown>,ip:string){this.throttle(ip);const {email,password}=this.credentials(body);
  const user=await this.users.findOne({email}).select('+passwordHash +salt').exec();
  const key=await passwordKey(password,user?.salt??'dummy-salt-for-invalid-user');
  if(!user?.passwordHash||!timingSafeEqual(Buffer.from(user.passwordHash,'hex'),key))throw new UnauthorizedException('Email hoặc mật khẩu không đúng.');
  this.attempts.delete(ip);return this.publicUser(user);
 }
 async guest(ip='unknown'){this.throttle('guest:'+ip,100);return this.publicUser(await this.users.create({displayName:'Guest',isAnonymous:true}));}
 async resolve(token?:string){if(!token||!/^[a-f0-9]{64}$/.test(token))return null;
  const session=await this.sessions.findOne({tokenHash:hashToken(token),expiresAt:{$gt:new Date()}}).exec();
  if(!session)return null;const user=await this.users.findById(session.userId).exec();return user?this.publicUser(user):null;
 }
 async issue(user:Identity,res:Response,oldHash?:string){if(oldHash)await this.sessions.deleteOne({tokenHash:oldHash});
  const token=randomBytes(32).toString('hex');await this.sessions.create({tokenHash:hashToken(token),userId:user.userId,expiresAt:new Date(Date.now()+7*86400000)});
  res.cookie('regression_sid',token,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/api/v1',maxAge:7*86400000});return {user};
 }
 async logout(req:SessionRequest,res:Response){if(req.sessionHash)await this.sessions.deleteOne({tokenHash:req.sessionHash});res.clearCookie('regression_sid',{path:'/api/v1',httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production'});return {success:true};}
}
@Injectable()
export class SessionMiddleware implements NestMiddleware {
 constructor(private auth:AuthService){}
 async use(req:SessionRequest,_res:Response,next:NextFunction){
  if(!['GET','HEAD','OPTIONS'].includes(req.method)){
   const origin=req.headers.origin,allowed=(process.env.CORS_ORIGINS??'http://localhost:4200,http://localhost:4300,http://127.0.0.1:4300').split(',');
   const own=`${req.protocol}://${req.get('host')}`;
   if((origin&&origin!==own&&!allowed.includes(origin))||req.headers['sec-fetch-site']==='cross-site')throw new ForbiddenException('Nguồn yêu cầu không được phép.');
  }
  const token=(req.headers.cookie??'').split(';').map(x=>x.trim()).find(x=>x.startsWith('regression_sid='))?.slice('regression_sid='.length);
  const user=await this.auth.resolve(token);if(user){req.user=user;req.sessionHash=hashToken(token!);}next();
 }
}
