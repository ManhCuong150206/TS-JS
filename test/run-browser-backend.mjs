// Isolated browser integration: never load .env or use the application database.
import { MongoMemoryServer } from 'mongodb-memory-server';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
const mongo = await MongoMemoryServer.create({instance:{dbName:'hoi-quy-3d-test'}});
const uploadDir = await mkdtemp(join(tmpdir(),'hq3d-browser-'));
process.env.NODE_ENV='test';
process.env.MONGODB_URI=mongo.getUri('hoi-quy-3d-test');
process.env.SESSION_SECRET=randomBytes(32).toString('hex');
process.env.DATASET_STORAGE_DIR=uploadDir;
process.env.COOKIE_SECURE='false';
process.env.CORS_ORIGINS='http://localhost:4200,http://127.0.0.1:4300,http://127.0.0.1:4400';
const {NestFactory}=await import('@nestjs/core');
const {getConnectionToken}=await import('@nestjs/mongoose');
const {AppModule}=await import('../dist/app.module.js');
const {configureApp}=await import('../dist/common/configure-app.js');
const app=await NestFactory.create(AppModule,{logger:['error']});
configureApp(app);
let closing=false;
const close=async()=>{if(closing)return;closing=true;await app.close();await mongo.stop();await rm(uploadDir,{recursive:true,force:true});};
for(const event of ['SIGINT','SIGTERM'])process.once(event,()=>void close().finally(()=>process.exit()));
try{
 await app.init();const connection=app.get(getConnectionToken());
 if(connection.name!=='hoi-quy-3d-test')throw new Error('Unexpected test database');
 await Promise.all(Object.values(connection.models).map(model=>model.init()));
 await app.listen(Number(process.env.BROWSER_TEST_PORT||3001),'127.0.0.1');
 console.log('Isolated browser backend ready (database hoi-quy-3d-test, temporary MongoDB).');
}catch(error){await close();throw error;}
