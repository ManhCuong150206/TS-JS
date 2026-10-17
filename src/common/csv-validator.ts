import { createHash } from 'node:crypto';

export interface ColumnAnalysis {
  name: string;
  inferredType: 'number' | 'string' | 'date' | 'boolean' | 'unknown';
  missingCount: number;
  min?: number;
  max?: number;
  mean?: number;
  count: number;
}

export interface CsvValidationResult {
  isValid: boolean;
  errors: string[];
  columns: ColumnAnalysis[];
  rowCount: number;
  previewRows: Array<Record<string, unknown>>;
  sha256: string;
}

/**
 * Standard CSV parser & validator adhering to RFC 4180 principles.
 * Handles quoted fields, delimiters, commas inside quotes, CRLF/LF newlines.
 */
export class CsvValidator {
  /**
   * Parse a CSV string into an array of string rows.
   */
  public static parseCsvLines(csvContent: string): string[][] {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentField = '';
    let inQuotes = false;

    // Normalize newlines to LF
    const text = csvContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (inQuotes) {
        if (char === '"') {
          if (nextChar === '"') {
            currentField += '"';
            i++; // Skip escaped quote
          } else {
            inQuotes = false;
          }
        } else {
          currentField += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === ',') {
          currentRow.push(currentField.trim());
          currentField = '';
        } else if (char === '\n') {
          currentRow.push(currentField.trim());
          // Only add non-empty rows
          if (currentRow.some(col => col.length > 0)) {
            rows.push(currentRow);
          }
          currentRow = [];
          currentField = '';
        } else {
          currentField += char;
        }
      }
    }

    if (currentField.length > 0 || currentRow.length > 0) {
      currentRow.push(currentField.trim());
      if (currentRow.some(col => col.length > 0)) {
        rows.push(currentRow);
      }
    }

    return rows;
  }

  /**
   * Infer data type of a value
   */
  private static inferType(val: string): 'number' | 'string' | 'date' | 'boolean' | 'unknown' {
    if (val === '' || val === null || val === undefined) return 'unknown';

    // Boolean
    const lower = val.toLowerCase();
    if (lower === 'true' || lower === 'false') return 'boolean';

    // Number
    const num = Number(val);
    if (!isNaN(num) && isFinite(num)) return 'number';

    // Date
    if (/^\d{4}-\d{2}-\d{2}/.test(val) && !isNaN(Date.parse(val))) return 'date';

    return 'string';
  }

  /**
   * Validate CSV buffer/string and produce comprehensive metadata.
   */
  public static validate(
    content: Buffer | string,
    options: { maxRows?: number } = {}
  ): CsvValidationResult {
    const rawBuffer = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf-8');
    const sha256 = createHash('sha256').update(rawBuffer).digest('hex');
    const text = rawBuffer.toString('utf-8');

    const errors: string[] = [];
    if (!text || text.trim().length === 0) {
      return {
        isValid: false,
        errors: ['Tệp CSV rỗng.'],
        columns: [],
        rowCount: 0,
        previewRows: [],
        sha256,
      };
    }

    const rows = this.parseCsvLines(text);
    if (rows.length < 2) {
      return {
        isValid: false,
        errors: ['Tệp CSV phải có ít nhất 1 dòng tiêu đề (header) và 1 dòng dữ liệu.'],
        columns: [],
        rowCount: 0,
        previewRows: [],
        sha256,
      };
    }

    const header = rows[0].map(h => h.trim());
    // Check duplicate headers
    const headerSet = new Set<string>();
    for (const h of header) {
      if (!h) {
        errors.push('Tên cột không được để trống.');
      } else if (headerSet.has(h)) {
        errors.push(`Phát hiện tên cột bị trùng lặp: "${h}".`);
      } else {
        headerSet.add(h);
      }
    }

    const maxRows = options.maxRows ?? 50000;
    const dataRows = rows.slice(1);
    const rowCount = dataRows.length;

    if (rowCount > maxRows) {
      errors.push(`Số lượng dòng (${rowCount}) vượt quá giới hạn cho phép (${maxRows} dòng).`);
    }

    // Inspect columns
    const columns: ColumnAnalysis[] = header.map(name => ({
      name,
      inferredType: 'unknown',
      missingCount: 0,
      min: undefined,
      max: undefined,
      mean: undefined,
      count: 0,
    }));

    const typeCounts: Record<number, Record<string, number>> = {};
    const sumValues: Record<number, number> = {};
    const numericCounts: Record<number, number> = {};

    for (let c = 0; c < header.length; c++) {
      typeCounts[c] = { number: 0, string: 0, boolean: 0, date: 0 };
      sumValues[c] = 0;
      numericCounts[c] = 0;
    }

    const previewRows: Array<Record<string, unknown>> = [];

    for (let r = 0; r < rowCount; r++) {
      const row = dataRows[r];
      const rowObj: Record<string, unknown> = {};

      for (let c = 0; c < header.length; c++) {
        const val = row[c] ?? '';
        const colName = header[c];

        if (val === '' || val === 'null' || val === 'undefined' || val === 'NaN') {
          columns[c].missingCount++;
          rowObj[colName] = null;
        } else {
          columns[c].count++;
          const type = this.inferType(val);
          typeCounts[c][type] = (typeCounts[c][type] || 0) + 1;

          if (type === 'number') {
            const num = Number(val);
            numericCounts[c]++;
            sumValues[c] += num;
            if (columns[c].min === undefined || num < columns[c].min!) {
              columns[c].min = num;
            }
            if (columns[c].max === undefined || num > columns[c].max!) {
              columns[c].max = num;
            }
            rowObj[colName] = num;
          } else if (type === 'boolean') {
            rowObj[colName] = val.toLowerCase() === 'true';
          } else {
            rowObj[colName] = val;
          }
        }
      }

      // Keep up to 20 preview rows
      if (r < 20) {
        previewRows.push(rowObj);
      }
    }

    // Determine inferred type for each column
    for (let c = 0; c < header.length; c++) {
      const totalNonMissing = columns[c].count;
      if (totalNonMissing === 0) {
        columns[c].inferredType = 'unknown';
      } else {
        const nNum = typeCounts[c].number || 0;
        const nStr = typeCounts[c].string || 0;
        const nBool = typeCounts[c].boolean || 0;
        const nDate = typeCounts[c].date || 0;

        // If >= 80% are numbers, infer as number
        if (nNum / totalNonMissing >= 0.8) {
          columns[c].inferredType = 'number';
          if (numericCounts[c] > 0) {
            columns[c].mean = Number((sumValues[c] / numericCounts[c]).toFixed(4));
          }
        } else if (nBool / totalNonMissing >= 0.8) {
          columns[c].inferredType = 'boolean';
        } else if (nDate / totalNonMissing >= 0.8) {
          columns[c].inferredType = 'date';
        } else {
          columns[c].inferredType = 'string';
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      columns,
      rowCount,
      previewRows,
      sha256,
    };
  }
}
