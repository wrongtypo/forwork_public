# AGENTS.md

本專案是公司內部的職位與人才管理系統。開始修改前，請完整閱讀 `docs/HANDOFF.md`、`docs/USER_GUIDE.md` 與 `docs/DEVELOPMENT_PROGRESS.md`，並以實際程式碼及目前 DB 為準。

## 工作規則

- 以繁體中文溝通、寫文件及保存主資料；簡體中文只在顯示層由 OpenCC 轉換。
- 人事、組織、訪談與工作說明書內容一律視為機密，不公開部署或傳給未授權對象。
- 不確定的資訊保留「待確認／待訪談」，不得自行補人名、工號、能力、編制或接班結論。
- 不得刪除或重建 `.wrangler/`；修改 DB 前先備份，資料表 schema 異動需同步 runtime schema、Drizzle schema、migration 及測試。
- 不得自動把 DB 雙向同步到外部 Markdown。只有收到明確指示後，才進行差異比對與同步。
- 不要把 `node_modules/`、`dist/`、`.next/`、`.vinext/`、`.wrangler/`、測試 PDF 或暫存檔提交到 Git。
- 每次交付至少執行 `npm run check`；涉及互動或列印時，再做瀏覽器實測。
- 修改完成後同步更新 `docs/DEVELOPMENT_PROGRESS.md`，必要時更新 `docs/HANDOFF.md`。

## 資料庫交接

資料庫不放在 GitHub，由 Ivy 另外直接交付維護同事。收到 DB 後須先停止開發伺服器、備份既有本機 DB，再置換 `.wrangler/state/v3/d1/miniflare-D1DatabaseObject/` 內唯一一個非 `metadata.sqlite` 的 `.sqlite` 檔。不得提交 `.wrangler/`、SQLite 或 `-wal`／`-shm` sidecar。
