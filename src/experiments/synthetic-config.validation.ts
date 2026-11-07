import { BadRequestException } from '@nestjs/common';

// Phải khớp với enum của SyntheticConfig schema
export const SYNTHETIC_KINDS = ['curved'] as const;

const inRange = (x: unknown, min: number, max: number): boolean =>
    typeof x === 'number' && Number.isFinite(x) && x >= min && x <= max;

export function validateSyntheticConfig(value: unknown): void {
    if (value === undefined || value === null) return; // dữ liệu cũ không có synthetic

    const bad = () => new BadRequestException('Cấu hình synthetic không hợp lệ.');
    if (typeof value !== 'object' || Array.isArray(value)) throw bad();

    const s = value as Record<string, unknown>;
    if (!(SYNTHETIC_KINDS as readonly unknown[]).includes(s.kind)) throw bad();
    if ((s.version ?? 1) !== 1) throw bad();

    if (
        !inRange(s.sampleCount, 2, 1_000_000) || !Number.isInteger(s.sampleCount) ||
        !inRange(s.featureCount, 1, 1000) || !Number.isInteger(s.featureCount) ||
        !inRange(s.noise, 0, 50) ||
        !Number.isSafeInteger(s.seed) ||
        !inRange(s.trainRatio, 0.5, 0.95) // giả định, xem lưu ý bên dưới
    ) {
        throw bad();
    }
}