import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, test } from "node:test";

// Exercise the actual repository against disposable SQLite. Never opens .wrangler.
const bindingUrl = "data:text/javascript,export const env = {}";
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "cloudflare:workers") return { url: bindingUrl, shortCircuit: true };
    if (context.parentURL?.endsWith(".ts") && specifier.startsWith(".") && !specifier.endsWith(".ts")) {
      return nextResolve(`${specifier}.ts`, context);
    }
    return nextResolve(specifier, context);
  },
});
const { env } = await import(bindingUrl);
const repository = await import("../db/repository.ts");
const { readPersonProfile, readAssessmentDocument } = await import("../lib/stored-documents.ts");
const { jobDescriptionRelations, displayEffectiveDate, jobDescriptionStatusTone } = await import("../lib/job-description-summary.ts");
const { prefillReviewers, reviewerAssignments } = await import("../scripts/prefill-reviewers-20260915.mjs");
const { buildSecretariatImport, importSecretariat } = await import("../scripts/import-secretariat-20260915.mjs");
const { secretariatMarkdown, competencyMarkdown } = await import("./fixtures/secretariat-import-fixture.mjs");
let sqlite;

class Statement {
  constructor(sql, params = []) { this.sql = sql; this.params = params; }
  bind(...params) {
    assert.ok(params.every((value) => value !== undefined), `Undefined SQL binding: ${this.sql}`);
    return new Statement(this.sql, params);
  }
  async first(column) {
    const row = sqlite.prepare(this.sql).get(...this.params);
    return row ? column ? row[column] : row : null;
  }
  async all() { return { results: sqlite.prepare(this.sql).all(...this.params), success: true }; }
  async run() { return { meta: sqlite.prepare(this.sql).run(...this.params), success: true }; }
}

beforeEach(() => {
  sqlite = new DatabaseSync(":memory:");
  sqlite.exec(readFileSync(new URL("../drizzle/0006_versioned_job_descriptions.sql", import.meta.url), "utf8"));
  env.DB = {
    prepare: (sql) => new Statement(sql),
    async batch(statements) {
      sqlite.exec("BEGIN");
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.all());
        sqlite.exec("COMMIT");
        return results;
      } catch (error) { sqlite.exec("ROLLBACK"); throw error; }
    },
  };
});
afterEach(() => sqlite.close());

test("secretariat import is atomic, repeatable and preserves unrelated data", async () => {
  await repository.readAppData();
  const payload = buildSecretariatImport(
    secretariatMarkdown,
    competencyMarkdown,
  );
  const before = sqlite.prepare("SELECT * FROM positions WHERE id='p-secretariat-director'").get();
  assert.equal(importSecretariat(sqlite,payload).newCompetency,true);
  assert.equal(sqlite.prepare("SELECT count(*) AS n FROM job_descriptions").get().n,12);
  sqlite.exec("CREATE TRIGGER fail_secretariat BEFORE INSERT ON competencies WHEN NEW.id='P14' BEGIN SELECT RAISE(ABORT,'injected failure'); END");
  assert.throws(() => importSecretariat(sqlite,payload,true),/injected failure/);
  assert.deepEqual(sqlite.prepare("SELECT * FROM positions WHERE id='p-secretariat-director'").get(),before);
  assert.equal(sqlite.prepare("SELECT count(*) AS n FROM job_descriptions").get().n,12);
  sqlite.exec("DROP TRIGGER fail_secretariat");
  importSecretariat(sqlite,payload,true);
  const data = await repository.readAppData();
  const master = data.jobDescriptions.find((item) => item.code === "JD-VT-013");
  const position = data.positions.find((item) => item.id === before.id);
  assert.equal(master.versions.length,1);
  assert.equal(master.document.interviewee,"阮氏李");
  assert.equal(master.reviewer,"");
  assert.equal(master.status,"訪談後修訂");
  assert.equal(master.effectiveDate,"");
  assert.equal(master.document.responsibilities.length,6);
  assert.deepEqual(master.document.responsibilities.map(({ code }) => code),["R01","R02","R03","R05","R06","R07"]);
  assert.equal(master.document.performance.length,5);
  assert.equal(master.document.coreResults.length,5);
  assert.equal(master.document.interviewQuestions.length,7);
  assert.equal(position.headcount,before.headcount);
  assert.equal(position.confirmationStatus,"待確認");
  assert.deepEqual(position.document,master.document);
  assert.equal(data.competencies.length,21);
  assert.equal(data.people.length,0);
  assert.equal(importSecretariat(sqlite,payload,true).alreadyApplied,true);
  assert.equal((await repository.readAppData()).jobDescriptions.length,13);
});

