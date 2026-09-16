# VT 職位與人才管理系統

公司內部維護用的職位、組織、工作說明書、人才與職能管理系統。技術基礎為 vinext、React、Cloudflare D1（本機由 Wrangler／SQLite 模擬）與 Drizzle。

> 此專案包含真實公司組織、職位、主管／受訪者／審核者姓名及工作說明書內容，僅供授權同事維護。即使 GitHub repository 暫時設為 public，也不代表授予公開散布或再利用權利。

## 交接入口

接手前請依序閱讀：

1. [`docs/HANDOFF.md`](docs/HANDOFF.md)：目前狀態、架構、已知問題與下一步。
2. [`docs/USER_GUIDE.md`](docs/USER_GUIDE.md)：功能及日常操作。
3. [`docs/DEVELOPMENT_PROGRESS.md`](docs/DEVELOPMENT_PROGRESS.md)：完整開發紀錄。
4. [`AGENTS.md`](AGENTS.md)：給後續 AI／開發者的資料與修改規則。

## 環境需求

- Node.js `>=22.18.0`，建議 Node.js 24。
- npm。
- macOS、Linux 或 Windows 均可；Windows 建議使用 PowerShell 或 WSL。

## 第一次啟動

```bash
npm ci
npm run dev
```

看到 `http://localhost:3000/` 後即可開啟。第一次執行會依程式內的 schema 與 seed 建立本機 `.wrangler/` 資料庫。

## 交接資料庫

資料庫不放在 GitHub。Ivy 會另外把 SQLite 檔直接交給維護同事。

同事收到 DB 後，請先執行一次 `npm run dev` 產生 `.wrangler/` 目錄並停止伺服器；先備份新產生的本機 DB，再用收到的 SQLite 檔取代 `.wrangler/state/v3/d1/miniflare-D1DatabaseObject/` 內唯一一個非 `metadata.sqlite` 的 `.sqlite` 檔。取代前必須確認開發伺服器已停止，且不要複製舊的 `-wal`／`-shm` sidecar。

## 驗證

```bash
npm run check
```

此指令依序執行 ESLint、TypeScript 型別檢查、正式建置與測試。涉及列印版面時，仍需在 Chrome 列印預覽進行視覺驗收。

## 重要限制

- 目前沒有正式登入與權限控管，不可直接公開部署。
- `.wrangler/`、SQLite 與任何資料庫 sidecar 都不納入 Git；DB 由 Ivy 另外直接交付。
- 不得自行猜測或補寫人員、工號、能力、接班結論或待確認內容。
- 不會自動把 DB 回寫到原始 Markdown；只有收到明確指示後才能同步。
- 原始訪談、人資來源文件與現況 DB 未放入這個 public 交接目錄；程式只保留原本已存在的 seed／migration 與維護邏輯。

## 目錄

```text
app/        前端頁面與 API
db/         runtime 資料存取與版本管理
drizzle/    migration 與 schema 快照
lib/        種子資料、型別與共用邏輯
scripts/    匯入、還原與瀏覽器檢查工具
tests/      自動化測試
docs/       交接、使用說明與開發歷程
```
