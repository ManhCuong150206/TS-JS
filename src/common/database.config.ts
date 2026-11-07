import type { ConfigService } from '@nestjs/config';

export function mongoUri(config: ConfigService): string {
  const uri =
    config.get<string>('MONGODB_URI') ||
    config.get<string>('connection_string');
  if (!uri) throw new Error('Thiếu MONGODB_URI hoặc connection_string');
  // Chặn test kết nối nhầm DB dev, kể cả khi chạy test ngoài bộ e2e.
  if (
    config.get('NODE_ENV') === 'test' &&
    new URL(uri).pathname !== '/hoi-quy-3d-test'
  ) {
    throw new Error('Test chỉ được dùng database hoi-quy-3d-test');
  }
  return uri;
}
