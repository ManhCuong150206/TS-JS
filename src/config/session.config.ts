import session from 'express-session';
import MongoStore from 'connect-mongo';
import { randomBytes } from 'node:crypto';
import type { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { mongoUri } from './database.config.js';

declare module 'express-session' {
  interface SessionData {
    userId: string;
    sessionVersion: number;
  }
}
export const SESSION_COOKIE = 'hq3d.sid';
const WEEK = 7 * 24 * 60 * 60 * 1000;
export function cookieOptions(config: ConfigService) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    secure:
      config.get('NODE_ENV') === 'production' ||
      config.get('COOKIE_SECURE') === 'true',
  };
}
// Điểm duy nhất tạo store: sau này thay Redis tại đây.
export function createSessionStore(config: ConfigService): session.Store {
  if (config.get('NODE_ENV') === 'test') return new session.MemoryStore();
  return MongoStore.create({
    mongoUrl: mongoUri(config),
    collectionName: 'sessions',
    ttl: WEEK / 1000,
    autoRemove: 'native',
  });
}
export function sessionMiddleware(config: ConfigService) {
  let secret = config.get<string>('SESSION_SECRET');
  if (
    config.get('NODE_ENV') === 'production' &&
    (!secret || secret.length < 32)
  ) {
    throw new Error('SESSION_SECRET phải có ít nhất 32 ký tự ở production');
  }
  // Dev thiếu secret: mỗi lần restart sẽ đăng xuất mọi phiên cũ.
  secret ||= randomBytes(32).toString('hex');
  return session({
    name: SESSION_COOKIE,
    secret,
    store: createSessionStore(config),
    resave: false,
    saveUninitialized: false,
    cookie: { ...cookieOptions(config), maxAge: WEEK },
  });
}
export async function destroySession(
  req: Request,
  res: Response,
  config: ConfigService,
) {
  await new Promise<void>((resolve, reject) =>
    req.session.destroy((err: unknown) => (err ? reject(err) : resolve())),
  );
  res.clearCookie(SESSION_COOKIE, cookieOptions(config));
}
export async function saveSession(req: Request) {
  await new Promise<void>((resolve, reject) =>
    req.session.save((err: unknown) => (err ? reject(err) : resolve())),
  );
}
