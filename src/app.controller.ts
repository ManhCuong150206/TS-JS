import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service.js';
import { Public } from './common/auth.guard.js';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @Public()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  @Public()
  getHealth() {
    return {
      status: 'ok',
      service: 'hoi-quy-3d-api',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    };
  }
}
