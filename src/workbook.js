import * as XLSX from 'xlsx';
import { MAX_XLSX_ROWS, buildFilename, generateImeis } from './imei.js';

export function createImeiWorkbook(imeis) {
  if (!Array.isArray(imeis) || imeis.length < 1) {
    throw new TypeError('至少需要一筆 IMEI。');
  }
  if (imeis.length > MAX_XLSX_ROWS) {
    throw new RangeError(`.xlsx 最多只能包含 ${MAX_XLSX_ROWS} 筆資料。`);
  }

  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(imeis.map((imei) => [`IMEI:${imei}`]));
  imeis.forEach((_, index) => {
    sheet[`A${index + 1}`].z = '@';
  });
  sheet['!cols'] = [{ width: 23.375 }];

  XLSX.utils.book_append_sheet(workbook, sheet, 'Sheet1');
  return workbook;
}

export function serializeImeiWorkbook(workbook) {
  return XLSX.write(workbook, {
    type: 'array',
    bookType: 'xlsx',
    bookSST: true,
    compression: true,
  });
}

export function prepareImeiDownload(data, date = new Date()) {
  const imeis = generateImeis(data.startImei, data.quantity);
  return {
    filename: buildFilename(data, date),
    workbook: createImeiWorkbook(imeis),
    imeis,
  };
}

export function downloadImeiWorkbook(data, date = new Date(), writeFile = XLSX.writeFile) {
  const prepared = prepareImeiDownload(data, date);
  writeFile(prepared.workbook, prepared.filename, {
    bookType: 'xlsx',
    bookSST: true,
    compression: true,
  });
  return prepared.filename;
}
