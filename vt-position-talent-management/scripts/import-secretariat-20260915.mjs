import { DatabaseSync, backup } from "node:sqlite";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

// Explicit local-only import; never runs during application initialization.
export const importKey = "secretariat_jd_user_20260915_v1";
const source = "海外人資/⭐工作說明書/已定稿/VT廠秘書室主任_工作說明書.md";
const catalog = "海外人資/⭐職能盤點/01_現有職能清單.md";
const clean = (text) => text.replace(/\*\*/g, "").trim();
function section(markdown, name) {
  const text = markdown.split(`## ${name}\n`)[1]?.split(/\n## /)[0];
  if (!text) throw new Error(`缺少來源章節：${name}`);
  return text.trim();
}
function rows(text) {
  return text.split("\n").filter((line) => line.startsWith("|")).slice(2)
    .map((line) => line.slice(1, line.lastIndexOf("|")).split("|").map(clean));
}
export function buildSecretariatImport(markdown, competencyMarkdown) {
  if (!/^version: 1\.1$/m.test(markdown) || !/^version: 2\.14$/m.test(competencyMarkdown)) throw new Error("來源版本已變更，請重新核對。");
  const basic = rows(section(markdown, "一、職位基本資料"));
  const responsibilities = rows(section(markdown, "四、主要職責")).map(([code, text]) => ({ code, text }));
  const questions = section(markdown, "十、待主管確認事項").split("\n").filter((line) => /^\d+\./.test(line)).map((line) => clean(line.replace(/^\d+\.\s*/, "")));
  const languages = rows(section(markdown, "九、語言要求")).map(([, listen, read, context]) => `聽、說：${listen}；讀、寫：${read}；使用情境：${context}`);
  const codes = section(markdown, "七、關鍵能力").split("\n").filter((line) => line.startsWith("- ")).map((line) => line.match(/^- ([MP]\d{2}) /)?.[1]);
  const p14 = rows(section(competencyMarkdown, "三、專業職能")).find(([id]) => id === "P14");
  if (responsibilities.length !== 6 || questions.length !== 7 || languages.length !== 3 || codes.join(",") !== "M03,M04,M05,M06,M07,P14" || !p14) throw new Error("來源結構已變更，請人工核對。");
  const document = {
    interviewee: "阮氏李", sourceMarkdown: markdown,
    summary: clean(markdown.match(/^> (.+)$/m)?.[1] ?? ""),
    managementUnit: basic.find(([name]) => name === "現行管理單位")[1],
    purpose: section(markdown, "二、職位目的"),
    coreResults: rows(section(markdown, "三、核心成果")).map(([result, measurement]) => ({ result, measurement })),
    responsibilities,
    authority: rows(section(markdown, "五、決策與權限")).map(([name, content]) => `${name}：${content}`).join("\n"),
    performance: section(markdown, "六、績效衡量方向").split("\n").filter((line) => line.startsWith("- ")).map((line) => line.slice(2)),
    competencies: codes,
    requirements: rows(section(markdown, "八、任職條件")).map(([name, content]) => `${name}：${content}`),
    languages: { mandarin: languages[0], vietnamese: languages[1], english: languages[2] },
    successors: [], interviewQuestions: questions, sources: [source, catalog],
    annotations: [
      ...basic.filter(([name]) => ["職務部署", "職務代理人"].includes(name)).map(([name, content]) => ({ type: "待確認", content: `${name}：${content}` })),
      ...questions.map((content) => ({ type: "待確認", content: content.replace(/^🔴 待確認｜/, "") })),
    ],
  };
  return {
    record: { id: "jd-secretariat-director", code: "JD-VT-013", title: "秘書室主任", site: "VT", department: "行政幕僚", grade: "主任", reportsTo: "行政幕僚經理", status: "訪談後修訂", version: "1.1", effectiveDate: "", updatedAt: "2026-09-15", confidentiality: "人事機密", confirmationStatus: "待確認", confirmedBy: "", confirmedAt: "", confirmationNote: "待本人核對及主管校準；受訪人：阮氏李。", reviewer: "", document, usageCount: 0 },
    competency: { id: "P14", name: p14[1], category: "專業職能", description: `定義：${p14[2]}\n判斷證據：${p14[3]}`, sortOrder: 114 },
  };
}

export function importSecretariat(db, payload, apply = false) {
  if (db.prepare("SELECT value FROM app_meta WHERE key=?").get(importKey)) return { alreadyApplied: true, changed: 0 };
  if (apply) db.exec("BEGIN IMMEDIATE");
  try {
    const position = db.prepare("SELECT * FROM positions WHERE id='p-secretariat-director'").get();
    const unit = db.prepare("SELECT * FROM org_nodes WHERE id='unit-secretariat'").get();
    const node = db.prepare("SELECT * FROM org_nodes WHERE id='node-secretariat-director'").get();
    if (!position || position.job_description_id || position.status !== "待建立" || !unit || !node || node.position_id !== position.id || node.parent_id !== unit.id) throw new Error("職位或組織已變動，需人工核對，未匯入。");
    if (db.prepare("SELECT id FROM job_descriptions WHERE id=? OR code=?").get(payload.record.id, payload.record.code)) throw new Error("主檔代碼已存在，未覆寫。");
    const existing = db.prepare("SELECT * FROM competencies WHERE id='P14'").get();
    if (existing && ["name", "category", "description"].some((key) => existing[key] !== payload.competency[key])) throw new Error("P14 既有內容不同，未覆寫。");
    for (const code of payload.record.document.competencies.filter((code) => code !== "P14")) {
      if (!db.prepare("SELECT id FROM competencies WHERE id=?").get(code)) throw new Error(`缺少職能：${code}`);
    }
    const result = { code: payload.record.code, interviewee: payload.record.document.interviewee, version: payload.record.version, status: payload.record.status, newCompetency: !existing, headcountPreserved: position.headcount, peopleUnchanged: true };
    if (!apply) return result;
    const r = { ...payload.record, updatedAt: new Date().toISOString() };
    const json = JSON.stringify(r.document);
    db.prepare(`INSERT INTO job_descriptions (id,code,title,site,department,grade,reports_to,status,version,effective_date,updated_at,confidentiality,confirmation_status,confirmed_by,confirmed_at,confirmation_note,document_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(r.id,r.code,r.title,r.site,r.department,r.grade,r.reportsTo,r.status,r.version,r.effectiveDate,r.updatedAt,r.confidentiality,r.confirmationStatus,r.confirmedBy,r.confirmedAt,r.confirmationNote,json);
    db.prepare(`INSERT INTO job_description_versions (id,master_id,revision,version,status,effective_date,expired_date,record_json,updated_at) VALUES (?,?,1,?,?,'','',?,?)`)
      .run(`${r.id}-initial`,r.id,r.version,r.status,JSON.stringify(r),r.updatedAt);
    db.prepare(`UPDATE positions SET job_description_id=?,name=?,grade=?,reports_to=?,status=?,version=?,effective_date='',document_json=?,updated_at=? WHERE id=?`)
      .run(r.id,r.title,r.grade,r.reportsTo,r.status,r.version,json,r.updatedAt,position.id);
    db.prepare("UPDATE org_nodes SET name=?,updated_at=? WHERE id=?").run(r.title,r.updatedAt,node.id);
    // Keep the existing hierarchy, supervisor, headcount and confirmation metadata.
    db.prepare("UPDATE org_nodes SET duties=?,purpose=?,updated_at=? WHERE id=?")
      .run(r.document.responsibilities.map(({ code, text }) => `${code} ${text}`).join("\n"),r.document.purpose,r.updatedAt,unit.id);
    if (!existing) {
      const c = payload.competency;
      db.prepare("INSERT INTO competencies (id,name,category,description,sort_order,updated_at) VALUES (?,?,?,?,?,?)").run(c.id,c.name,c.category,c.description,c.sortOrder,r.updatedAt);
    }
    db.prepare("INSERT INTO app_meta (key,value) VALUES (?,'1')").run(importKey);
    for (const [type, id, before] of [["job_description",r.id,null],["position",position.id,position],["org_node",unit.id,unit],["org_node",node.id,node],...(!existing ? [["competency","P14",null]] : [])]) {
      db.prepare("INSERT INTO change_logs (entity_type,entity_id,action,detail) VALUES (?,?,'user_source_import',?)").run(type,id,JSON.stringify({ request: importKey, source, before, result }));
    }
    db.exec("COMMIT");
    return result;
  } catch (error) { if (apply) db.exec("ROLLBACK"); throw error; }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const path = process.argv[2];
  if (!path) throw new Error("請指定本機 SQLite 路徑；預設 dry-run，--apply 才套用。");
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
  const payload = buildSecretariatImport(readFileSync(resolve(root, source), "utf8"),readFileSync(resolve(root, catalog), "utf8"));
  const apply = process.argv.includes("--apply");
  const db = new DatabaseSync(path, { readOnly: !apply });
  try {
    const preview = importSecretariat(db,payload);
    if (apply && !preview.alreadyApplied) {
      const destination = resolve(dirname(fileURLToPath(import.meta.url)), `../.wrangler/backups/before-secretariat-import-${Date.now()}.sqlite`);
      mkdirSync(dirname(destination), { recursive: true });
      if (existsSync(destination)) throw new Error("備份路徑已存在。");
      await backup(db,destination);
      console.log(JSON.stringify({ backup: destination }));
    }
    console.log(JSON.stringify(importSecretariat(db,payload,apply),null,2));
  } finally { db.close(); }
}
