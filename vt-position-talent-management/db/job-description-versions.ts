import type { JobDescriptionRecord, JobDescriptionVersion } from "../lib/types";

export type MasterRow = {
  id: string; code: string; title: string; site: string; department: string; grade: string;
  reports_to: string; status: string; version: string; effective_date: string; updated_at: string;
  confidentiality: string; confirmation_status: JobDescriptionRecord["confirmationStatus"];
  confirmed_by: string; confirmed_at: string; confirmation_note: string; document_json: string;
};
type VersionRow = {
  id: string; master_id: string; revision: number; version: string; status: string;
  effective_date: string; expired_date: string; updated_at: string; record_json: string;
};

export function masterRecord(row: MasterRow): JobDescriptionRecord {
  return { id: row.id, code: row.code, title: row.title, site: row.site, department: row.department,
    grade: row.grade, reportsTo: row.reports_to, status: row.status, version: row.version,
    effectiveDate: row.effective_date, updatedAt: row.updated_at, confidentiality: row.confidentiality,
    confirmationStatus: row.confirmation_status, confirmedBy: row.confirmed_by,
    confirmedAt: row.confirmed_at, confirmationNote: row.confirmation_note,
    document: JSON.parse(row.document_json), usageCount: 0 };
}

// Schema is installed by the migration, not created in request handlers.
export async function initializeJobDescriptionVersions(db: D1Database) {
  const missing = await db.prepare(`SELECT j.* FROM job_descriptions j WHERE NOT EXISTS
    (SELECT 1 FROM job_description_versions v WHERE v.master_id = j.id)`).all<MasterRow>();
  if (!missing.results.length) return;
  await db.batch(missing.results.map((row) => {
    const record = masterRecord(row);
    return db.prepare(`INSERT OR IGNORE INTO job_description_versions
      (id, master_id, revision, version, status, effective_date, expired_date, record_json, updated_at)
      VALUES (?, ?, 1, ?, ?, ?, '', ?, ?)`)
      .bind(`${row.id}-initial`, row.id, row.version, row.status, row.effective_date,
        JSON.stringify(record), row.updated_at);
  }));
}

export async function readVersions(db: D1Database, masterId?: string): Promise<JobDescriptionVersion[]> {
  const sql = "SELECT * FROM job_description_versions" + (masterId ? " WHERE master_id = ?" : "") + " ORDER BY revision DESC";
  const query = masterId ? db.prepare(sql).bind(masterId) : db.prepare(sql);
  const rows = await query.all<VersionRow>();
  return rows.results.map((row) => ({ id: row.id, revision: row.revision, version: row.version,
    status: row.status, effectiveDate: row.effective_date, expiredDate: row.expired_date, updatedAt: row.updated_at,
    record: { ...JSON.parse(row.record_json), revisionId: row.id, revisionNumber: row.revision,
      revisionToken: row.updated_at, status: row.status, effectiveDate: row.effective_date } }));
}

function snapshot(record: JobDescriptionRecord): string {
  const { versions: _versions, revisionId: _id, revisionNumber: _number, revisionToken: _token,
    currentEffectiveVersion: _effective, currentEffectiveRevisionId: _effectiveId, ...content } = record;
  void _versions; void _id; void _number; void _token; void _effective; void _effectiveId;
  return JSON.stringify({ ...content, usageCount: 0, document: { ...content.document, successors: [] } });
}

function mirrorStatement(db: D1Database, record: JobDescriptionRecord) {
  return db.prepare(`INSERT INTO job_descriptions
    (id, code, title, site, department, grade, reports_to, status, version, effective_date, updated_at,
     confidentiality, confirmation_status, confirmed_by, confirmed_at, confirmation_note, document_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET title=excluded.title, site=excluded.site, department=excluded.department,
    grade=excluded.grade, reports_to=excluded.reports_to, status=excluded.status, version=excluded.version,
    effective_date=excluded.effective_date, updated_at=excluded.updated_at, confidentiality=excluded.confidentiality,
    confirmation_status=excluded.confirmation_status, confirmed_by=excluded.confirmed_by,
    confirmed_at=excluded.confirmed_at, confirmation_note=excluded.confirmation_note, document_json=excluded.document_json`)
    .bind(record.id, record.code, record.title, record.site, record.department, record.grade, record.reportsTo,
      record.status, record.version, record.effectiveDate, record.updatedAt, record.confidentiality,
      record.confirmationStatus, record.confirmedBy, record.confirmedAt, record.confirmationNote,
      JSON.stringify({ ...record.document, successors: [] }));
}

function versionGuard(db: D1Database, latest: JobDescriptionVersion) {
  // Run inside the write batch. A stale edit fails the NOT NULL constraint and rolls back all writes.
  return db.prepare(`UPDATE job_description_versions SET updated_at = CASE
    WHEN updated_at = ? AND status = ? AND revision =
      (SELECT MAX(revision) FROM job_description_versions WHERE master_id = ?)
    THEN updated_at ELSE NULL END WHERE id = ?`)
    .bind(latest.updatedAt, latest.status, latest.record.id, latest.id);
}