test("initialization is repeatable and four independent positions reference one coded master", async () => {
  const first = await repository.readAppData();
  const second = await repository.readAppData();
  assert.deepEqual(first, second);
  assert.equal(first.jobDescriptions.length, 12);
  const factory = first.jobDescriptions.find((item) => item.code === "JD-VT-001");
  assert.deepEqual(factory.document.competencies, ["M01", "M02", "M03", "M04", "M05", "M06", "M07"]);
  assert.ok(factory.document.sources.some((source) => source.endsWith("VT廠主管_工作說明書.md")));
  assert.equal(new Set(first.jobDescriptions.map((item) => item.code)).size, 12);
  const shared = first.positions.filter((item) => item.jobDescriptionId === "jd-upper-deputy");
  assert.equal(shared.length, 4);
  assert.equal(new Set(shared.map((item) => item.unit)).size, 4);
  assert.ok(shared.every((item) => item.jobDescriptionUsageCount === 4));
});

test("a new master can be linked, relinked and unlinked without changing headcount or people", async () => {
  const data = await repository.readAppData();
  const jd = structuredClone(data.jobDescriptions[0]);
  Object.assign(jd, { id: "jd-test", code: " jd-test-001 ", title: "測試職位" });
  await repository.saveJobDescription(jd);
  const position = data.positions.find((item) => item.id === "p-vt1-upper-deputy");
  await repository.linkPositionJobDescription(position.id, jd.id);
  const linked = (await repository.readAppData()).positions.find((item) => item.id === position.id);
  assert.equal(linked.jobDescriptionId, jd.id);
  assert.equal(linked.headcount, position.headcount);
  assert.equal(linked.unit, position.unit);
  assert.deepEqual(linked.incumbents, position.incumbents);
  assert.equal((await repository.readAppData()).jobDescriptions.find((item) => item.id === jd.id).code, "JD-TEST-001");
  await repository.linkPositionJobDescription(position.id, null);
  assert.equal((await repository.readAppData()).positions.find((item) => item.id === position.id).jobDescriptionId, null);
  await repository.linkPositionJobDescription(position.id, position.jobDescriptionId);
  assert.equal((await repository.readAppData()).jobDescriptions.find((item) => item.id === position.jobDescriptionId).usageCount, 4);
});

test("duplicate codes and invalid references fail without partial writes", async () => {
  const before = await repository.readAppData();
  await assert.rejects(repository.saveJobDescription({ ...before.jobDescriptions[0], id: "duplicate" }), /已存在/);
  await assert.rejects(repository.linkPositionJobDescription("missing", before.jobDescriptions[0].id), /找不到/);
  await assert.rejects(repository.linkPositionJobDescription(before.positions[0].id, "missing"), /找不到/);
  assert.deepEqual(await repository.readAppData(), before);
});

