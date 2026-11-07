import { json } from 'express';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { configureApp } from './common/configure-app.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configureApp(app);
  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(
    `🚀 NestJS API server is running on: http://localhost:${port}/api/v1`,
  );
}
await bootstrap();
