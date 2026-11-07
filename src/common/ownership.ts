import { NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import type { RequestUser } from './auth.guard.js';
export function ownerFilter(user: RequestUser) {
  return user.role === 'admin' ? {} : { ownerId: user.userId };
}
export function idFilter(id: string) {
  if (typeof id !== 'string' || !id)
    throw new NotFoundException('Không tìm thấy dữ liệu');
  return Types.ObjectId.isValid(id)
    ? { $or: [{ _id: id }, { clientId: id }] }
    : { clientId: id };
}
export function assertOwner(
  record: { ownerId?: string } | null,
  user: RequestUser,
) {
  if (!record || (user.role !== 'admin' && record.ownerId !== user.userId)) {
    throw new NotFoundException('Không tìm thấy dữ liệu');
  }
}
// Chặn ghi đè _id, ownerId, timestamps, deletedAt, syncVersion, toán tử Mongo và đường dẫn file.
export function dataFields(
  data: object,
  kind: 'dataset' | 'experiment' | 'trainingRun',
): Record<string, unknown> {
  const fields = {
    dataset: [
      'name',
      'sourceType',
      'originalFileName',
      'contentType',
      'sizeBytes',
      'rowCount',
      'columns',
      'previewRows',
      'generationConfig',
    ],
    experiment: [
      'name',
      'description',
      'status',
      'datasetId',
      'algorithm',
      'targetColumn',
      'featureColumns',
      'preprocessing',
      'split',
    ],
    trainingRun: [
      'experimentId',
      'status',
      'algorithmType',
      'algorithmVersion',
      'configSnapshot',
      'datasetSha256',
      'seed',
      'metrics',
      'modelParameters',
      'history',
      'error',
      'startedAt',
      'completedAt',
    ],
  };
  return Object.fromEntries(
    Object.entries(data).filter(([key]) => fields[kind].includes(key)),
  );
}
