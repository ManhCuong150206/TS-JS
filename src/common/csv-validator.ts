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
    let row: string[] = [];
    let field = '';
    let state: 'plain' | 'quoted' | 'closed' = 'plain';
    const text = csvContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const endField = () => {
      row.push(field.trim());
      field = '';
      state = 'plain';
    };
    const endRow = () => {
      endField();
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
    };

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (state === 'quoted') {
        if (char !== '"') field += char;
        else if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else state = 'closed';
        continue;
      }
      if (char === ',') endField();
      else if (char === '\n') endRow();
      else if (state === 'closed') {
        throw new Error('Có ký tự không hợp lệ sau dấu ngoặc kép đóng.');
      } else if (char === '"') {
        if (field.length)
          throw new Error('Dấu ngoặc kép phải nằm ở đầu trường CSV.');
        state = 'quoted';
      } else field += char;
    }
    if (state === 'quoted')
      throw new Error('Tệp CSV có dấu ngoặc kép chưa đóng.');
    if (field.length || row.length || state === 'closed') endRow();
    return rows;
  }

  /**
   * Infer data type of a value
   */
  private static inferType(
    val: string,
  ): 'number' | 'string' | 'date' | 'boolean' | 'unknown' {
    if (val === '' || val === null || val === undefined) return 'unknown';

    // Boolean
    const lower = val.toLowerCase();
    if (lower === 'true' || lower === 'false') return 'boolean';

    // Number
    const num = Number(val);
    if (!isNaN(num) && isFinite(num)) return 'number';

    // Date
    if (/^\d{4}-\d{2}-\d{2}/.test(val) && !isNaN(Date.parse(val)))
      return 'date';

    return 'string';
  }

  /**
   * Validate CSV buffer/string and produce comprehensive metadata.
   */
  public static validate(
    content: Buffer | string,
    options: { maxRows?: number } = {},
  ): CsvValidationResult {
    const rawBuffer = Buffer.isBuffer(content)
      ? content
      : Buffer.from(content, 'utf-8');
    const sha256 = createHash('sha256').update(rawBuffer).digest('hex');
    let text: string;
    let rows: string[][];
    try {
      // Giải mã nghiêm ngặt: không coi file nhị phân hoặc UTF-8 hỏng là CSV.
      text = new TextDecoder('utf-8', { fatal: true }).decode(rawBuffer);
      // eslint-disable-next-line no-control-regex -- Chặn dữ liệu nhị phân giả CSV.
      if (/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(text)) {
        throw new Error(
          'CSV không được chứa ký tự điều khiển hoặc dữ liệu nhị phân.',
        );
      }
      rows = this.parseCsvLines(text);
    } catch (error) {
      return {
        isValid: false,
        errors: [
          error instanceof TypeError
            ? 'Tệp CSV phải dùng mã hóa UTF-8.'
            : (error as Error).message,
        ],
        columns: [],
        rowCount: 0,
        previewRows: [],
        sha256,
      };
    }

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

    if (rows.length < 2) {
      return {
        isValid: false,
        errors: [
          'Tệp CSV phải có ít nhất 1 dòng tiêu đề (header) và 1 dòng dữ liệu.',
        ],
        columns: [],
        rowCount: 0,
        previewRows: [],
        sha256,
      };
    }

    const header = rows[0].map((h) => h.trim());
    if (header.length < 2)
      errors.push('CSV hồi quy phải có ít nhất 2 cột (đặc trưng và mục tiêu).');
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
      errors.push(
        `Số lượng dòng (${rowCount}) vượt quá giới hạn cho phép (${maxRows} dòng).`,
      );
    }

    // Inspect columns
    const columns: ColumnAnalysis[] = header.map((name) => ({
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
      if (row.length !== header.length) {
        errors.push(
          `Dòng dữ liệu ${r + 1} có ${row.length} cột; cần ${header.length} cột.`,
        );
        break;
      }
      const rowObj: Record<string, unknown> = {};

      for (let c = 0; c < header.length; c++) {
        const val = row[c] ?? '';
        const colName = header[c];

        if (
          val === '' ||
          val === 'null' ||
          val === 'undefined' ||
          val === 'NaN'
        ) {
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
        // const nStr = typeCounts[c].string || 0; // Removed unused variable
        const nBool = typeCounts[c].boolean || 0;
        const nDate = typeCounts[c].date || 0;

        // If >= 80% are numbers, infer as number
        if (nNum / totalNonMissing >= 0.8) {
          columns[c].inferredType = 'number';
          if (numericCounts[c] > 0) {
            columns[c].mean = Number(
              (sumValues[c] / numericCounts[c]).toFixed(4),
            );
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