test("shared edits propagate while organization placement and incumbent links stay independent", async () => {
  const before = await repository.readAppData();
  const position = structuredClone(before.positions.find((item) => item.id === "p-vt1-upper-deputy"));
  sqlite.prepare("INSERT INTO people (id, name, employee_no) VALUES (?, ?, ?)").run("test-person", "測試人員", "TEST001");
  position.headcount = 2;
  position.site = "VT1";
  position.department = "測試組織歸屬";
  position.incumbents = [{ id: "test-person", name: "測試人員", employeeNo: "TEST001", startDate: "", notes: "" }];
  await repository.savePosition(position);
  const edited = structuredClone(before.jobDescriptions.find((item) => item.id === position.jobDescriptionId));
  edited.document.purpose = "測試共用更新";
  await repository.saveJobDescription(edited);
  const after = await repository.readAppData();
  const shared = after.positions.filter((item) => item.jobDescriptionId === position.jobDescriptionId);
  assert.ok(shared.every((item) => item.document.purpose === "測試共用更新"));
  assert.equal(shared.find((item) => item.id === position.id).incumbents.length, 1);
  for (const other of shared.filter((item) => item.id !== position.id)) {
    const original = before.positions.find((item) => item.id === other.id);
    assert.equal(other.headcount, original.headcount);
    assert.deepEqual(other.incumbents, original.incumbents);
    assert.equal(other.department, original.department);
  }
  const master = after.jobDescriptions.find((item) => item.id === position.jobDescriptionId);
  assert.equal(master.site, "VT");
  assert.equal(master.department, "面部");
  assert.deepEqual(master.document.successors, []);
  assert.deepEqual(await repository.readAppData(), after);
});

test("unresolved people and stale associations are rejected before saving", async () => {
  const before = await repository.readAppData();
  const position = structuredClone(before.positions[0]);
  position.incumbents = [{ id: "missing-person", name: "未確認", employeeNo: "", startDate: "", notes: "" }];
  await assert.rejects(repository.savePosition(position), /人員主檔/);
  assert.deepEqual(await repository.readAppData(), before);
  position.incumbents = [];
  position.jobDescriptionId = null;
  await assert.rejects(repository.savePosition(position), /關聯已變更/);
  assert.deepEqual(await repository.readAppData(), before);
});

test("corrupt stored profiles are reported instead of being silently replaced with empty data", () => {
  assert.deepEqual(readPersonProfile("{}"), {});
  assert.throws(() => readPersonProfile("broken"), /格式損壞/);
  assert.throws(() => readPersonProfile('{"trainingRecords":"wrong"}'), /格式不正確/);
  const section = { title: "能力", columns: ["項目"], rows: [{ label: "M01", values: ["待確認"] }] };
  assert.deepEqual(readAssessmentDocument(JSON.stringify([section]), "2026-09-14").sections, [section]);
  assert.equal(readAssessmentDocument(JSON.stringify({ finalizedDate: "2026-09-13", sections: [section] }), "").finalizedDate, "2026-09-13");
  assert.throws(() => readAssessmentDocument('{"sections":{}}', ""), /格式不正確/);
});

test("upgrading legacy documents keeps user edits and confirmation instead of restoring seed content", async () => {
  const data = await repository.readAppData();
  const position = data.positions.find((item) => item.id === "p-admin-staff-manager");
  position.document.purpose = "使用者已修訂的目的";
  sqlite.prepare("UPDATE positions SET document_json = ?, status = '正式生效', confirmed_by = '測試主管', job_description_id = NULL WHERE id = ?")
    .run(JSON.stringify(position.document), position.id);
  sqlite.prepare("DELETE FROM job_descriptions WHERE id = ?").run(position.jobDescriptionId);
  sqlite.prepare("DELETE FROM job_description_versions WHERE master_id = ?").run(position.jobDescriptionId);
  sqlite.prepare("DELETE FROM app_meta WHERE key = 'job_description_library_20260914_v1'").run();
  const upgraded = await repository.readAppData();
  const master = upgraded.jobDescriptions.find((item) => item.id === position.jobDescriptionId);
  assert.equal(master.document.purpose, "使用者已修訂的目的");
  assert.equal(master.status, "正式生效");
  assert.equal(master.confirmedBy, "測試主管");
  assert.equal(upgraded.positions.find((item) => item.id === position.id).jobDescriptionId, master.id);
});

