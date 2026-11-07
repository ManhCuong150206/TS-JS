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
      .patch(prefix + '/users/me/password')
      .set(header)
      .send({ currentPassword: unicodePassword, newPassword: 'é'.repeat(37) })
      .expect(400);
    await agent
      .patch(prefix + '/users/me/password')
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
  it('edits own profile, validates fields, and protects admin endpoints', async () => {
    const { a, alice, admin } = await actors();
    await alice.get(prefix + '/users/me').expect(200);
    expect(
      (
        await alice
          .patch(prefix + '/users/me')
          .set(header)
          .send({ displayName: '  Alice  ' })
          .expect(200)
      ).body.displayName,
    ).toBe('Alice');
    await alice
      .patch(prefix + '/users/me')
      .set(header)
      .send({ role: 'admin' })
      .expect(400);
    await alice.get(prefix + '/users').expect(403);
    await alice.get(prefix + '/users/' + a._id).expect(403);
    await alice
      .patch(prefix + '/users/' + a._id)
      .set(header)
      .send({ role: 'admin' })
      .expect(403);
    await alice
      .delete(prefix + '/users/' + a._id)
      .set(header)
      .expect(403);
    const list = await admin
      .get(prefix + '/users?page=1&limit=1&search=alice')
      .expect(200);
    expect(list.body).toMatchObject({
      total: 1,
      page: 1,
      limit: 1,
      totalPages: 1,
    });
    expect(list.body.items[0]._id).toBe(a._id);
    expect(JSON.stringify(list.body)).not.toContain('passwordHash');
    await admin.get(prefix + '/users?limit=101').expect(400);
    await admin.get(prefix + '/users?page=0').expect(400);
    await admin.get(prefix + '/users/not-an-id').expect(404);
    await admin
      .patch(prefix + '/users/' + a._id)
      .set(header)
      .send({ role: null })
      .expect(400);
    expect(
      (await admin.get(prefix + '/users?search=%2E%2A').expect(200)).body.total,
    ).toBe(0);
  });
  it('changes password, keeps this session, revokes another session and old password', async () => {
    await register('a@example.com');
    const first = await login('a@example.com');
    const second = await login('a@example.com');
    await first
      .patch(prefix + '/users/me/password')
      .set(header)
      .send({
        currentPassword: 'wrong-password',
        newPassword: 'new-password-123',
      })
      .expect(401);
    const changed = await first
      .patch(prefix + '/users/me/password')
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
  it('admin role/status changes revoke sessions; admin deletion revokes and soft deletes data', async () => {
    const { a, b, alice, bob, admin } = await actors();
    const data = await dataset(bob);
    await admin
      .patch(prefix + '/users/' + a._id)
      .set(header)
      .send({ role: 'admin' })
      .expect(200);
    await alice.get(prefix + '/auth/me').expect(401);
    const promoted = await login('a@example.com');
    await promoted.get(prefix + '/users').expect(200);
    await admin
      .patch(prefix + '/users/' + a._id)
      .set(header)
      .send({ status: 'disabled' })
      .expect(200);
    await promoted.get(prefix + '/auth/me').expect(401);
    await admin
      .delete(prefix + '/users/' + b._id.toUpperCase())
      .set(header)
      .expect(200);
    await bob.get(prefix + '/auth/me').expect(401);
    expect(
      await db.collection('users').findOne({ email: 'b@example.com' }),
    ).toBeNull();
    expect(
      (await db.collection('datasets').findOne({ clientId: data.clientId }))
        ?.deletedAt,
    ).toBeInstanceOf(Date);
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
  it('protects last active admin through self and admin routes', async () => {
    const admin = await login('admin@example.com');
    const me = await admin.get(prefix + '/users/me').expect(200);
    const id = String(me.body._id);
    await admin
      .delete(prefix + '/users/me')
      .set(header)
      .send({ password })
      .expect(400);
    await admin
      .delete(prefix + '/users/' + id)
      .set(header)
      .expect(400);
    await admin
      .patch(prefix + '/users/' + id)
      .set(header)
      .send({ role: 'user' })
      .expect(400);
    await admin
      .patch(prefix + '/users/' + id)
      .set(header)
      .send({ status: 'disabled' })
      .expect(400);
    await admin.get(prefix + '/auth/me').expect(200);
  });
  it('serializes simultaneous admin demotions so one active admin remains', async () => {
    const { a, alice, admin } = await actors();
    const root = await admin.get(prefix + '/users/me').expect(200);
    await admin
      .patch(prefix + '/users/' + a._id)
      .set(header)
      .send({ role: 'admin' })
      .expect(200);
    await alice.get(prefix + '/auth/me').expect(401);
    const promoted = await login('a@example.com');
    const responses = await Promise.all([
      admin
        .patch(prefix + '/users/' + String(root.body._id))
        .set(header)
        .send({ role: 'user' }),
      promoted
        .patch(prefix + '/users/' + a._id)
        .set(header)
        .send({ role: 'user' }),
    ]);
    expect(
      responses.map((response) => response.status).sort((a, b) => a - b),
    ).toEqual([200, 400]);
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
      .patch(prefix + '/users/me/password')
      .set(header)
      .send({ currentPassword: password, newPassword: 'audit-new-password' })
      .expect(200);
    await user
      .post(prefix + '/auth/logout')
      .set(header)
      .expect(200);
    const admin = await login('admin@example.com');
    await admin
      .patch(prefix + '/users/' + account._id)
      .set(header)
      .send({ role: 'admin', status: 'disabled' })
      .expect(200);
    await admin
      .delete(prefix + '/users/' + account._id)
      .set(header)
      .expect(200);
    const logs = await db.collection('auditLogs').find().toArray();
    expect(logs.map((log) => log.action)).toEqual(
      expect.arrayContaining([
        'register',
        'login.success',
        'login.failure',
        'logout',
        'password.change',
        'user.role.change',
        'user.status.change',
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
      .expect(201);
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
