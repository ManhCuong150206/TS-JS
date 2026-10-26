import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SyncService } from './sync.service.js';
import { OptionalAuthGuard, CurrentUser, RequestUser } from '../common/auth.guard.js';
import { SyncBatchRequestDto } from './dto/sync.dto.js';

@Controller('sync')
@UseGuards(OptionalAuthGuard)
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  /**
   * API Gửi hàng loạt thao tác đồng bộ offline lên server (Idempotent + Conflict Handling)
   */
  @Post('batch')
  async batchSync(
    @Body() batchDto: SyncBatchRequestDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.syncService.processBatch(batchDto, user.userId);
  }

  /**
   * API Kéo các thay đổi từ máy chủ về client kể từ thời điểm `since`
   */
  @Get('changes')
  async getChanges(
    @Query('since') since: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.syncService.getChanges(since, user.userId);
  }
}
