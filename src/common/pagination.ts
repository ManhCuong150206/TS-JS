import { BadRequestException } from '@nestjs/common';

function positiveInteger(value: unknown, fallback: number, name: string): number {
  if (value === undefined) return fallback;
  const parsed = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  if (typeof parsed !== 'number' || !Number.isSafeInteger(parsed) || parsed < 1) {
    throw new BadRequestException(`${name} phải là số nguyên dương.`);
  }
  return parsed;
}

export function pagination(page: unknown, limit: unknown) {
  const pageNum = positiveInteger(page, 1, 'page');
  const limitNum = positiveInteger(limit, 20, 'limit');
  if (limitNum > 100) throw new BadRequestException('limit tối đa là 100.');
  if (!Number.isSafeInteger((pageNum - 1) * limitNum)) {
    throw new BadRequestException('page vượt giới hạn phân trang.');
  }
  return { page: pageNum, limit: limitNum };
}
