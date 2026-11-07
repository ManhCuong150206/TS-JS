import { Controller, Get, Post, Body, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AuthService, type SessionRequest } from './auth.service.js';
@Controller('auth')
export class AuthController {
 constructor(private auth:AuthService){}
 @Get('session') session(@Req()req:SessionRequest){return {user:req.user??null};}
 @Post('guest') async guest(@Req()req:SessionRequest,@Res({passthrough:true})res:Response){const user=await this.auth.guest(req.ip??'unknown');return this.auth.issue(user,res,req.sessionHash);}
 @Post('register') async register(@Body()body:Record<string,unknown>,@Req()req:SessionRequest,@Res({passthrough:true})res:Response){const user=await this.auth.register(body??{},req.ip??'unknown');return this.auth.issue(user,res,req.sessionHash);}
 @Post('login') async login(@Body()body:Record<string,unknown>,@Req()req:SessionRequest,@Res({passthrough:true})res:Response){const user=await this.auth.login(body??{},req.ip??'unknown');return this.auth.issue(user,res,req.sessionHash);}
 @Post('logout') logout(@Req()req:SessionRequest,@Res({passthrough:true})res:Response){return this.auth.logout(req,res);}
}
