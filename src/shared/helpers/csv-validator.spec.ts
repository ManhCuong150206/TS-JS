import { CsvValidator } from './csv-validator.js';

describe('CSV content validation', () => {
  it('accepts UTF-8 BOM, CRLF, escaped quotes and multiline fields', () => {
    const result = CsvValidator.validate(
      '\uFEFFname,y\r\n"a,""quoted""\r\nname",2\r\n',
    );
    expect(result.isValid).toBe(true);
    expect(result.previewRows[0]).toEqual({ name: 'a,"quoted"\nname', y: 2 });
  });
  it.each([
    '',
    'x,y\n',
    'x\n1\n',
    'x,x\n1,2\n',
    'x,y\n1,2,3\n',
    'x,y\n1\n',
    'x,y\n"unfinished,2\n',
    'x,y\n"one"extra,2\n',
    'x,y\nno"quote,2\n',
    'x,y\n1,\u0000\n',
  ])('rejects malformed CSV: %j', (value) => {
    expect(CsvValidator.validate(value).isValid).toBe(false);
  });
  it('rejects invalid UTF-8 and excessive row counts', () => {
    expect(CsvValidator.validate(Buffer.from([0xff, 0xfe, 0, 0])).isValid).toBe(
      false,
    );
    expect(
      CsvValidator.validate('x,y\n1,2\n3,4\n', { maxRows: 1 }).isValid,
    ).toBe(false);
  });
});
