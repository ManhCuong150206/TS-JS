import { mkdtemp, readdir, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { getConnectionToken } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { configureApp } from '../src/common/configure-app.js';

const prefix = '/api/v1';
const header = { 'X-Requested-With': 'XMLHttpRequest' };
const password = 'test-password-123';
let mongo: MongoMemoryServer;
let uploadDir: string;
let app: NestExpressApplication;
let db: Connection;
let server: App;
let AppModule: (typeof import('../src/app.module.js'))['AppModule'];

beforeAll(async () => {
  // Mongo riêng được tạo bởi chính test; không dùng URI/.env của máy.
  mongo = await MongoMemoryServer.create({
    instance: { dbName: 'hoi-quy-3d-test' },
  });
  uploadDir = await mkdtemp(join(tmpdir(), 'hq3d-auth-test-'));
  process.env.DATASET_STORAGE_DIR = uploadDir;
  process.env.MAX_DATASET_FILE_SIZE = '1024'; // Giới hạn nhỏ riêng cho test upload.
  process.env.NODE_ENV = 'test';
  process.env.MONGODB_URI = mongo.getUri('hoi-quy-3d-test');
  process.env.SESSION_SECRET = 'test-only-secret-at-least-32-characters';
  process.env.ADMIN_EMAIL = 'admin@example.com';
  process.env.ADMIN_PASSWORD = password;
  process.env.COOKIE_SECURE = 'false';
  process.env.TRUST_PROXY = 'false';
  process.env.CORS_ORIGINS = 'http://localhost:4200,http://localhost:5173';
  ({ AppModule } = await import('../src/app.module.js'));
}, 180000);

beforeEach(async () => {
  const fixture = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  app = fixture.createNestApplication<NestExpressApplication>();
  configureApp(app);
  await app.init();
  db = app.get<Connection>(getConnectionToken());
  server = app.getHttpServer() as App;
}, 30000);

afterEach(async () => {
  if (db) {
    if (
      db.name !== 'hoi-quy-3d-test' ||
      process.env.MONGODB_URI !== mongo.getUri('hoi-quy-3d-test')
    )
      throw new Error('Unsafe test cleanup');
    for (const collection of Object.values(db.collections))
      await collection.deleteMany({});
  }
  await app?.close();
});
afterAll(async () => {
  await mongo?.stop();
  if (uploadDir) {
    for (const name of await readdir(uploadDir))
      await unlink(join(uploadDir, name));
    await rmdir(uploadDir);
  }
});

async function register(email: string, extra: object = {}) {
  return request(server)
    .post(prefix + '/auth/register')
    .set(header)
    .send({ email, password, displayName: 'Test User', ...extra })
    .expect(201);
}
async function login(email: string) {
  const agent = request.agent(server);
  await agent
    .post(prefix + '/auth/login')
    .set(header)
    .send({ email, password })
    .expect(200);
  return agent;
}
async function actors() {
  const a = (await register('a@example.com')).body as { _id: string };
  const b = (await register('b@example.com')).body as { _id: string };
  return {
    a,
    b,
    alice: await login('a@example.com'),
    bob: await login('b@example.com'),
    admin: await login('admin@example.com'),
  };
}
async function dataset(
  agent: ReturnType<typeof request.agent>,
  extra: object = {},
) {
  return (
    await agent
      .post(prefix + '/datasets')
      .set(header)
      .send({ name: 'Data', sourceType: 'generated', ...extra })
      .expect(201)
  ).body as { _id: string; clientId: string; ownerId: string };
}
async function experiment(
  agent: ReturnType<typeof request.agent>,
  datasetId: string,
) {
  return (
    await agent
      .post(prefix + '/experiments')
      .set(header)
      .send({
        name: 'Experiment',
        datasetId,
        algorithm: { type: 'linear', config: {} },
        targetColumn: 'y',
        featureColumns: ['x'],
      })
      .expect(201)
  ).body as { _id: string; clientId: string };
}
function op(
  entityType: string,
  entityClientId: string,
  action: string,
  payload: object = {},
  id = crypto.randomUUID(),
) {
  return {
    operationId: id,
    idempotencyKey: id,
    entityType,
    entityClientId,
    action,
    payload,
    clientVersion: 10,
  };
}

describe('Session auth and data permissions', () => {
  it('register/login/me/logout; cookie flags, regeneration and safe user response', async () => {
    await request(server)
      .get(prefix + '/')
      .expect(200, 'Hello World!');
    await request(server)
      .get(prefix + '/health')
      .expect(200);
    const registered = await register('  USER@Example.com ', {
      role: 'admin',
      ownerId: 'forged',
    });
    expect(registered.body).toMatchObject({
      email: 'user@example.com',
      role: 'user',
      status: 'active',
    });
    const storedUser = await db
      .collection('users')
      .findOne({ email: 'user@example.com' });
    expect(storedUser?.passwordHash).toMatch(/^\$2b\$12\$/);
    expect(Object.keys(registered.body).sort()).toEqual(
      [
        '_id',
        'email',
        'displayName',
        'role',
        'status',
        'createdAt',
        'updatedAt',
      ].sort(),
    );
    const agent = request.agent(server);
    const first = await agent
      .post(prefix + '/auth/login')
      .set(header)
      .send({ email: 'user@example.com', password })
      .expect(200);
    const cookie = first.headers['set-cookie'][0] as string;
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('hq3d.sid=');
    const second = await agent
      .post(prefix + '/auth/login')
      .set(header)
      .send({ email: 'user@example.com', password })
      .expect(200);
    expect(second.headers['set-cookie'][0]).not.toBe(cookie);
    await request(server)
      .get(prefix + '/auth/me')
      .set('Cookie', cookie.split(';')[0])
      .expect(401);
    await agent.get(prefix + '/auth/me').expect(200);
    const logout = await agent
      .post(prefix + '/auth/logout')
      .set(header)
      .expect(200);
    expect(logout.headers['set-cookie'][0]).toContain(
      'Expires=Thu, 01 Jan 1970',
    );
    await agent.get(prefix + '/auth/me').expect(401);
  });
  it('accepts 72 UTF-8 bytes and rejects passwords bcrypt would truncate', async () => {
    const unicodePassword = 'é'.repeat(36);
    await register('bytes@example.com', { password: unicodePassword });
    for (const tooLong of ['a'.repeat(73), 'é'.repeat(37)]) {
      await request(server)
        .post(prefix + '/auth/register')
        .set(header)
        .send({
          email: 'long@example.com',
          password: tooLong,
          displayName: 'Long',
        })
        .expect(400);
    }
    const agent = request.agent(server);
    await agent
      .post(prefix + '/auth/login')
      .set(header)
      .send({ email: 'bytes@example.com', password: unicodePassword + 'x' })
      .expect(400);
    await agent
      .post(prefix + '/auth/login')
      .set(header)
      .send({ email: 'bytes@example.com', password: unicodePassword })
      .expect(200);
    await agent
      .post(prefix + '/users/me/password')
      .set(header)
      .send({ currentPassword: unicodePassword, newPassword: 'é'.repeat(37) })
      .expect(400);
    await agent
      .post(prefix + '/users/me/password')
      .set(header)
      .send({ currentPassword: unicodePassword, newPassword: 'a'.repeat(72) })
      .expect(200);
    await agent
      .delete(prefix + '/users/me')
      .set(header)
      .send({ password: 'a'.repeat(73) })
      .expect(400);
    await agent
      .delete(prefix + '/users/me')
      .set(header)
      .send({ password: 'a'.repeat(72) })
      .expect(200);
  });
  it('validates DTOs, duplicate email and generic incorrect credentials', async () => {
    await register('a@example.com');
    await request(server)
      .post(prefix + '/auth/register')
      .set(header)
      .send({ email: 'A@example.com', password, displayName: 'A' })
      .expect(409);
    await request(server)
      .post(prefix + '/auth/register')
      .set(header)
      .send({ email: 'invalid', password: 'short', displayName: '' })
      .expect(400);
    await request(server)
      .post(prefix + '/auth/register')
      .set(header)
      .send({
        email: 'new@example.com',
        password,
        displayName: 'A',
        unknown: true,
      })
      .expect(400);
    for (const email of ['a@example.com', 'missing@example.com']) {
      const response = await request(server)
        .post(prefix + '/auth/login')
        .set(header)
        .send({ email, password: 'wrong-password' })
        .expect(401);
      expect(response.body.message).toBe('Email hoặc mật khẩu không đúng');
    }
  });
  it('rejects missing CSRF header, foreign origin and forged identity; allows credentialed preflight', async () => {
    await request(server)
      .post(prefix + '/auth/login')
      .send({})
      .expect(403);
    await request(server)
      .get(prefix + '/datasets')
      .set('x-user-id', 'admin')
      .set('Authorization', 'Bearer admin')
      .expect(401);
    const preflight = await request(server)
      .options(prefix + '/auth/login')
      .set('Origin', 'http://localhost:4200')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type,x-requested-with')
      .expect(204);
    expect(preflight.headers['access-control-allow-credentials']).toBe('true');
    expect(preflight.headers['access-control-allow-origin']).toBe(
      'http://localhost:4200',
    );
    const denied = await request(server)
      .get(prefix + '/health')
      .set('Origin', 'https://evil.example')
      .expect(403);
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });
  it('limits login and register per IP to five requests/minute', async () => {
    for (let i = 0; i < 5; i++)
      await request(server)
        .post(prefix + '/auth/login')
        .set(header)
        .send({ email: 'absent@example.com', password })
        .expect(401);
    await request(server)
      .post(prefix + '/auth/login')
      .set(header)
      .send({ email: 'absent@example.com', password })
      .expect(429);
    for (let i = 0; i < 5; i++) await register('user' + i + '@example.com');
    await request(server)
      .post(prefix + '/auth/register')
      .set(header)
      .send({ email: 'six@example.com', password, displayName: 'Six' })
      .expect(429);
  });
  it('isolates datasets/experiments/runs and their references, permits admin', async () => {
    const { a, b, alice, bob, admin } = await actors();
    const data = await dataset(bob, { ownerId: a._id });
    expect(data.ownerId).toBe(b._id);
    const exp = await experiment(bob, data._id);
    const run = await bob
      .post(prefix + '/training-runs')
      .set(header)
      .send({
        experimentId: exp._id,
        algorithmType: 'linear',
        configSnapshot: {},
      })
      .expect(201);
    for (const path of [
      '/datasets/' + data._id,
      '/datasets/' + data._id + '/download',
      '/experiments/' + exp._id,
      '/training-runs/' + String(run.body._id),
    ]) {
      await alice.get(prefix + path).expect(404);
    }
    await alice
      .patch(prefix + '/experiments/' + exp._id)
      .set(header)
      .send({ name: 'stolen' })
      .expect(404);
    await alice
      .delete(prefix + '/experiments/' + exp._id)
      .set(header)
      .expect(404);
    await alice
      .delete(prefix + '/datasets/' + data._id)
      .set(header)
      .expect(404);
    await alice
      .post(prefix + '/experiments')
      .set(header)
      .send({ datasetId: data._id })
      .expect(404);
    await alice
      .post(prefix + '/training-runs')
      .set(header)
      .send({ experimentId: exp._id })
      .expect(404);
    for (const path of ['/datasets', '/experiments', '/training-runs']) {
      expect((await alice.get(prefix + path).expect(200)).body.total).toBe(0);
      expect((await admin.get(prefix + path).expect(200)).body.total).toBe(1);
    }
    await admin.get(prefix + '/datasets/' + data._id).expect(200);
    await admin
      .patch(prefix + '/experiments/' + exp._id)
      .set(header)
      .send({ name: 'admin edit', ownerId: a._id })
      .expect(200);
    expect(
      (await bob.get(prefix + '/experiments/' + exp._id).expect(200)).body
        .ownerId,
    ).toBe(b._id);
    await admin
      .delete(prefix + '/datasets/' + data._id)
      .set(header)
      .expect(200);
  });
  it('protects bulk upsert and sync create/update/delete/conflict snapshots', async () => {
    const { a, b, alice, bob, admin } = await actors();
    const data = await dataset(bob);
    const exp = await experiment(bob, data._id);
    await alice
      .post(prefix + '/experiments/bulk')
      .set(header)
      .send([{ clientId: exp.clientId, name: 'stolen' }])
      .expect(404);
    const operations = ['create', 'update', 'delete'].map((action) =>
      op('dataset', data.clientId, action, { name: 'stolen', ownerId: a._id }),
    );
    const denied = await alice
      .post(prefix + '/sync/batch')
      .set(header)
      .send({ operations })
      .expect(201);
    expect(
      denied.body.results.every(
        (item: { status: string }) => item.status === 'error',
      ),
    ).toBe(true);
    expect(JSON.stringify(denied.body)).not.toContain(b._id);
    const own = op('dataset', 'own-client-id', 'create', {
      name: 'Own',
      sourceType: 'generated',
      ownerId: b._id,
    });
    await alice
      .post(prefix + '/sync/batch')
      .set(header)
      .send({ operations: [own] })
      .expect(201);
    await alice
      .post(prefix + '/sync/batch')
      .set(header)
      .send({
        operations: [
          op('dataset', own.entityClientId, 'update', {
            name: 'Updated',
            ownerId: b._id,
          }),
        ],
      })
      .expect(201);
    const changes = await alice.get(prefix + '/sync/changes').expect(200);
    expect(changes.body.changes.datasets).toHaveLength(1);
    expect(changes.body.changes.datasets[0]).toMatchObject({
      ownerId: a._id,
      name: 'Updated',
    });
    expect(
      (await admin.get(prefix + '/sync/changes').expect(200)).body.changes
        .datasets,
    ).toHaveLength(2);
    const duplicate = await alice
      .post(prefix + '/sync/batch')
      .set(header)
      .send({ operations: [own] });
    expect(duplicate.body.results[0].status).toBe('duplicate');
    const other = await bob
      .post(prefix + '/sync/batch')
      .set(header)
      .send({ operations: [{ ...own, entityClientId: 'bob-new' }] });
    expect(other.body.results[0].status).toBe('applied');
  });
  it('revokes sessions immediately when user disabled, version changed, or deleted', async () => {
    await register('a@example.com');
    const alice = await login('a@example.com');
    await db
      .collection('users')
      .updateOne({ email: 'a@example.com' }, { $set: { status: 'disabled' } });
    await alice.get(prefix + '/auth/me').expect(401);
    await request(server)
      .post(prefix + '/auth/login')
      .set(header)
      .send({ email: 'a@example.com', password })
      .expect(401);
    await db
      .collection('users')
      .updateOne({ email: 'a@example.com' }, { $set: { status: 'active' } });
    const second = await login('a@example.com');
    await db
      .collection('users')
      .updateOne({ email: 'a@example.com' }, { $inc: { sessionVersion: 1 } });
    await second.get(prefix + '/auth/me').expect(401);
    const third = await login('a@example.com');
    await db.collection('users').deleteOne({ email: 'a@example.com' });
    await third.get(prefix + '/auth/me').expect(401);
  });
});

describe('Account management and audit', () => {
  it('edits own profile without changing role or exposing password data', async () => {
    const { alice } = await actors();
    await alice.get(prefix + '/users/me').expect(200);
    const updated = await alice
      .post(prefix + '/users/me')
      .set(header)
      .send({ displayName: '  Alice  ' })
      .expect(200);
    expect(updated.body.displayName).toBe('Alice');
    expect(updated.body.role).toBe('user');
    expect(updated.body.passwordHash).toBeUndefined();
    expect(updated.body.sessionVersion).toBeUndefined();
    await alice
      .post(prefix + '/users/me')
      .set(header)
      .send({ role: 'admin' })
      .expect(400);
    await alice
      .post(prefix + '/users/me')
      .set(header)
      .send({ displayName: '   ' })
      .expect(400);
    expect(
      (await alice.get(prefix + '/users/me').expect(200)).body.displayName,
    ).toBe('Alice');
  });
  it('does not expose removed auth or admin user routes', async () => {
    const { a, alice, admin } = await actors();
    for (const agent of [alice, admin]) {
      await agent.get(prefix + '/auth/session').expect(404);
      await agent
        .post(prefix + '/auth/guest')
        .set(header)
        .expect(404);
      await agent.get(prefix + '/users').expect(404);
      await agent.get(prefix + '/users/' + a._id).expect(404);
      await agent
        .patch(prefix + '/users/' + a._id)
        .set(header)
        .send({ role: 'admin' })
        .expect(404);
      await agent
        .delete(prefix + '/users/' + a._id)
        .set(header)
        .expect(404);
      await agent
        .patch(prefix + '/users/me')
        .set(header)
        .send({ displayName: 'Old route' })
        .expect(404);
      await agent
        .patch(prefix + '/users/me/password')
        .set(header)
        .send({ currentPassword: password, newPassword: 'new-password-123' })
        .expect(404);
    }
    expect((await alice.get(prefix + '/users/me').expect(200)).body.role).toBe(
      'user',
    );
  });
  it('changes password, keeps this session, revokes another session and old password', async () => {
    await register('a@example.com');
    const first = await login('a@example.com');
    const second = await login('a@example.com');
    await first
      .post(prefix + '/users/me/password')
      .set(header)
      .send({
        currentPassword: 'wrong-password',
        newPassword: 'new-password-123',
      })
      .expect(401);
    const changed = await first
      .post(prefix + '/users/me/password')
      .set(header)
      .send({ currentPassword: password, newPassword: 'new-password-123' })
      .expect(200);
    expect(changed.body.passwordHash).toBeUndefined();
    await first.get(prefix + '/auth/me').expect(200);
    await second.get(prefix + '/auth/me').expect(401);
    await request(server)
      .post(prefix + '/auth/login')
      .set(header)
      .send({ email: 'a@example.com', password })
      .expect(401);
    await request(server)
      .post(prefix + '/auth/login')
      .set(header)
      .send({ email: 'a@example.com', password: 'new-password-123' })
      .expect(200);
  });
  it('requires password to delete self and soft deletes all three data types', async () => {
    const { b, alice, bob } = await actors();
    const data = await dataset(bob);
    const exp = await experiment(bob, data._id);
    await bob
      .post(prefix + '/training-runs')
      .set(header)
      .send({
        experimentId: exp._id,
        algorithmType: 'linear',
        configSnapshot: {},
      })
      .expect(201);
    await bob
      .delete(prefix + '/users/me')
      .set(header)
      .send({})
      .expect(400);
    await bob
      .delete(prefix + '/users/me')
      .set(header)
      .send({ password: 'wrong-password' })
      .expect(401);
    const response = await bob
      .delete(prefix + '/users/me')
      .set(header)
      .send({ password })
      .expect(200);
    expect(response.headers['set-cookie'][0]).toContain(
      'Expires=Thu, 01 Jan 1970',
    );
    await bob.get(prefix + '/auth/me').expect(401);
    expect(
      await db.collection('users').findOne({ email: 'b@example.com' }),
    ).toBeNull();
    for (const collection of ['datasets', 'experiments', 'trainingRuns']) {
      const record = await db
        .collection(collection)
        .findOne({ ownerId: b._id });
      expect(record?.deletedAt).toBeInstanceOf(Date);
      expect(record?.syncVersion).toBe(2);
    }
    await alice.get(prefix + '/auth/me').expect(200);
  });
  it('protects the last active admin from self-deletion', async () => {
    const admin = await login('admin@example.com');
    await admin
      .delete(prefix + '/users/me')
      .set(header)
      .send({ password })
      .expect(400);
    await admin.get(prefix + '/auth/me').expect(200);
    expect(
      await db
        .collection('users')
        .countDocuments({ role: 'admin', status: 'active' }),
    ).toBe(1);
  });
  it('writes audit events without passwords, hashes or session identifiers', async () => {
    const account = (await register('audit@example.com')).body as {
      _id: string;
    };
    await request(server)
      .post(prefix + '/auth/login')
      .set(header)
      .send({ email: 'missing@example.com', password })
      .expect(401);
    const user = await login('audit@example.com');
    await user
      .post(prefix + '/users/me/password')
      .set(header)
      .send({ currentPassword: password, newPassword: 'audit-new-password' })
      .expect(200);
    await user
      .post(prefix + '/auth/logout')
      .set(header)
      .expect(200);
    const returning = request.agent(server);
    await returning
      .post(prefix + '/auth/login')
      .set(header)
      .send({ email: 'audit@example.com', password: 'audit-new-password' })
      .expect(200);
    await returning
      .delete(prefix + '/users/me')
      .set(header)
      .send({ password: 'audit-new-password' })
      .expect(200);
    const logs = await db.collection('auditLogs').find().toArray();
    expect(logs.map((log) => log.action)).toEqual(
      expect.arrayContaining([
        'register',
        'login.success',
        'login.failure',
        'logout',
        'password.change',
        'account.delete',
      ]),
    );
    for (const log of logs) {
      expect(Object.keys(log).sort()).toEqual(
        ['_id', 'userId', 'action', 'targetId', 'ip', 'at'].sort(),
      );
      expect(log.ip).toBeTruthy();
      expect(log.at).toBeInstanceOf(Date);
    }
    expect(logs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: 'account.delete',
          userId: account._id,
          targetId: account._id,
        }),
      ]),
    );
    const serialized = JSON.stringify(logs);
    for (const secret of [
      password,
      'audit-new-password',
      '$2b$',
      'hq3d.sid',
      'passwordHash',
      'sessionVersion',
    ])
      expect(serialized).not.toContain(secret);
  });
  it('allows owner/admin CSV downloads and denies another user', async () => {
    const { alice, bob, admin } = await actors();
    const upload = await bob
      .post(prefix + '/datasets/upload')
      .set(header)
      .attach('file', Buffer.from('x,y\n1,2\n2,4\n'), 'sample.csv')
      .expect(201);
    const path = prefix + '/datasets/' + String(upload.body._id) + '/download';
    await alice.get(path).expect(404);
    expect((await bob.get(path).expect(200)).text).toContain('1,2');
    expect((await admin.get(path).expect(200)).text).toContain('1,2');
  });
  it('checks sync references, run deletion, ownership in bulk and update payloads', async () => {
    const { a, b, alice, bob, admin } = await actors();
    const data = await dataset(bob);
    const exp = await experiment(bob, data._id);
    const run = await bob
      .post(prefix + '/training-runs')
      .set(header)
      .send({
        experimentId: exp._id,
        algorithmType: 'linear',
        configSnapshot: {},
      })
      .expect(201);
    const bad = [
      op('experiment', 'bad-exp', 'create', {
        name: 'Bad',
        datasetId: data._id,
        algorithm: { type: 'linear', config: {} },
      }),
      op('trainingRun', 'bad-run', 'create', {
        experimentId: exp._id,
        algorithmType: 'linear',
        algorithmVersion: '1',
        configSnapshot: {},
      }),
      op('experiment', exp.clientId, 'update', { ownerId: a._id }),
      op('trainingRun', String(run.body.clientId), 'delete'),
    ];
    const denied = await alice
      .post(prefix + '/sync/batch')
      .set(header)
      .send({ operations: bad })
      .expect(201);
    expect(
      denied.body.results.every(
        (item: { status: string }) => item.status === 'error',
      ),
    ).toBe(true);
    const update = await admin
      .post(prefix + '/sync/batch')
      .set(header)
      .send({
        operations: [
          op('experiment', exp.clientId, 'update', {
            ownerId: a._id,
            name: 'Admin edit',
          }),
        ],
      })
      .expect(201);
    expect(update.body.results[0].status).toBe('applied');
    await bob
      .post(prefix + '/experiments/bulk')
      .set(header)
      .send([{ clientId: exp.clientId, ownerId: a._id, name: 'Bulk edit' }])
      .expect(200);
    expect(
      (await bob.get(prefix + '/experiments/' + exp._id)).body.ownerId,
    ).toBe(b._id);
    const deleted = await bob
      .post(prefix + '/sync/batch')
      .set(header)
      .send({
        operations: [
          op('trainingRun', String(run.body.clientId), 'delete', {
            ownerId: a._id,
          }),
        ],
      })
      .expect(201);
    expect(deleted.body.results[0].status).toBe('applied');
    await bob
      .get(prefix + '/training-runs/' + String(run.body._id))
      .expect(404);
    expect((await bob.get(prefix + '/training-runs')).body.total).toBe(0);
    expect(
      (await bob.get(prefix + '/sync/changes')).body.changes.trainingRuns[0]
        .deletedAt,
    ).toBeTruthy();
  });
});

