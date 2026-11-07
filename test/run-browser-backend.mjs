// Isolated local server for browser integration. No application database is modified.
import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
process.loadEnvFile('.env');
process.env.MONGODB_DB_NAME='regression_browser_'+randomBytes(8).toString('hex');
process.env.NODE_ENV='test';
process.env.CORS_ORIGINS='http://127.0.0.1:4300,http://127.0.0.1:4400';
const {NestFactory}=await import('@nestjs/core');
const {getConnectionToken}=await import('@nestjs/mongoose');
const {AppModule}=await import('../dist/app.module.js');
const {json}=await import('express');
const app=await NestFactory.create(AppModule,{logger:['error']});app.setGlobalPrefix('api/v1');app.use(json({limit:'10mb'}));
await app.init();const connection=app.get(getConnectionToken());
if(connection.name!==process.env.MONGODB_DB_NAME)throw new Error('Unexpected test database');
await Promise.all(Object.values(connection.models).map(model=>model.init()));
await app.listen(3000,'127.0.0.1');
writeFileSync('FE/FE-hoiquy3d/output/playwright/live-backend.json',JSON.stringify({database:connection.name,port:3000}));
console.log('Isolated browser backend ready');
