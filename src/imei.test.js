import { describe, expect, it } from 'vitest';
import {
  EXAMPLE_INPUT,
  MAX_XLSX_ROWS,
  buildFilename,
  buildImei,
  calculateCheckDigit,
  formatDateForFilename,
  generateImeis,
  getImeiPreview,
  isValidImei,
  validateGenerationInput,
} from './imei.js';

describe('IMEI Luhn 規則', () => {
  it('會算出範例起訖 IMEI 的查驗碼', () => {
    expect(calculateCheckDigit('86768903017588')).toBe('1');
    expect(calculateCheckDigit('86768903017987')).toBe('5');
    expect(buildImei('86768903017589')).toBe('867689030175899');
  });

  it('拒絕不是 14 位數的 IMEI 主體', () => {
    expect(() => calculateCheckDigit('123')).toThrow(TypeError);
    expect(() => calculateCheckDigit('8690780301676A')).toThrow('14 位數字');
  });

  it('能辨識有效與無效的完整 IMEI', () => {
    expect(isValidImei(buildImei(EXAMPLE_INPUT.startImei))).toBe(true);
    expect(isValidImei('867689030175882')).toBe(false);
    expect(isValidImei('not-an-imei')).toBe(false);
  });
});

describe('輸入交叉驗證', () => {
  it('接受新版範例資料並推算 400 筆', () => {
    const result = validateGenerationInput(EXAMPLE_INPUT);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual({});
    expect(result.expectedCount).toBe(400);
    expect(result.data.quantity).toBe(400);
  });

  it('會清除文字欄位前後空白', () => {
    const result = validateGenerationInput({
      ...EXAMPLE_INPUT,
      projectCode: '  AW-BM497SM ',
      icCode: ' XT8816  ',
    });
    expect(result.valid).toBe(true);
    expect(result.data.projectCode).toBe('AW-BM497SM');
    expect(result.data.icCode).toBe('XT8816');
  });

  it('要求所有欄位', () => {
    const result = validateGenerationInput({});
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual({
      projectCode: '請輸入專案代號。',
      icCode: '請輸入IC 代號。',
      tac: '請輸入 TAC。',
      startImei: '請輸入起始 IMEI。',
      endImei: '請輸入結尾 IMEI。',
      quantity: '請輸入數量。',
    });
  });

  it.each([
    ['projectCode', 'AW BM', '專案代號只能使用英數、連字號、底線或小數點。'],
    ['icCode', '/CFB', 'IC 代號只能使用英數、連字號、底線或小數點。'],
    ['tac', '8690780', 'TAC 必須是 8 位數字。'],
    ['startImei', '8676890301758', '起始 IMEI 必須是 14 位數字（不含查驗碼）。'],
    ['endImei', '867689030179875', '結尾 IMEI 必須是 14 位數字（不含查驗碼）。'],
    ['quantity', '2.5', '數量必須是正整數。'],
    ['quantity', '0', '數量至少為 1。'],
    [
      'quantity',
      String(MAX_XLSX_ROWS + 1),
      '.xlsx 單一工作表最多 1,048,576 筆。',
    ],
  ])('拒絕 %s 的錯誤格式', (field, value, expectedMessage) => {
    const result = validateGenerationInput({ ...EXAMPLE_INPUT, [field]: value });
    expect(result.valid).toBe(false);
    expect(result.errors[field]).toBe(expectedMessage);
  });

  it('拒絕與 TAC 不一致的起訖 IMEI', () => {
    const result = validateGenerationInput({ ...EXAMPLE_INPUT, tac: '12345678' });
    expect(result.errors.startImei).toContain('與 TAC 不一致');
    expect(result.errors.endImei).toContain('與 TAC 不一致');
  });

  it('拒絕反向範圍', () => {
    const result = validateGenerationInput({
      ...EXAMPLE_INPUT,
      startImei: EXAMPLE_INPUT.endImei,
      endImei: EXAMPLE_INPUT.startImei,
    });
    expect(result.errors.endImei).toContain('大於或等於');
    expect(result.expectedCount).toBeNull();
  });

  it('拒絕與起訖範圍不一致的數量', () => {
    const result = validateGenerationInput({ ...EXAMPLE_INPUT, quantity: '399' });
    expect(result.errors.quantity).toBe('依起訖 IMEI 計算應為 400 筆。');
  });
});

describe('批次序列與檔名', () => {
  it('遞增前 14 碼並逐筆重算查驗碼', () => {
    const imeis = generateImeis(EXAMPLE_INPUT.startImei, 3);
    expect(imeis).toEqual([
      '867689030175881',
      '867689030175899',
      '867689030175907',
    ]);
    expect(imeis.every(isValidImei)).toBe(true);
  });

  it('拒絕無效的起始值與數量', () => {
    expect(() => generateImeis('867689030175881', 1)).toThrow('14 位數字');
    expect(() => generateImeis(EXAMPLE_INPUT.startImei, 0)).toThrow(RangeError);
    expect(() => generateImeis(EXAMPLE_INPUT.startImei, MAX_XLSX_ROWS + 1)).toThrow(RangeError);
  });

  it('拒絕超過 14 位 IMEI 主體的序列', () => {
    expect(() => generateImeis('99999999999999', 2)).toThrow('超出 14 位');
  });

  it('短序列預覽全部，長序列預覽首尾與省略列', () => {
    expect(getImeiPreview(EXAMPLE_INPUT.startImei, 2)).toHaveLength(2);
    const preview = getImeiPreview(EXAMPLE_INPUT.startImei, 10, 2, 2);
    expect(preview).toHaveLength(5);
    expect(preview[2]).toEqual({ index: null, imei: null });
    expect(preview.at(-1).index).toBe(10);
  });

  it('使用本地日期建立與範例相同規則的檔名', () => {
    const date = new Date(2019, 3, 3, 12);
    expect(formatDateForFilename(date)).toBe('190403');
    expect(buildFilename({ ...EXAMPLE_INPUT, quantity: 400 }, date)).toBe(
      'AW-BM497SM_XT8816_400pcs_190403.xlsx',
    );
  });
});