export async function prepareVersionSave(db: D1Database, input: JobDescriptionRecord): Promise<D1PreparedStatement[]> {
  const existing = await db.prepare("SELECT * FROM job_descriptions WHERE id = ?").bind(input.id).first<MasterRow>();
  const code = input.code.trim().toUpperCase();
  const version = input.version.trim().replace(/^v/i, "");
  if (!code || !input.title.trim()) throw new Error("工作說明書代碼與名稱不可空白。");
  if (!/^\d+(\.\d+){0,2}$/.test(version)) throw new Error("版本請使用數字，例如 1.0 或 1.1。");
  if (existing && existing.code !== code) throw new Error("工作說明書代碼建立後固定不變，改版請使用新增版本。");
  const duplicate = await db.prepare("SELECT id FROM job_descriptions WHERE code = ? AND id <> ?").bind(code, input.id).first();
  if (duplicate) throw new Error(`工作說明書代碼 ${code} 已存在。`);
  const versions = existing ? await readVersions(db, input.id) : [];
  const latest = versions[0];
  if (latest && (input.revisionId !== latest.id || input.revisionToken !== latest.updatedAt)) throw new Error("版本已變更，請重新開啟最新版再編輯。");
  if (latest && (latest.status === "正式生效" || latest.status === "已失效")) throw new Error("生效或歷史版本不可覆寫，請新增版本。");
  if (input.status === "正式生效" || input.status === "已失效") throw new Error("請先儲存草稿，再使用正式生效操作。");
  if (latest && version !== latest.version) throw new Error("版本號建立後固定不變，請使用新增版本。");
  const now = new Date(Math.max(Date.now(), (Date.parse(latest?.updatedAt ?? "") || 0) + 1)).toISOString();
  const date = input.effectiveDate || "";
  if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date)) throw new Error("生效日期格式不正確。");
  const record = { ...input, code, title: input.title.trim(), version, reviewer: (input.reviewer ?? "").trim(), effectiveDate: date, updatedAt: now };
  const statement = latest
    ? db.prepare(`UPDATE job_description_versions SET status=?, effective_date=?, record_json=?, updated_at=?
        WHERE id=?`).bind(record.status, date, snapshot(record), now, latest.id)
    : db.prepare(`INSERT INTO job_description_versions
        (id,master_id,revision,version,status,effective_date,expired_date,record_json,updated_at)
        VALUES (?,?,1,?,?, ?, '', ?,?)`).bind(crypto.randomUUID(), record.id, version, record.status, date, snapshot(record), now);
  return [...(latest ? [versionGuard(db, latest)] : []), statement, mirrorStatement(db, record), db.prepare(`INSERT INTO change_logs
    (entity_type,entity_id,action,detail) VALUES ('job_description',?,'save_version',?)`).bind(record.id, `v${version}`)];
}

export async function createVersion(db: D1Database, masterId: string, versionInput: string, expectedId: string) {
  const versions = await readVersions(db, masterId);
  const latest = versions[0];
  if (!latest) throw new Error("找不到工作說明書。");
  if (latest.id !== expectedId) throw new Error("已有更新版本，請重新開啟後再操作。");
  const version = versionInput.trim().replace(/^v/i, "");
  if (!/^\d+(\.\d+){0,2}$/.test(version)) throw new Error("版本請使用數字，例如 1.0 或 1.1。");
  const compare = version.localeCompare(latest.version, "en", { numeric: true });
  if (compare <= 0 || versions.some((v) => v.version === version)) throw new Error("新版版本號須大於最新版，且不可重複。");
  if (latest.status !== "正式生效" && latest.status !== "已失效") throw new Error("目前仍有待生效版本，請先完成該版本。");
  const now = new Date().toISOString();
  const record = { ...latest.record, version, status: "訪談前初稿", effectiveDate: "", updatedAt: now,
    confirmationStatus: "待確認" as const, confirmedBy: "", confirmedAt: "", confirmationNote: "" };
  await db.batch([
    versionGuard(db, latest),
    db.prepare(`INSERT INTO job_description_versions
      (id,master_id,revision,version,status,effective_date,expired_date,record_json,updated_at)
      VALUES (?,?,?,?,?,'','',?,?)`).bind(crypto.randomUUID(), masterId, latest.revision + 1, version, record.status, snapshot(record), now),
    mirrorStatement(db, record),
    db.prepare("INSERT INTO change_logs (entity_type,entity_id,action,detail) VALUES ('job_description',?,'create_version',?)").bind(masterId, `v${version}`),
  ]);
}

export async function activateVersion(db: D1Database, masterId: string, revisionId: string, token: string, date: string) {
  const versions = await readVersions(db, masterId);
  const latest = versions[0];
  if (!latest || latest.id !== revisionId || latest.updatedAt !== token) throw new Error("版本已變更，請重新開啟後再生效。");
  if (latest.status === "正式生效" || latest.status === "已失效") throw new Error("此版本已生效或已失效，不可再次生效。");
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date || date > today) {
    throw new Error("請填寫有效的生效日期，且不可晚於今天；未來日期請屆時再操作生效。");
  }
  const active = versions.find((v) => v.status === "正式生效");
  if (active && /^\d{4}-\d{2}-\d{2}$/.test(active.effectiveDate) && date < active.effectiveDate) throw new Error("新版生效日不可早於目前有效版。");
  const now = new Date().toISOString();
  const record = { ...latest.record, status: "正式生效", effectiveDate: date, updatedAt: now };
  await db.batch([
    versionGuard(db, latest),
    db.prepare("UPDATE job_description_versions SET status='已失效', expired_date=? WHERE master_id=? AND status='正式生效'").bind(date, masterId),
    db.prepare("UPDATE job_description_versions SET status='正式生效', effective_date=?, record_json=?, updated_at=? WHERE id=?")
      .bind(date, snapshot(record), now, latest.id),
    mirrorStatement(db, record),
    db.prepare("INSERT INTO change_logs (entity_type,entity_id,action,detail) VALUES ('job_description',?,'activate_version',?)")
      .bind(masterId, `v${record.version}；生效日 ${date}`),
  ]);
}
