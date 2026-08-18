# IMEI List Generator

一個可直接部署到 GitHub Pages 的純前端工具。輸入專案代號、IC 代號、TAC、起始/結尾 IMEI 與數量後，網站會在瀏覽器中驗證資料並下載 Excel `.xlsx` 檔案；資料不會傳送到伺服器。

## IMEI 與輸出規則

- 起始及結尾 IMEI 只輸入前 14 碼，不包含也不需要預先知道查驗碼。
- TAC 必須是 8 位數，並與起始及結尾 IMEI 的前 8 碼相同。
- 列表逐筆遞增輸入的 14 碼主體，再依 Luhn 演算法計算每一筆的第 15 碼。
- 起訖序號推算的筆數必須與輸入數量一致。
- 檔名格式：`專案代號_IC代號_數量pcs_YYMMDD.xlsx`。
- 活頁簿只建立 `Sheet1`，每列為文字格式的 `IMEI:<15碼>`，與 `example/AW-BM497SM_XT8816_400pcs_190930.xlsx` 的結構一致。

## 本機開發

需要 Node.js 22.12 以上版本。

```bash
npm install
npm run dev
```

執行所有測試與正式建置：

```bash
npm test
npm run test:coverage
npm run build
```

建置完成的靜態網站位於 `dist/`，可用 `npm run preview` 在本機預覽。

若要明確驗證 `dist/` 內的部署成品，可執行：

```bash
npm run build
npm run serve:dist
```
