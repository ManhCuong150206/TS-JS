import { json } from 'express';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Cấu hình tiền tố phiên bản API theo đặc tả (/api/v1)
  app.setGlobalPrefix('api/v1');
  app.use(json({limit:'10mb'}));

  // Cho phép CORS cho frontend kết nối
  app.enableCors({
    origin: (process.env.CORS_ORIGINS ?? 'http://localhost:4200,http://localhost:4300,http://127.0.0.1:4300').split(','),
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 NestJS API server is running on: http://localhost:${port}/api/v1`);
}

await bootstrap();
