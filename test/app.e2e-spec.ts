import { beforeAll,afterAll,describe,it,expect } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import request from 'supertest';
import { randomBytes } from 'node:crypto';
import { json } from 'express';
import { AppModule } from '../src/app.module.js';

describe('real MongoDB auth and experiment round trip',()=>{
 let app:INestApplication,connection:Connection;
 const database='regression_test_'+randomBytes(8).toString('hex');
 let guest:ReturnType<typeof request.agent>,account:ReturnType<typeof request.agent>,ownerId:string;
 const csvData={trainX:[[1,2],[3,4],[5,6]],trainY:[3,7,11],testX:[[2,3],[4,5]],testY:[5,9],trainIndices:[0,2,4]};
 const snapshot={id:'round-trip',mutationId:'save-1',serverVersion:0,name:'Real CSV snapshot',createdAt:123456,
  algorithm:'linear',learningRate:.01,maxIterations:1000,dataSource:'csv',csvName:'sample.csv',
  sampleCount:5,featureCount:2,noise:0,seed:42,trainRatio:.6,iterations:12,w:[1,2],b:.5,
  train:{mse:.01,rmse:.1,mae:.08,r2:.99},test:{mse:.04,rmse:.2,mae:.15,r2:null},csvData};
 beforeAll(async()=>{
  process.env.MONGODB_DB_NAME=database;
  const module=await Test.createTestingModule({imports:[AppModule]}).compile();app=module.createNestApplication();
  app.setGlobalPrefix('api/v1');app.use(json({limit:'10mb'}));await app.init();
  connection=app.get<Connection>(getConnectionToken());expect(connection.name).toBe(database);
  await Promise.all(Object.values(connection.models).map(m=>m.init()));
  guest=request.agent(app.getHttpServer());account=request.agent(app.getHttpServer());
 },30000);
 afterAll(async()=>{try{if(connection){if(connection.name!==database||!/^regression_test_[a-f0-9]{16}$/.test(connection.name))throw new Error('Refusing to delete unexpected database');await connection.dropDatabase();}}finally{await app?.close();}},30000);
 it('rejects forged user ID and Bearer ID without a session',async()=>{
  await request(app.getHttpServer()).get('/api/v1/experiments').set('x-user-id','anonymous_user').expect(401);
  await request(app.getHttpServer()).get('/api/v1/experiments').set('Authorization','Bearer anonymous_user').expect(401);
 });
 it('creates an isolated Guest session and registers a real account with hashed password',async()=>{
  const g=await guest.post('/api/v1/auth/guest').send({}).expect(201);ownerId=g.body.user.userId;
  expect(g.headers['set-cookie'][0]).toContain('HttpOnly');expect(g.headers['set-cookie'][0]).toContain('SameSite=Lax');
  const a=await account.post('/api/v1/auth/register').send({email:'member@example.com',password:'example-password-123',displayName:'Member'}).expect(201);
  expect(a.body.user.userId).not.toBe(ownerId);expect(a.body.user.passwordHash).toBeUndefined();
  const stored=await connection.collection('authusers').findOne({email:'member@example.com'});
  expect(stored?.passwordHash).not.toBe('example-password-123');expect(stored?.passwordHash).toHaveLength(128);
  expect(stored?.salt).toHaveLength(32);
 });
 it('writes and reads all coefficients/configuration/metrics/CSV in MongoDB',async()=>{
  const saved=await guest.post('/api/v1/experiments/bulk').send([{...snapshot,ownerId:'forged-owner'}]).expect(201);
  expect(saved.body.items).toEqual([{id:snapshot.id,mutationId:snapshot.mutationId,syncVersion:1}]);
  const stored=await connection.collection('experiments').findOne({clientId:snapshot.id});
  expect(stored?.ownerId).toBe(ownerId);expect(stored?.w).toEqual(snapshot.w);expect(stored?.b).toBe(.5);
  expect(stored?.train).toMatchObject(snapshot.train);expect(stored?.test).toMatchObject(snapshot.test);
  expect(stored?.csvData).toEqual(csvData);expect(stored?.learningRate).toBe(.01);expect(stored?.iterations).toBe(12);
  const pulled=await guest.get('/api/v1/experiments?includeDeleted=true').expect(200);
  expect(pulled.body.items[0]).toMatchObject({clientId:snapshot.id,clientCreatedAt:123456,w:snapshot.w,csvData});
 });
 it('keeps retries idempotent and rejects conflicting versions without modifying data',async()=>{
  const again=await guest.post('/api/v1/experiments/bulk').send([snapshot]).expect(201);expect(again.body.items[0].syncVersion).toBe(1);
  await guest.post('/api/v1/experiments/bulk').send([{...snapshot,mutationId:'stale',w:[99,99]}]).expect(409);
  expect((await connection.collection('experiments').findOne({clientId:snapshot.id}))?.w).toEqual(snapshot.w);
 });
 it('prevents another account from reading, changing or deleting a Guest experiment',async()=>{
  expect((await account.get('/api/v1/experiments').expect(200)).body.items).toHaveLength(0);
  await account.get('/api/v1/experiments/'+snapshot.id).expect(404);
  await account.patch('/api/v1/experiments/'+snapshot.id).send({name:'attack'}).expect(404);
  await account.delete('/api/v1/experiments/'+snapshot.id).expect(404);
  await account.post('/api/v1/experiments/bulk').send([{...snapshot,mutationId:'attack'}]).expect(409);
  await account.get('/api/v1/experiments').set('x-expected-user',ownerId).expect(401);
  const changes=await account.get('/api/v1/sync/changes').expect(200);expect(changes.body.changes.experiments).toHaveLength(0);
 });
 it('rejects invalid snapshots and cross-site writes',async()=>{
  await guest.post('/api/v1/experiments/bulk').send([{...snapshot,id:'bad',w:['not-a-number']}]).expect(400);
  await guest.post('/api/v1/experiments/bulk').set('Origin','https://untrusted.invalid').send([snapshot]).expect(403);
 });
 it('preserves a CSV snapshot above the default 100 KB body parser limit',async()=>{
  const rows=Array.from({length:6000},(_,i)=>[i,i+1]);const large={...snapshot,id:'large-csv',mutationId:'large-save',sampleCount:6000,trainRatio:.75,
   csvData:{trainX:rows.slice(0,4500),trainY:rows.slice(0,4500).map(r=>r[0]),testX:rows.slice(4500),testY:rows.slice(4500).map(r=>r[0]),trainIndices:Array.from({length:4500},(_,i)=>i)}};
  expect(Buffer.byteLength(JSON.stringify(large))).toBeGreaterThan(100000);
  await guest.post('/api/v1/experiments/bulk').send([large]).expect(201);
  expect((await connection.collection('experiments').findOne({clientId:'large-csv'}))?.csvData.trainX).toHaveLength(4500);
  await guest.delete('/api/v1/experiments/large-csv').expect(200);
 });
 it('does not allow mass assignment of owner, ID or weights through metadata PATCH',async()=>{
  await guest.post('/api/v1/experiments/bulk').send([{...snapshot,id:'metadata-patch',mutationId:'patch-save'}]).expect(201);
  await guest.patch('/api/v1/experiments/metadata-patch').send({name:'Own rename',ownerId:'forged',clientId:'stolen',w:[999,999]}).expect(200);
  const stored=await connection.collection('experiments').findOne({clientId:'metadata-patch'});
  expect(stored?.ownerId).toBe(ownerId);expect(stored?.w).toEqual(snapshot.w);expect(stored?.name).toBe('Own rename');
  await guest.delete('/api/v1/experiments/metadata-patch').expect(200);
 });
 it('cannot attach a server file through client-provided dataset metadata',async()=>{
  const response=await guest.post('/api/v1/datasets').send({name:'Unsafe metadata',sourceType:'generated',storage:{provider:'local-volume',key:'../../.env',format:'csv',sha256:'not-real'}}).expect(201);
  expect(response.body.storage).toBeUndefined();await guest.get('/api/v1/datasets/'+response.body._id+'/download').expect(404);
  await account.get('/api/v1/datasets/'+response.body._id).expect(404);
 });
 it('persists delete tombstones, allows retry and prevents old snapshots from resurrecting',async()=>{
  const remove={id:snapshot.id,mutationId:'delete-1',serverVersion:1,deletedAt:Date.now()};
  const a=await guest.post('/api/v1/experiments/bulk').send([remove]).expect(201);expect(a.body.items[0].syncVersion).toBe(2);
  expect((await guest.get('/api/v1/experiments').expect(200)).body.items).toHaveLength(0);
  expect((await guest.get('/api/v1/experiments?includeDeleted=true').expect(200)).body.items[0].deletedAt).toBeTruthy();
  expect((await guest.post('/api/v1/experiments/bulk').send([remove]).expect(201)).body.items[0].syncVersion).toBe(2);
  await guest.post('/api/v1/experiments/bulk').send([snapshot]).expect(409);
 });
 it('validates password, revokes session on logout and rotates on login',async()=>{
  await request(app.getHttpServer()).post('/api/v1/auth/login').send({email:'member@example.com',password:'wrong-password'}).expect(401);
  await account.post('/api/v1/auth/logout').send({}).expect(201);
  await account.get('/api/v1/experiments').expect(401);
  await account.post('/api/v1/auth/login').send({email:'member@example.com',password:'example-password-123'}).expect(201);
  await account.get('/api/v1/experiments').expect(200);
 });
 it('rejects expired sessions and rate-limits repeated password guesses',async()=>{
  const session=await account.get('/api/v1/auth/session').expect(200);
  await connection.collection('authsessions').updateMany({userId:new (await import('mongoose')).Types.ObjectId(session.body.user.userId)},{$set:{expiresAt:new Date(0)}});
  await account.get('/api/v1/experiments').expect(401);
  for(let i=0;i<10;i++)await request(app.getHttpServer()).post('/api/v1/auth/login').send({email:'missing@example.com',password:'wrong-password'}).expect(401);
  await request(app.getHttpServer()).post('/api/v1/auth/login').send({email:'missing@example.com',password:'wrong-password'}).expect(429);
 });
});
