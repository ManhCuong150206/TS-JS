import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Cấu hình tiền tố phiên bản API theo đặc tả (/api/v1)
  app.setGlobalPrefix('api/v1');

  // Frontend production được phục vụ cùng origin bởi Nginx; chỉ cho phép dev origin.
  const corsOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({
    origin: corsOrigins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: false,
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 NestJS API server is running on: http://localhost:${port}/api/v1`);
}

await bootstrap();