describe('CSV upload and saved account history', () => {
  it('enforces the configured file limit, .csv extension and valid CSV content', async () => {
    await register('upload@example.com');
    const agent = await login('upload@example.com');
    const initialFiles = await readdir(uploadDir);
    const csv = Buffer.from('x,y\n1,2\n');
    for (const filename of ['fake.txt', 'fake.xlsx', 'fake.csv.exe']) {
      await agent
        .post(prefix + '/datasets/upload')
        .set(header)
        .attach('file', csv, { filename, contentType: 'text/csv' })
        .expect(400);
    }
    await agent
      .post(prefix + '/datasets/upload')
      .set(header)
      .attach('file', csv, { filename: 'image.csv', contentType: 'image/png' })
      .expect(400);
    for (const contents of [
      Buffer.from([0x50, 0x4b, 0, 0]),
      Buffer.from('x,y\n"broken,2\n'),
      Buffer.from('x,y\n1,2,3\n'),
    ]) {
      await agent
        .post(prefix + '/datasets/upload')
        .set(header)
        .attach('file', contents, 'bad.csv')
        .expect(400);
    }
    await agent
      .post(prefix + '/datasets/upload')
      .set(header)
      .expect(400);
    await agent
      .post(prefix + '/datasets/upload')
      .set(header)
      .attach('file', csv, 'a.csv')
      .attach('file', csv, 'b.csv')
      .expect(400);
    const exactLimit = Buffer.from('x,y\n' + '1'.repeat(1017) + ',2\n');
    expect(exactLimit.length).toBe(1024);
    await agent
      .post(prefix + '/datasets/upload')
      .set(header)
      .attach('file', Buffer.concat([exactLimit, Buffer.from('\n')]), 'big.csv')
      .expect(413);
    expect(await db.collection('datasets').countDocuments()).toBe(0);
    expect(await readdir(uploadDir)).toEqual(initialFiles);
    const saved = await agent
      .post(prefix + '/datasets/upload')
      .set(header)
      .attach('file', exactLimit, {
        filename: 'valid.CSV',
        contentType: 'application/octet-stream',
      })
      .expect(201);
    expect(saved.body).toMatchObject({
      sizeBytes: 1024,
      contentType: 'text/csv',
    });
  });

  it('restores saved metrics, model parameters and runs after logging in again', async () => {
    const { a, b, alice, bob } = await actors();
    const data = await dataset(alice);
    const snapshot = {
      name: 'Saved regression',
      datasetId: data._id,
      status: 'completed',
      algorithm: { type: 'linear', config: {} },
      targetColumn: 'y',
      featureColumns: ['x'],
      learningRate: 0.01,
      maxIterations: 1000,
      iterations: 50,
      w: [2],
      b: 1,
      train: { mse: 0.1, rmse: 0.316, mae: 0.2, r2: 0.99 },
      test: { mse: 0.2, rmse: 0.447, mae: 0.3, r2: 0.98 },
      synthetic: {
        kind: 'curved',
        version: 1,
        sampleCount: 100,
        featureCount: 1,
        noise: 2,
        seed: 42,
        trainRatio: 0.8,
      },
      ownerId: b._id,
    };
    const saved = await alice
      .post(prefix + '/experiments')
      .set(header)
      .send(snapshot)
      .expect(201);
    expect(saved.body).toMatchObject({
      ownerId: a._id,
      w: [2],
      train: snapshot.train,
      synthetic: snapshot.synthetic,
    });
    const run = await alice
      .post(prefix + '/training-runs')
      .set(header)
      .send({
        experimentId: saved.body._id,
        algorithmType: 'linear',
        configSnapshot: { learningRate: 0.01 },
        metrics: snapshot.test,
        modelParameters: { w: [2], b: 1 },
        history: [{ step: 50, loss: 0.2, parameters: { w: [2], b: 1 } }],
        ownerId: b._id,
      })
      .expect(201);
    expect(run.body.ownerId).toBe(a._id);
    await alice
      .post(prefix + '/auth/logout')
      .set(header)
      .expect(200);
    const again = await login('a@example.com');
    const restored = await again.get(prefix + '/experiments').expect(200);
    expect(restored.body.items[0]).toMatchObject({
      ownerId: a._id,
      w: [2],
      b: 1,
      iterations: 50,
      train: snapshot.train,
      test: snapshot.test,
    });
    const history = await again
      .get(prefix + '/training-runs')
      .query({ experimentId: saved.body.clientId })
      .expect(200);
    expect(history.body.total).toBe(1);
    expect(history.body.items[0]).toMatchObject({
      ownerId: a._id,
      metrics: snapshot.test,
      modelParameters: { w: [2], b: 1 },
    });
    await again.get(prefix + '/training-runs?experimentId=missing').expect(404);
    expect(
      (await bob.get(prefix + '/experiments').expect(200)).body.total,
    ).toBe(0);
    await bob
      .get(prefix + '/training-runs')
      .query({ experimentId: saved.body.clientId })
      .expect(404);
  });

  it('keeps full snapshots and owner through bulk, PATCH and offline sync', async () => {
    const { a, b, alice, bob } = await actors();
    const csvData = {
      trainX: Array.from({ length: 6000 }, () => [1.123456789, 2.123456789]),
      trainY: Array(6000).fill(3),
      testX: [[4, 5]],
      testY: [6],
    };
    const snapshot = {
      id: 'snapshot-bulk',
      learningReport: { protocol: 'train-validation-test-v1', computeMs: 12.5, setupMs: 1.2,
        reason: 'max-iterations', hypothesis: 'Lower learning rate',
        validation: { mse: 1.5, rmse: 1.225, mae: 1, r2: .8 }, finalTestViewed: true },
      name: 'CSV run',
      algorithm: 'linear',
      dataSource: 'csv',
      csvName: 'data.csv',
      csvData,
      w: [2, 3],
      b: 4,
      iterations: 25,
      learningRate: 0.01,
      maxIterations: 100,
      degree: 2,
      lambda: 0.5,
      sampleCount: 6001,
      featureCount: 2,
      noise: 0,
      seed: 42,
      trainRatio: 0.8,
      train: { mse: 1, rmse: 1, mae: 1, r2: null },
      test: { mse: 2, rmse: 1.414, mae: 1, r2: 0.9 },
      clientCreatedAt: 1234,
      lastMutationId: 'save-1',
      ownerId: b._id,
    };
    expect(Buffer.byteLength(JSON.stringify([snapshot]))).toBeGreaterThan(
      100 * 1024,
    );
    await alice
      .post(prefix + '/experiments/bulk')
      .set(header)
      .send([snapshot])
      .expect(200);
    const saved = await alice
      .get(prefix + '/experiments/snapshot-bulk')
      .expect(200);
    expect(saved.body).toMatchObject({
      ownerId: a._id,
      csvData,
      learningReport: snapshot.learningReport,
      w: [2, 3],
      train: snapshot.train,
      lastMutationId: 'save-1',
      clientCreatedAt: 1234,
    });
    await alice
      .patch(prefix + '/experiments/snapshot-bulk')
      .set(header)
      .send({ w: [5, 6], b: 7, ownerId: b._id })
      .expect(200);
    const syncSnapshot = {
      ...snapshot,
      name: 'Offline run',
      algorithm: { type: 'linear', config: {} },
    };
    const response = await alice
      .post(prefix + '/sync/batch')
      .set(header)
      .send({
        operations: [op('experiment', 'snapshot-sync', 'create', syncSnapshot)],
      })
      .expect(201);
    expect(response.body.results[0].status).toBe('applied');
    const changes = await alice.get(prefix + '/sync/changes').expect(200);
    expect(changes.body.changes.experiments).toHaveLength(2);
    expect(
      changes.body.changes.experiments.find(
        (item: { clientId: string }) => item.clientId === 'snapshot-sync',
      ),
    ).toMatchObject({ ownerId: a._id, csvData, w: [2, 3] });
    expect(
      (await bob.get(prefix + '/sync/changes').expect(200)).body.changes
        .experiments,
    ).toHaveLength(0);
    await bob
      .post(prefix + '/experiments/bulk')
      .set(header)
      .send([{ ...snapshot, name: 'Stolen' }])
      .expect(404);
  });

  it('rejects invalid bulk input before writing and validates list pagination', async () => {
    await register('pagination@example.com');
    const user = await login('pagination@example.com');
    const row = { id: 'not-written', name: 'Valid row', algorithm: 'linear' };

    await user
      .post(prefix + '/experiments/bulk')
      .set(header)
      .send({ experiments: [row] })
      .expect(400);
    await user
      .post(prefix + '/experiments/bulk')
      .set(header)
      .send([row, null])
      .expect(400);
    await user
      .post(prefix + '/experiments/bulk')
      .set(header)
      .send([row, row])
      .expect(400);
    await user.get(prefix + '/experiments/not-written').expect(404);
    for (const path of ['/experiments', '/datasets', '/training-runs']) {
      await user.get(prefix + path + '?page=2abc').expect(400);
      await user.get(prefix + path + '?limit=101').expect(400);
      const result = await user
        .get(prefix + path + '?page=2&limit=10')
        .expect(200);
      expect(result.body).toMatchObject({ page: 2, limit: 10 });
    }
  });

  it('acknowledges a replay after a lost response, rejects stale writes and reports partial success', async () => {
    await register('replay@example.com');
    const user = await login('replay@example.com');
    const bulk = (rows: object[]) =>
      user
        .post(prefix + '/experiments/bulk')
        .set(header)
        .send(rows);
    const first = {
      id: 'shared',
      name: 'Original',
      algorithm: 'linear',
      lastMutationId: 'save-1',
      expectedVersion: 0,
    };
    const second = {
      ...first,
      name: 'Updated',
      lastMutationId: 'save-2',
      expectedVersion: 1,
    };
    const stale = { ...second, name: 'Stale', lastMutationId: 'other-device' };
    const independent = {
      ...first,
      id: 'another',
      lastMutationId: 'save-other',
    };

    await bulk([first]).expect(200);
    const replay = await bulk([first]).expect(200);
    expect(replay.body.items).toEqual([{ id: 'shared', syncVersion: 1 }]);
    const updated = await bulk([second]).expect(200);
    expect(updated.body.items).toEqual([{ id: 'shared', syncVersion: 2 }]);

    const partial = await bulk([stale, independent]).expect(409);
    expect(partial.body).toMatchObject({
      success: false,
      count: 1,
      conflicts: [{ id: 'shared', syncVersion: 2 }],
      items: [{ id: 'another', syncVersion: 1 }],
    });
    const saved = await user.get(prefix + '/experiments/shared').expect(200);
    expect(saved.body).toMatchObject({ name: 'Updated', syncVersion: 2 });
    const repeated = await bulk([independent]).expect(200);
    expect(repeated.body.items).toEqual(partial.body.items);
  });
});
