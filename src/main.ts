import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Cấu hình tiền tố phiên bản API theo đặc tả (/api/v1)
  app.setGlobalPrefix('api/v1');

  // Cho phép CORS cho frontend kết nối
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 NestJS API server is running on: http://localhost:${port}/api/v1`);
}

await bootstrap();