test("legacy recovery restores untouched seed masters but preserves subsequent master edits", async () => {
  const data = await repository.readAppData();
  const first = data.jobDescriptions.find((item) => item.id === "jd-admin-staff-manager");
  const second = data.jobDescriptions.find((item) => item.id === "jd-factory-supervisor");
  sqlite.prepare("UPDATE positions SET status = '正式生效' WHERE job_description_id IN (?, ?)").run(first.id, second.id);
  second.document.purpose = "主檔建立後的人工修訂";
  await repository.saveJobDescription(second);
  sqlite.prepare("DELETE FROM job_description_versions WHERE master_id = ?").run(first.id);
  sqlite.prepare("DELETE FROM app_meta WHERE key = 'job_description_legacy_recovery_20260914_v1'").run();
  const recovered = await repository.readAppData();
  assert.equal(recovered.jobDescriptions.find((item) => item.id === first.id).status, "正式生效");
  assert.equal(recovered.jobDescriptions.find((item) => item.id === second.id).document.purpose, second.document.purpose);
  assert.equal(recovered.jobDescriptions.find((item) => item.id === second.id).status, second.status);
});

test("a database failure rolls back shared changes and keeps the original position", async () => {
  const before = await repository.readAppData();
  const position = structuredClone(before.positions.find((item) => item.id === "p-vt1-upper-deputy"));
  sqlite.exec("CREATE TRIGGER simulate_failure BEFORE UPDATE ON positions WHEN NEW.id = 'p-vt1-upper-deputy' BEGIN SELECT RAISE(ABORT, 'test-write-failure'); END");
  position.headcount = 5;
  await assert.rejects(repository.savePosition(position), /test-write-failure/);
  assert.deepEqual(await repository.readAppData(), before);
});

test("a legacy schema gains its association column before the index is created", async () => {
  await repository.readAppData();
  sqlite.exec("DROP INDEX idx_positions_job_description; ALTER TABLE positions DROP COLUMN job_description_id; DROP TABLE job_descriptions;");
  sqlite.prepare("DELETE FROM app_meta WHERE key IN (?, ?)").run("job_description_library_20260914_v1", "job_description_legacy_recovery_20260914_v1");
  const upgraded = await repository.readAppData();
  assert.equal(upgraded.jobDescriptions.length, 12);
  assert.equal(upgraded.positions.filter((item) => item.jobDescriptionId === "jd-upper-deputy").length, 4);
});

test("version lifecycle preserves effective content until activation and keeps immutable history", async () => {
  let data = await repository.readAppData();
  let master = data.jobDescriptions.find((item) => item.id === "jd-upper-deputy");
  assert.equal(master.versions.length, 1);
  await repository.activateJobDescriptionVersion(master.id, master.revisionId, master.revisionToken, "2026-09-14");
  data = await repository.readAppData(); master = data.jobDescriptions.find((item) => item.id === master.id);
  const first = structuredClone(master.versions[0]);
  await assert.rejects(repository.saveJobDescription(master), /不可覆寫/);
  await repository.createJobDescriptionVersion(master.id, "1.0", master.revisionId);
  data = await repository.readAppData(); master = data.jobDescriptions.find((item) => item.id === master.id);
  assert.equal(master.status, "訪談前初稿");
  assert.equal(master.effectiveDate, "");
  assert.equal(master.confirmationStatus, "待確認");
  assert.equal(master.currentEffectiveVersion, first.version);
  assert.equal(master.versions.length, 2);
  master.document.purpose = "新版測試目的";
  await repository.saveJobDescription(master);
  data = await repository.readAppData(); master = data.jobDescriptions.find((item) => item.id === master.id);
  assert.ok(data.positions.filter((p) => p.jobDescriptionId === master.id).every((p) => p.document.purpose === first.record.document.purpose));
  await repository.activateJobDescriptionVersion(master.id, master.revisionId, master.revisionToken, "2026-09-15");
  data = await repository.readAppData(); master = data.jobDescriptions.find((item) => item.id === master.id);
  assert.equal(master.status, "正式生效");
  assert.equal(master.currentEffectiveVersion, "1.0");
  assert.ok(data.positions.filter((p) => p.jobDescriptionId === master.id).every((p) => p.document.purpose === "新版測試目的" && p.effectiveDate === "2026-09-15"));
  const archived = master.versions.find((v) => v.id === first.id);
  assert.equal(archived.status, "已失效");
  assert.equal(archived.expiredDate, "2026-09-15");
  assert.deepEqual(archived.record.document, first.record.document);
  assert.equal(archived.effectiveDate, first.effectiveDate);
  assert.equal(master.versions.filter((v) => v.status === "正式生效").length, 1);
  await assert.rejects(repository.saveJobDescription(archived.record), /版本已變更/);
  await assert.rejects(repository.createJobDescriptionVersion(master.id, "1.0", master.revisionId), /大於最新版/);
  const slot = data.positions.find((p) => p.jobDescriptionId === master.id);
  slot.document.purpose = "不得從配置頁覆寫";
  await assert.rejects(repository.savePosition(slot), /共用文件請到/);
});

