/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initApp } from './app.js';

function setFixture() {
  document.body.innerHTML = `
    <button id="fill-example" type="button">範例</button>
    <form id="imei-form">
      <input id="project-code" name="projectCode"><span id="project-code-error"></span>
      <input id="ic-code" name="icCode"><span id="ic-code-error"></span>
      <input id="tac" name="tac"><span id="tac-error"></span>
      <input id="start-imei" name="startImei"><span id="start-imei-error"></span>
      <input id="end-imei" name="endImei"><span id="end-imei-error"></span>
      <input id="quantity" name="quantity"><span id="quantity-error"></span>
      <button id="generate-button" type="submit"><span>驗證並下載 .xlsx</span></button>
      <button id="clear-form" type="button">清除</button>
      <p id="form-status"></p>
    </form>
    <span id="validity-badge"></span>
    <div id="empty-preview"></div>
    <div id="preview-content" hidden>
      <span id="summary-quantity"></span>
      <span id="summary-range"></span>
      <span id="summary-filename"></span>
      <ol id="preview-rows"></ol>
    </div>
  `;
}

describe('網站表單互動', () => {
  const fixedDate = new Date(2019, 3, 3);

  beforeEach(() => {
    setFixture();
  });

  it('初始不顯示錯誤且下載按鈕停用', () => {
    initApp(document, { download: vi.fn(), now: () => fixedDate });
    expect(document.getElementById('generate-button').disabled).toBe(true);
    expect(document.getElementById('project-code-error').textContent).toBe('');
    expect(document.getElementById('empty-preview').hidden).toBe(false);
  });

  it('帶入範例後顯示有效摘要、檔名與首尾預覽', () => {
    initApp(document, { download: vi.fn(), now: () => fixedDate });
    document.getElementById('fill-example').click();

    expect(document.getElementById('project-code').value).toBe('AW-BM497SM');
    expect(document.getElementById('start-imei').value).toBe('86768903017588');
    expect(document.getElementById('end-imei').value).toBe('86768903017987');
    expect(document.getElementById('generate-button').disabled).toBe(false);
    expect(document.getElementById('validity-badge').textContent).toBe('資料有效');
    expect(document.getElementById('summary-quantity').textContent).toBe('400 PCS');
    expect(document.getElementById('summary-filename').textContent).toBe(
      'AW-BM497SM_XT8816_400pcs_190403.xlsx',
    );
    expect(document.querySelectorAll('#preview-rows li')).toHaveLength(8);
    expect(document.getElementById('preview-rows').textContent).toContain('IMEI:867689030179875');
  });

  it('即時指出不是 14 碼的 IMEI 主體', () => {
    initApp(document, { download: vi.fn(), now: () => fixedDate });
    document.getElementById('fill-example').click();
    const start = document.getElementById('start-imei');
    start.value = '867689030175881';
    start.dispatchEvent(new Event('input', { bubbles: true }));

    expect(start.getAttribute('aria-invalid')).toBe('true');
    expect(document.getElementById('start-imei-error').textContent).toContain('14 位數字');
    expect(document.getElementById('generate-button').disabled).toBe(true);
  });

  it('送出有效表單會呼叫下載並回報檔名', async () => {
    const download = vi.fn().mockResolvedValue('batch.xlsx');
    initApp(document, { download, now: () => fixedDate });
    document.getElementById('fill-example').click();
    document.getElementById('imei-form').dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );

    await vi.waitFor(() => expect(download).toHaveBeenCalledOnce());
    expect(download.mock.calls[0][0].quantity).toBe(400);
    expect(document.getElementById('form-status').textContent).toBe('已建立 batch.xlsx');
    expect(document.getElementById('generate-button').disabled).toBe(false);
  });

  it('下載失敗時顯示錯誤且恢復按鈕', async () => {
    const download = vi.fn().mockRejectedValue(new Error('瀏覽器拒絕下載'));
    initApp(document, { download, now: () => fixedDate });
    document.getElementById('fill-example').click();
    document.getElementById('imei-form').dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );

    await vi.waitFor(() => {
      expect(document.getElementById('form-status').textContent).toContain('瀏覽器拒絕下載');
    });
    expect(document.getElementById('form-status').classList.contains('is-error')).toBe(true);
    expect(document.getElementById('generate-button').disabled).toBe(false);
  });

  it('無效表單送出時不下載並提示修正', () => {
    const download = vi.fn();
    initApp(document, { download, now: () => fixedDate });
    document.getElementById('imei-form').dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
    expect(download).not.toHaveBeenCalled();
    expect(document.getElementById('form-status').textContent).toContain('修正');
    expect(document.getElementById('project-code-error').textContent).not.toBe('');
  });

  it('清除按鈕重設欄位、錯誤與預覽', () => {
    initApp(document, { download: vi.fn(), now: () => fixedDate });
    document.getElementById('fill-example').click();
    document.getElementById('clear-form').click();

    expect(document.getElementById('project-code').value).toBe('');
    expect(document.getElementById('project-code-error').textContent).toBe('');
    expect(document.getElementById('empty-preview').hidden).toBe(false);
    expect(document.activeElement).toBe(document.getElementById('project-code'));
  });
});
