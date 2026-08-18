import {
  EXAMPLE_INPUT,
  buildFilename,
  getImeiPreview,
  validateGenerationInput,
} from './imei.js';
import { downloadImeiWorkbook } from './workbook.js';

const FIELD_IDS = {
  projectCode: 'project-code',
  icCode: 'ic-code',
  tac: 'tac',
  startImei: 'start-imei',
  endImei: 'end-imei',
  quantity: 'quantity',
};

function readForm(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function updateFieldErrors(documentRoot, errors, revealErrors) {
  Object.entries(FIELD_IDS).forEach(([name, id]) => {
    const input = documentRoot.getElementById(id);
    const errorElement = documentRoot.getElementById(`${id}-error`);
    const message = revealErrors ? errors[name] ?? '' : '';
    input.setAttribute('aria-invalid', message ? 'true' : 'false');
    errorElement.textContent = message;
  });
}

function renderPreview(documentRoot, result, now) {
  const empty = documentRoot.getElementById('empty-preview');
  const content = documentRoot.getElementById('preview-content');
  const badge = documentRoot.getElementById('validity-badge');

  if (!result.valid) {
    empty.hidden = false;
    content.hidden = true;
    badge.textContent = '等待有效資料';
    badge.classList.remove('is-valid');
    return;
  }

  const { data } = result;
  empty.hidden = true;
  content.hidden = false;
  badge.textContent = '資料有效';
  badge.classList.add('is-valid');

  documentRoot.getElementById('summary-quantity').textContent =
    `${data.quantity.toLocaleString('en-US')} PCS`;
  documentRoot.getElementById('summary-range').textContent =
    `${data.startImei} — ${data.endImei}（14 碼）`;
  documentRoot.getElementById('summary-filename').textContent = buildFilename(data, now());

  const rows = documentRoot.getElementById('preview-rows');
  rows.replaceChildren();
  getImeiPreview(data.startImei, data.quantity).forEach((item) => {
    const row = documentRoot.createElement('li');
    if (item.index === null) {
      row.className = 'ellipsis-row';
      row.innerHTML = '<span>⋯</span><code>中間資料依序產生</code>';
    } else {
      const number = documentRoot.createElement('span');
      const value = documentRoot.createElement('code');
      number.textContent = String(item.index);
      value.textContent = `IMEI:${item.imei}`;
      row.append(number, value);
    }
    rows.append(row);
  });
}

export function initApp(
  documentRoot = document,
  { download = downloadImeiWorkbook, now = () => new Date() } = {},
) {
  const form = documentRoot.getElementById('imei-form');
  const generateButton = documentRoot.getElementById('generate-button');
  const status = documentRoot.getElementById('form-status');
  let hasInteracted = false;

  const refresh = ({ revealErrors = hasInteracted } = {}) => {
    const result = validateGenerationInput(readForm(form));
    updateFieldErrors(documentRoot, result.errors, revealErrors);
    generateButton.disabled = !result.valid;
    renderPreview(documentRoot, result, now);
    return result;
  };

  form.addEventListener('input', () => {
    hasInteracted = true;
    status.textContent = '';
    status.className = 'form-status';
    refresh();
  });

  documentRoot.getElementById('fill-example').addEventListener('click', () => {
    Object.entries(FIELD_IDS).forEach(([name, id]) => {
      documentRoot.getElementById(id).value = EXAMPLE_INPUT[name];
    });
    hasInteracted = true;
    status.textContent = '已帶入範例資料，可直接驗證並下載。';
    status.className = 'form-status';
    refresh();
  });

  documentRoot.getElementById('clear-form').addEventListener('click', () => {
    form.reset();
    hasInteracted = false;
    status.textContent = '';
    status.className = 'form-status';
    refresh({ revealErrors: false });
    documentRoot.getElementById('project-code').focus();
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    hasInteracted = true;
    const result = refresh({ revealErrors: true });

    if (!result.valid) {
      status.textContent = '請先修正標示的輸入異常。';
      status.className = 'form-status is-error';
      return;
    }

    generateButton.disabled = true;
    generateButton.classList.add('is-loading');
    generateButton.querySelector('span').textContent = '檔案產生中…';
    status.textContent = '正在逐筆計算查驗碼並建立 Excel 檔案…';
    status.className = 'form-status';

    try {
      const filename = await download(result.data, now());
      status.textContent = `已建立 ${filename}`;
      status.className = 'form-status is-success';
    } catch (error) {
      status.textContent = `檔案建立失敗：${error instanceof Error ? error.message : '未知錯誤'}`;
      status.className = 'form-status is-error';
    } finally {
      generateButton.classList.remove('is-loading');
      generateButton.querySelector('span').textContent = '驗證並下載 .xlsx';
      generateButton.disabled = false;
    }
  });

  refresh({ revealErrors: false });
  return { refresh };
}
