export class CreateDatasetDto {
  clientId?: string;
  name: string;
  sourceType: 'upload' | 'sample' | 'generated';
  originalFileName?: string;
  contentType?: string;
  sizeBytes?: number;
  rowCount?: number;
  columns?: Array<{
    name: string;
    inferredType?: 'number' | 'string' | 'date' | 'boolean' | 'unknown';
    missingCount?: number;
    min?: number;
    max?: number;
    mean?: number;
  }>;
  previewRows?: Array<Record<string, unknown>>;
  generationConfig?: Record<string, unknown>;
  ownerId?: string;
}