test("stale edits and invalid effective dates never partially save", async () => {
  let master = (await repository.readAppData()).jobDescriptions.find((item) => item.id === "jd-upper-deputy");
  const stale = structuredClone(master);
  master.document.purpose = "第一個編輯者";
  await repository.saveJobDescription(master);
  const before = await repository.readAppData();
  await assert.rejects(repository.saveJobDescription(stale), /版本已變更/);
  master = before.jobDescriptions.find((item) => item.id === master.id);
  for (const date of ["", "2026-02-30", "2099-01-01", "待確認"]) {
    await assert.rejects(repository.activateJobDescriptionVersion(master.id, master.revisionId, master.revisionToken, date), /有效的生效日期/);
  }
  await assert.rejects(repository.createJobDescriptionVersion(master.id, "1.0", master.revisionId), /待生效版本/);
  await assert.rejects(repository.saveJobDescription({ ...master, code: "CHANGED" }), /固定不變/);
  await assert.rejects(repository.saveJobDescription({ ...master, status: "正式生效" }), /正式生效操作/);
  assert.deepEqual(await repository.readAppData(), before);
});

test("activation rolls back expiry and snapshot when storage fails", async () => {
  let master = (await repository.readAppData()).jobDescriptions.find((item) => item.id === "jd-upper-deputy");
  await repository.activateJobDescriptionVersion(master.id, master.revisionId, master.revisionToken, "2026-09-14");
  master = (await repository.readAppData()).jobDescriptions.find((item) => item.id === master.id);
  await repository.createJobDescriptionVersion(master.id, "1.0", master.revisionId);
  const before = await repository.readAppData(); master = before.jobDescriptions.find((item) => item.id === master.id);
  sqlite.exec("CREATE TRIGGER fail_activation BEFORE UPDATE ON job_descriptions BEGIN SELECT RAISE(ABORT, 'activation-failure'); END");
  await assert.rejects(repository.activateJobDescriptionVersion(master.id, master.revisionId, master.revisionToken, "2026-09-15"), /activation-failure/);
  assert.deepEqual(await repository.readAppData(), before);
});

