import { DatabaseSync } from "node:sqlite";
import { pathToFileURL } from "node:url";

// Explicit one-time correction requested by Ivy. Never runs during app startup.
export const reviewerAssignments = {
  "jd-ehs-director": "石旻錡",
  "jd-ie-director": "石旻錡",
  "jd-productivity-improvement-deputy": "石旻錡",
  "jd-lean-director": "石旻錡",
  "jd-business-deputy": "潘姵如",
  "jd-purchasing-deputy": "覃秋玲",
  "jd-bottom-manager": "曾建兵",
  "jd-upper-manager": "李紅星",
  "jd-upper-deputy": "李紅星",
  "jd-admin-staff-manager": "楊旻軒",
  "jd-field-staff-manager": "徐季瑋",
};
const key = "reviewer_prefill_user_20260915_v1";

export function prefillReviewers(db, apply = false) {
  if (db.prepare("SELECT value FROM app_meta WHERE key=?").get(key)) return { alreadyApplied: true, changed: 0 };
  const changes = Object.entries(reviewerAssignments).map(([id, reviewer]) => {
    const master = db.prepare("SELECT id,code,title,version,effective_date FROM job_descriptions WHERE id=?").get(id);
    const versions = db.prepare("SELECT * FROM job_description_versions WHERE master_id=? ORDER BY revision DESC").all(id);
    if (!master || versions.length !== 1) throw new Error(`需人工確認主檔或多版本衝突：${id}`);
    const latest = versions[0];
    const record = JSON.parse(latest.record_json);
    if (record.id !== id || master.version !== latest.version) throw new Error(`版本資料不一致：${id}`);
    return { master, latest, record, reviewer };
  });
  if (!apply) return { changed: changes.length, targets: changes.map(({ master, reviewer }) => ({ code: master.code, title: master.title, reviewer })) };
  db.exec("BEGIN IMMEDIATE");
  try {
    for (const { master, latest, record, reviewer } of changes) {
      const now = new Date().toISOString();
      const next = { ...record, reviewer, version: "1", effectiveDate: "2026-09-14", updatedAt: now };
      const result = db.prepare("UPDATE job_description_versions SET version='1',effective_date='2026-09-14',record_json=?,updated_at=? WHERE id=? AND record_json=? AND updated_at=?")
        .run(JSON.stringify(next), now, latest.id, latest.record_json, latest.updated_at);
      if (result.changes !== 1) throw new Error(`資料已被更新，未套用：${master.id}`);
      db.prepare("UPDATE job_descriptions SET version='1',effective_date='2026-09-14',updated_at=? WHERE id=?").run(now, master.id);
      db.prepare("INSERT INTO change_logs (entity_type,entity_id,action,detail) VALUES ('job_description',?,'user_metadata_correction',?)")
        .run(master.id, JSON.stringify({ request: key, before: { reviewer: record.reviewer ?? "", version: record.version, effectiveDate: record.effectiveDate }, after: { reviewer, version: "1", effectiveDate: "2026-09-14" }, statusUnchanged: true }));
    }
    db.prepare("INSERT INTO app_meta (key,value) VALUES (?,'1')").run(key);
    db.exec("COMMIT");
  } catch (error) { db.exec("ROLLBACK"); throw error; }
  return { changed: changes.length, statusChanged: false };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const path = process.argv[2];
  if (!path) throw new Error("請提供已備份的本機 SQLite 檔案路徑；預設只預覽，--apply 才會套用。");
  const apply = process.argv.includes("--apply");
  const db = new DatabaseSync(path, { readOnly: !apply });
  try { console.log(JSON.stringify(prefillReviewers(db, apply), null, 2)); } finally { db.close(); }
}
