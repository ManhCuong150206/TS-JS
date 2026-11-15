import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Request, Response, NextFunction } from 'express';
import { sessionMiddleware } from './session.config.js';

export function configureApp(app: NestExpressApplication) {
  const config = app.get(ConfigService);
  app.setGlobalPrefix('api/v1');
  if (config.get('TRUST_PROXY') === 'true') app.set('trust proxy', 1);
  const origins = (
    config.get<string>('CORS_ORIGINS') ||
    'http://localhost:4200,http://localhost:5173'
  )
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (origins.includes('*')) throw new Error('CORS_ORIGINS không được chứa *');
  // Header tùy biến buộc browser preflight; chỉ origin trong allowlist được CORS cho phép.
  app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    if (origin && !origins.includes(origin)) {
      res
        .status(403)
        .json({ statusCode: 403, message: 'Origin không được phép' });
      return;
    }
    next();
  });
  app.enableCors({
    origin: origins,
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: ['Content-Type', 'X-Requested-With'],
  });
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (
      ['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method) &&
      req.get('X-Requested-With') !== 'XMLHttpRequest'
    ) {
      res.status(403).json({
        statusCode: 403,
        message: 'Thiếu header X-Requested-With: XMLHttpRequest',
      });
      return;
    }
    next();
  });
  app.use(sessionMiddleware(config));
  // Snapshot kết quả có thể chứa ma trận CSV; mặc định 100 KiB của Express quá nhỏ.
  app.useBodyParser('json', { limit: '10mb' });
}