test("person counts deduplicate across positions and never infer successors from assessments", async () => {
  const data = await repository.readAppData();
  const master = data.jobDescriptions.find((item) => item.id === "jd-upper-deputy");
  const positions = data.positions.filter((p) => p.jobDescriptionId === master.id);
  for (const [id, name] of [["person-a", "測試甲"], ["person-b", "測試乙"], ["person-c", "僅有盤點"]]) {
    sqlite.prepare("INSERT INTO people (id,name,employee_no) VALUES (?,?,?)").run(id, name, id);
  }
  positions.forEach((p, index) => {
    sqlite.prepare("INSERT INTO position_people (id,position_id,person_id,relationship_type) VALUES (?,?,?,'現任者')").run(`current-${index}`, p.id, "person-a");
    sqlite.prepare("INSERT INTO position_people (id,position_id,person_id,relationship_type) VALUES (?,?,?,'潛在接班人')").run(`successor-${index}`, p.id, "person-b");
  });
  for (let i=0; i<2; i++) sqlite.prepare("INSERT INTO talent_assessments (id,target_position_id,person_id) VALUES (?,?,?)").run(`assessment-${i}`, positions[i].id, "person-c");
  const related = jobDescriptionRelations(await repository.readAppData(), master.id);
  assert.equal(related.positions.length, 4);
  assert.equal(related.incumbents.length, 1);
  assert.equal(related.successors.length, 1);
  assert.equal(related.incumbents[0].linkedPositions.length, 4);
  assert.equal(jobDescriptionRelations(await repository.readAppData(), "missing").successors.length, 0);
});

test("overview uses status colors and version effective dates without inventing dates", () => {
  assert.equal(displayEffectiveDate("正式生效", "2026-09-15"), "2026/09/15");
  assert.equal(displayEffectiveDate("正式生效", ""), "待補日期");
  assert.equal(displayEffectiveDate("主管確認中", "2026-09-14"), "2026/09/14");
  assert.equal(displayEffectiveDate("主管確認中", ""), "尚未生效");
  assert.notEqual(jobDescriptionStatusTone("正式生效"), jobDescriptionStatusTone("主管確認中"));
  assert.notEqual(jobDescriptionStatusTone("已失效"), jobDescriptionStatusTone("訪談前初稿"));
});

test("explicit reviewer prefill changes only the requested metadata and is repeat-safe", async () => {
  const before = await repository.readAppData();
  const factory = before.jobDescriptions.find((item) => item.id === "jd-factory-supervisor");
  assert.equal(prefillReviewers(sqlite).changed, 11);
  assert.deepEqual(await repository.readAppData(), before);
  assert.equal(prefillReviewers(sqlite, true).changed, 11);
  const after = await repository.readAppData();
  assert.deepEqual(after.jobDescriptions.find((item) => item.id === factory.id), factory);
  for (const [id, reviewer] of Object.entries(reviewerAssignments)) {
    const original = before.jobDescriptions.find((item) => item.id === id);
    const changed = after.jobDescriptions.find((item) => item.id === id);
    assert.equal(changed.reviewer, reviewer);
    assert.equal(changed.version, "1");
    assert.equal(changed.effectiveDate, "2026-09-14");
    assert.equal(changed.status, original.status);
    assert.deepEqual(changed.document, original.document);
    assert.equal(changed.versions.length, original.versions.length);
    assert.ok(after.positions.filter((position) => position.jobDescriptionId === id).every((position) => position.reviewer === reviewer));
  }
  assert.equal(prefillReviewers(sqlite, true).changed, 0);
  assert.deepEqual(await repository.readAppData(), after);
});

test("draft edits preserve the reviewer and prefilled date without activating the document", async () => {
  let master = (await repository.readAppData()).jobDescriptions.find((item) => item.id === "jd-upper-deputy");
  master.reviewer = "測試審核者";
  master.effectiveDate = "2026-09-14";
  await repository.saveJobDescription(master);
  master = (await repository.readAppData()).jobDescriptions.find((item) => item.id === master.id);
  assert.equal(master.reviewer, "測試審核者");
  assert.equal(master.effectiveDate, "2026-09-14");
  assert.notEqual(master.status, "正式生效");
  master.document.purpose = "再次修改草稿";
  await repository.saveJobDescription(master);
  const saved = (await repository.readAppData()).jobDescriptions.find((item) => item.id === master.id);
  assert.equal(saved.reviewer, "測試審核者");
  assert.equal(saved.effectiveDate, "2026-09-14");
});
