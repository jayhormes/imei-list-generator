import { describe, expect, it, vi } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import * as XLSX from 'xlsx';
import { EXAMPLE_INPUT, MAX_XLSX_ROWS, generateImeis } from './imei.js';
import {
  createImeiWorkbook,
  downloadImeiWorkbook,
  prepareImeiDownload,
  serializeImeiWorkbook,
} from './workbook.js';

describe('Excel 97–2003 活頁簿', () => {
  it('建立與範例相同的三個工作表及儲存格格式', () => {
    const workbook = createImeiWorkbook([
      '867689030175881',
      '867689030175899',
    ]);

    expect(workbook.SheetNames).toEqual(['Sheet1']);
    expect(workbook.Sheets.Sheet1.A1.v).toBe('IMEI:867689030175881');
    expect(workbook.Sheets.Sheet1.A2.v).toBe('IMEI:867689030175899');
    expect(workbook.Sheets.Sheet1['!ref']).toBe('A1:A2');
    expect(workbook.Sheets.Sheet1.A1.z).toBe('@');
    expect(workbook.Sheets.Sheet1['!cols']).toEqual([{ width: 23.375 }]);
  });

  it('輸出真正的 ZIP/Open XML .xlsx 並可再次讀取', () => {
    const workbook = createImeiWorkbook(['867689030175881']);
    const bytes = serializeImeiWorkbook(workbook);
    const byteView = new Uint8Array(bytes);

    expect([...byteView.slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
    const parsed = XLSX.read(bytes, { type: 'array', cellStyles: true });
    expect(parsed.SheetNames).toEqual(['Sheet1']);
    expect(parsed.Sheets.Sheet1.A1.v).toBe('IMEI:867689030175881');
    expect(parsed.Sheets.Sheet1.A1.z).toBe('@');
  });

  // 範例檔不入版控（.gitignore 排除 example/），CI 上自動跳過
  const examplePath = new URL(
    '../example/AW-BM497SM_XT8816_400pcs_190930.xlsx',
    import.meta.url,
  );
  it.skipIf(!existsSync(examplePath))('400 筆輸出內容逐格符合新版 XLSX 範例檔', () => {
    const example = XLSX.read(readFileSync(examplePath), { cellStyles: true });
    const generated = XLSX.read(
      serializeImeiWorkbook(
        createImeiWorkbook(generateImeis(EXAMPLE_INPUT.startImei, 400)),
      ),
      { type: 'array', cellStyles: true },
    );
    const exampleRows = XLSX.utils.sheet_to_json(example.Sheets.Sheet1, { header: 1 });
    const generatedRows = XLSX.utils.sheet_to_json(generated.Sheets.Sheet1, { header: 1 });

    expect(generated.SheetNames).toEqual(example.SheetNames);
    expect(generatedRows).toEqual(exampleRows);
    expect(generated.Sheets.Sheet1.A1.z).toBe(example.Sheets.Sheet1.A1.z);
    expect(generated.Sheets.Sheet1['!cols'][0].width).toBe(
      example.Sheets.Sheet1['!cols'][0].width,
    );
  });

  it('準備範例序列、活頁簿與指定日期檔名', () => {
    const prepared = prepareImeiDownload(
      { ...EXAMPLE_INPUT, quantity: 3 },
      new Date(2019, 8, 30),
    );
    expect(prepared.filename).toBe('AW-BM497SM_XT8816_3pcs_190930.xlsx');
    expect(prepared.imeis).toHaveLength(3);
    expect(prepared.workbook.Sheets.Sheet1.A3.v).toBe('IMEI:867689030175907');
  });

  it('透過注入的寫檔函式觸發 XLSX 下載', () => {
    const writeFile = vi.fn();
    const filename = downloadImeiWorkbook(
      { ...EXAMPLE_INPUT, quantity: 1 },
      new Date(2019, 8, 30),
      writeFile,
    );
    expect(filename).toBe('AW-BM497SM_XT8816_1pcs_190930.xlsx');
    expect(writeFile).toHaveBeenCalledOnce();
    expect(writeFile.mock.calls[0][2]).toEqual({
      bookType: 'xlsx',
      bookSST: true,
      compression: true,
    });
  });

  it('拒絕空資料與超過舊式工作表上限的資料', () => {
    expect(() => createImeiWorkbook([])).toThrow('至少需要一筆');
    expect(() => createImeiWorkbook(new Array(MAX_XLSX_ROWS + 1))).toThrow(RangeError);
    expect(() => createImeiWorkbook('not-an-array')).toThrow(TypeError);
  });
});
