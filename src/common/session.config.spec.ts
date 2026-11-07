import { ConfigService } from '@nestjs/config';
import session from 'express-session';
import {
  cookieOptions,
  createSessionStore,
  sessionMiddleware,
} from './session.config.js';
import { mongoUri } from './database.config.js';

describe('Session configuration', () => {
  it('requires a long production secret before creating a store', () => {
    for (const secret of ['', 'too-short']) {
      const config = new ConfigService({
        NODE_ENV: 'production',
        SESSION_SECRET: secret,
      });
      expect(() => sessionMiddleware(config)).toThrow('SESSION_SECRET');
    }
  });
  it('uses MemoryStore for test and secure cookies only when configured', () => {
    expect(
      createSessionStore(new ConfigService({ NODE_ENV: 'test' })),
    ).toBeInstanceOf(session.MemoryStore);
    expect(
      cookieOptions(
        new ConfigService({ NODE_ENV: 'test', COOKIE_SECURE: 'false' }),
      ),
    ).toMatchObject({ secure: false, httpOnly: true, sameSite: 'lax' });
    expect(
      cookieOptions(new ConfigService({ NODE_ENV: 'production' })).secure,
    ).toBe(true);
    expect(
      cookieOptions(
        new ConfigService({ NODE_ENV: 'development', COOKIE_SECURE: 'true' }),
      ).secure,
    ).toBe(true);
  });
  it('shares Mongo URI resolution and refuses any dev DB in test', () => {
    const safe = 'mongodb://127.0.0.1:27017/hoi-quy-3d-test';
    expect(
      mongoUri(
        new ConfigService({
          NODE_ENV: 'test',
          MONGODB_URI: safe,
          connection_string: 'unused',
        }),
      ),
    ).toBe(safe);
    expect(
      mongoUri(
        new ConfigService({ NODE_ENV: 'test', connection_string: safe }),
      ),
    ).toBe(safe);
    expect(() =>
      mongoUri(
        new ConfigService({
          NODE_ENV: 'test',
          MONGODB_URI: 'mongodb://127.0.0.1:27017/hoi-quy-3d',
        }),
      ),
    ).toThrow('hoi-quy-3d-test');
  });
});
