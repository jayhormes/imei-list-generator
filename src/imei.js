export const MAX_XLSX_ROWS = 1_048_576;

export const EXAMPLE_INPUT = Object.freeze({
  projectCode: 'AW-BM497SM',
  icCode: 'XT8816',
  tac: '86768903',
  startImei: '86768903017588',
  endImei: '86768903017987',
  quantity: '400',
});

const CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const IMEI_PATTERN = /^\d{15}$/;
const TAC_PATTERN = /^\d{8}$/;
const BODY_PATTERN = /^\d{14}$/;

function sumDigits(value) {
  return value > 9 ? value - 9 : value;
}

export function calculateCheckDigit(body) {
  const normalized = String(body);

  if (!BODY_PATTERN.test(normalized)) {
    throw new TypeError('IMEI 主體必須是 14 位數字。');
  }

  const sum = [...normalized].reduce((total, character, index) => {
    const digit = Number(character);
    const weighted = index % 2 === 1 ? digit * 2 : digit;
    return total + sumDigits(weighted);
  }, 0);

  return String((10 - (sum % 10)) % 10);
}

export function buildImei(body) {
  const normalized = String(body);
  return `${normalized}${calculateCheckDigit(normalized)}`;
}

export function isValidImei(imei) {
  const normalized = String(imei);
  return (
    IMEI_PATTERN.test(normalized) &&
    calculateCheckDigit(normalized.slice(0, 14)) === normalized.at(-1)
  );
}

function normalizeInput(rawInput) {
  return {
    projectCode: String(rawInput.projectCode ?? '').trim(),
    icCode: String(rawInput.icCode ?? '').trim(),
    tac: String(rawInput.tac ?? '').trim(),
    startImei: String(rawInput.startImei ?? '').trim(),
    endImei: String(rawInput.endImei ?? '').trim(),
    quantity: String(rawInput.quantity ?? '').trim(),
  };
}

function validateCode(value, label) {
  if (!value) return `請輸入${label}。`;
  if (!CODE_PATTERN.test(value)) {
    return `${label}只能使用英數、連字號、底線或小數點。`;
  }
  return '';
}

function validateImeiBodyField(value, label) {
  if (!value) return `請輸入${label}。`;
  if (!BODY_PATTERN.test(value)) return `${label} 必須是 14 位數字（不含查驗碼）。`;
  return '';
}

export function validateGenerationInput(rawInput) {
  const input = normalizeInput(rawInput);
  const errors = {};

  errors.projectCode = validateCode(input.projectCode, '專案代號');
  errors.icCode = validateCode(input.icCode, 'IC 代號');

  if (!input.tac) errors.tac = '請輸入 TAC。';
  else if (!TAC_PATTERN.test(input.tac)) errors.tac = 'TAC 必須是 8 位數字。';

  errors.startImei = validateImeiBodyField(input.startImei, '起始 IMEI');
  errors.endImei = validateImeiBodyField(input.endImei, '結尾 IMEI');

  let quantity = null;
  if (!input.quantity) errors.quantity = '請輸入數量。';
  else if (!/^\d+$/.test(input.quantity)) errors.quantity = '數量必須是正整數。';
  else {
    quantity = Number(input.quantity);
    if (quantity < 1) errors.quantity = '數量至少為 1。';
    else if (quantity > MAX_XLSX_ROWS) {
      errors.quantity = `.xlsx 單一工作表最多 ${MAX_XLSX_ROWS.toLocaleString('en-US')} 筆。`;
    }
  }

  const tacIsValid = !errors.tac;
  const startIsValid = !errors.startImei;
  const endIsValid = !errors.endImei;

  if (tacIsValid && startIsValid && !input.startImei.startsWith(input.tac)) {
    errors.startImei = '起始 IMEI 的前 8 碼與 TAC 不一致。';
  }
  if (tacIsValid && endIsValid && !input.endImei.startsWith(input.tac)) {
    errors.endImei = '結尾 IMEI 的前 8 碼與 TAC 不一致。';
  }

  let expectedCount = null;
  if (startIsValid && endIsValid) {
    const startBody = BigInt(input.startImei);
    const endBody = BigInt(input.endImei);

    if (endBody < startBody) {
      errors.endImei = '結尾 IMEI 必須大於或等於起始 IMEI。';
    } else {
      expectedCount = Number(endBody - startBody + 1n);
      if (!errors.quantity && quantity !== expectedCount) {
        errors.quantity = `依起訖 IMEI 計算應為 ${expectedCount.toLocaleString('en-US')} 筆。`;
      }
    }
  }

  Object.keys(errors).forEach((key) => {
    if (!errors[key]) delete errors[key];
  });

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    expectedCount,
    data: {
      ...input,
      quantity,
    },
  };
}

export function generateImeis(startImeiBody, quantity) {
  if (!BODY_PATTERN.test(String(startImeiBody))) {
    throw new TypeError('起始 IMEI 必須是 14 位數字（不含查驗碼）。');
  }
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_XLSX_ROWS) {
    throw new RangeError(`數量必須介於 1 與 ${MAX_XLSX_ROWS} 之間。`);
  }

  const startBody = BigInt(startImeiBody);
  return Array.from({ length: quantity }, (_, index) => {
    const body = (startBody + BigInt(index)).toString().padStart(14, '0');
    if (body.length !== 14) throw new RangeError('IMEI 已超出 14 位主體範圍。');
    return buildImei(body);
  });
}

export function getImeiPreview(startImeiBody, quantity, headCount = 5, tailCount = 2) {
  const imeis = generateImeis(startImeiBody, quantity);
  if (imeis.length <= headCount + tailCount) {
    return imeis.map((imei, index) => ({ index: index + 1, imei }));
  }

  return [
    ...imeis.slice(0, headCount).map((imei, index) => ({ index: index + 1, imei })),
    { index: null, imei: null },
    ...imeis.slice(-tailCount).map((imei, index) => ({
      index: imeis.length - tailCount + index + 1,
      imei,
    })),
  ];
}

export function formatDateForFilename(date = new Date()) {
  const year = String(date.getFullYear()).slice(-2).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

export function buildFilename(data, date = new Date()) {
  return `${data.projectCode}_${data.icCode}_${data.quantity}pcs_${formatDateForFilename(date)}.xlsx`;
}
