import { env } from "cloudflare:workers";
import { type AppData, type CompetencyRecord, type JobDescriptionRecord, type OrgNode, type PersonRecord, type PositionRecord } from "../lib/types";
import { seedJobDescriptions, seedOrgNodes, seedPositions, type SeedJobDescription } from "../lib/seed-data";
import { seedAssessments, seedPeople, seedPositionPeople } from "../lib/people-seed-data";
import { seedCompetencies } from "../lib/competency-seed-data";
import { readAssessmentDocument, readPersonProfile } from "../lib/stored-documents";
import { initializeJobDescriptionVersions, readVersions, prepareVersionSave, createVersion, activateVersion } from "./job-description-versions";

const CURRENT_SOURCE_VERSION = "vt-org-v1.8-20260912";
const PREVIOUS_FINALIZED_SOURCE_VERSION = "vt-finalized-20260910-v1";
const IMPORT_DATE_FOR_ORG = "2026-09-12";

function getBinding(): D1Database {
  if (!env.DB) throw new Error("本機資料庫尚未啟用。");
  return env.DB;
}

const tableStatements = [
  `CREATE TABLE IF NOT EXISTS job_descriptions (
    id TEXT PRIMARY KEY, code TEXT NOT NULL, title TEXT NOT NULL, site TEXT NOT NULL DEFAULT 'VT',
    department TEXT NOT NULL DEFAULT '', grade TEXT NOT NULL DEFAULT '',
    reports_to TEXT NOT NULL DEFAULT '待確認', status TEXT NOT NULL DEFAULT '訪談前初稿',
    version TEXT NOT NULL DEFAULT '0.1', effective_date TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, confidentiality TEXT NOT NULL DEFAULT '人事機密',
    confirmation_status TEXT NOT NULL DEFAULT '待確認', confirmed_by TEXT NOT NULL DEFAULT '',
    confirmed_at TEXT NOT NULL DEFAULT '', confirmation_note TEXT NOT NULL DEFAULT '',
    document_json TEXT NOT NULL DEFAULT '{}'
  )`,
  `CREATE TABLE IF NOT EXISTS org_nodes (
    id TEXT PRIMARY KEY, parent_id TEXT, name TEXT NOT NULL, type TEXT NOT NULL,
    position_id TEXT, sort_order INTEGER NOT NULL DEFAULT 0, duties TEXT NOT NULL DEFAULT '',
    purpose TEXT NOT NULL DEFAULT '',
    supervisor_name TEXT NOT NULL DEFAULT '', supervisor_title TEXT NOT NULL DEFAULT '',
    confirmation_status TEXT NOT NULL DEFAULT '已確認',
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS positions (
    id TEXT PRIMARY KEY, job_description_id TEXT, name TEXT NOT NULL, site TEXT NOT NULL DEFAULT 'VT', department TEXT NOT NULL DEFAULT '',
    unit TEXT NOT NULL DEFAULT '', grade TEXT NOT NULL DEFAULT '', reports_to TEXT NOT NULL DEFAULT '待確認',
    status TEXT NOT NULL DEFAULT '待建立', version TEXT NOT NULL DEFAULT '0.1', effective_date TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, confidentiality TEXT NOT NULL DEFAULT '人事機密',
    headcount INTEGER NOT NULL DEFAULT 1, confirmation_status TEXT NOT NULL DEFAULT '待確認',
    confirmed_by TEXT NOT NULL DEFAULT '', confirmed_at TEXT NOT NULL DEFAULT '', confirmation_note TEXT NOT NULL DEFAULT '',
    document_json TEXT NOT NULL DEFAULT '{}'
  )`,
  `CREATE TABLE IF NOT EXISTS competencies (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL DEFAULT '專業職能',
    description TEXT NOT NULL DEFAULT '', sort_order INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS people (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, employee_no TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '',
    confirmation_status TEXT NOT NULL DEFAULT '待確認', confirmed_by TEXT NOT NULL DEFAULT '',
    confirmed_at TEXT NOT NULL DEFAULT '', confirmation_note TEXT NOT NULL DEFAULT ''
  )`,
  `CREATE TABLE IF NOT EXISTS position_people (
    id TEXT PRIMARY KEY, position_id TEXT NOT NULL, person_id TEXT NOT NULL,
    relationship_type TEXT NOT NULL, start_date TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT ''
  )`,
  `CREATE TABLE IF NOT EXISTS talent_assessments (
    id TEXT PRIMARY KEY, target_position_id TEXT NOT NULL, person_id TEXT,
    status TEXT NOT NULL DEFAULT '訪談前初稿', version TEXT NOT NULL DEFAULT '0.1',
    updated_at TEXT NOT NULL DEFAULT '', source_file TEXT NOT NULL DEFAULT '', document_json TEXT NOT NULL DEFAULT '[]'
  )`,
  `CREATE TABLE IF NOT EXISTS position_assignments (
    id TEXT PRIMARY KEY, position_id TEXT NOT NULL, person_id TEXT NOT NULL,
    start_date TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT ''
  )`,
  `CREATE TABLE IF NOT EXISTS section_confirmations (
    id TEXT PRIMARY KEY, position_id TEXT NOT NULL, section_key TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT '待確認', confirmed_by TEXT NOT NULL DEFAULT '',
    confirmed_at TEXT NOT NULL DEFAULT '', note TEXT NOT NULL DEFAULT ''
  )`,
  `CREATE TABLE IF NOT EXISTS change_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL,
    action TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  "CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)",
  "CREATE INDEX IF NOT EXISTS idx_org_nodes_parent_id ON org_nodes(parent_id)",
  "CREATE INDEX IF NOT EXISTS idx_positions_department_unit_status ON positions(department, unit, status)",
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_position_assignments_position_person ON position_assignments(position_id, person_id)",
  "CREATE INDEX IF NOT EXISTS idx_position_assignments_position ON position_assignments(position_id)",
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_position_people_relation ON position_people(position_id, person_id, relationship_type)",
  "CREATE INDEX IF NOT EXISTS idx_position_people_person ON position_people(person_id)",
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_people_employee_no ON people(employee_no) WHERE employee_no <> ''",
  "CREATE INDEX IF NOT EXISTS idx_talent_assessments_position ON talent_assessments(target_position_id)",
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_section_confirmations_position_section ON section_confirmations(position_id, section_key)",
  "CREATE INDEX IF NOT EXISTS idx_section_confirmations_status ON section_confirmations(status)",
];

export async function ensureDatabase() {
  const db = getBinding();
  await db.batch(tableStatements.map((statement) => db.prepare(statement)));
  const orgColumns = await db.prepare("PRAGMA table_info(org_nodes)").all<{ name: string }>();
  if (!orgColumns.results.some((column) => column.name === "duties")) {
    await db.prepare("ALTER TABLE org_nodes ADD COLUMN duties TEXT NOT NULL DEFAULT ''").run();
  }
  const missingOrgColumns = [
    ["purpose", "ALTER TABLE org_nodes ADD COLUMN purpose TEXT NOT NULL DEFAULT ''"],
    ["supervisor_name", "ALTER TABLE org_nodes ADD COLUMN supervisor_name TEXT NOT NULL DEFAULT ''"],
    ["supervisor_title", "ALTER TABLE org_nodes ADD COLUMN supervisor_title TEXT NOT NULL DEFAULT ''"],
    ["confirmation_status", "ALTER TABLE org_nodes ADD COLUMN confirmation_status TEXT NOT NULL DEFAULT '已確認'"],
  ].filter(([name]) => !orgColumns.results.some((column) => column.name === name));
  if (missingOrgColumns.length) await db.batch(missingOrgColumns.map(([, statement]) => db.prepare(statement)));
  const positionColumns = await db.prepare("PRAGMA table_info(positions)").all<{ name: string }>();
  const missingPositionColumns = [
    ["job_description_id", "ALTER TABLE positions ADD COLUMN job_description_id TEXT"],
    ["confirmation_status", "ALTER TABLE positions ADD COLUMN confirmation_status TEXT NOT NULL DEFAULT '待確認'"],
    ["confirmed_by", "ALTER TABLE positions ADD COLUMN confirmed_by TEXT NOT NULL DEFAULT ''"],
    ["confirmed_at", "ALTER TABLE positions ADD COLUMN confirmed_at TEXT NOT NULL DEFAULT ''"],
    ["confirmation_note", "ALTER TABLE positions ADD COLUMN confirmation_note TEXT NOT NULL DEFAULT ''"],
  ].filter(([name]) => !positionColumns.results.some((column) => column.name === name));
  if (missingPositionColumns.length) {
    await db.batch(missingPositionColumns.map(([, statement]) => db.prepare(statement)));
  }
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_positions_job_description ON positions(job_description_id)").run();
  const jobDescriptionColumns = await db.prepare("PRAGMA table_info(job_descriptions)").all<{ name: string }>();
  if (!jobDescriptionColumns.results.some((column) => column.name === "code")) {
    await db.prepare("ALTER TABLE job_descriptions ADD COLUMN code TEXT NOT NULL DEFAULT ''").run();
  }
  await db.prepare("UPDATE job_descriptions SET code = id WHERE code = ''").run();
  await db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_job_descriptions_code ON job_descriptions(code)").run();
  const peopleColumns = await db.prepare("PRAGMA table_info(people)").all<{ name: string }>();
  const missingPeopleColumns = [
    ["confirmation_status", "ALTER TABLE people ADD COLUMN confirmation_status TEXT NOT NULL DEFAULT '待確認'"],
    ["confirmed_by", "ALTER TABLE people ADD COLUMN confirmed_by TEXT NOT NULL DEFAULT ''"],
    ["confirmed_at", "ALTER TABLE people ADD COLUMN confirmed_at TEXT NOT NULL DEFAULT ''"],
    ["confirmation_note", "ALTER TABLE people ADD COLUMN confirmation_note TEXT NOT NULL DEFAULT ''"],
    ["nationality", "ALTER TABLE people ADD COLUMN nationality TEXT NOT NULL DEFAULT '越籍'"],
    ["gender", "ALTER TABLE people ADD COLUMN gender TEXT NOT NULL DEFAULT '女'"],
    ["profile_json", "ALTER TABLE people ADD COLUMN profile_json TEXT NOT NULL DEFAULT '{}'"],
  ].filter(([name]) => !peopleColumns.results.some((column) => column.name === name));
  if (missingPeopleColumns.length) await db.batch(missingPeopleColumns.map(([, statement]) => db.prepare(statement)));
  const count = await db.prepare("SELECT COUNT(*) AS count FROM positions").first<{ count: number }>();
  if ((count?.count ?? 0) === 0) {
    const statements: D1PreparedStatement[] = [];
    for (const jobDescription of seedJobDescriptions) {
      statements.push(db.prepare(
        `INSERT INTO job_descriptions
        (id, code, title, site, department, grade, reports_to, status, version, effective_date, updated_at, confidentiality,
         confirmation_status, confirmed_by, confirmed_at, confirmation_note, document_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        jobDescription.id, jobDescription.code, jobDescription.title, jobDescription.site, jobDescription.department,
        jobDescription.grade, jobDescription.reportsTo, jobDescription.status, jobDescription.version,
        jobDescription.effectiveDate, jobDescription.updatedAt, jobDescription.confidentiality,
        jobDescription.confirmationStatus, jobDescription.confirmedBy, jobDescription.confirmedAt,
        jobDescription.confirmationNote, JSON.stringify(jobDescription.document),
      ));
    }
    for (const position of seedPositions) {
      statements.push(db.prepare(
        `INSERT INTO positions
        (id, job_description_id, name, site, department, unit, grade, reports_to, status, version, effective_date, updated_at, confidentiality,
         headcount, confirmation_status, confirmed_by, confirmed_at, confirmation_note, document_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        position.id, position.jobDescriptionId, position.name, position.site, position.department, position.unit, position.grade,
        position.reportsTo, position.status, position.version, position.effectiveDate, position.updatedAt,
        position.confidentiality, position.headcount, position.confirmationStatus, position.confirmedBy,
        position.confirmedAt, position.confirmationNote, JSON.stringify(position.document),
      ));

      for (const person of position.incumbents) {
        statements.push(db.prepare(
          "INSERT OR IGNORE INTO people (id, name, employee_no, notes) VALUES (?, ?, ?, ?)",
        ).bind(person.id, person.name, person.employeeNo, person.notes));
        statements.push(db.prepare(
          "INSERT INTO position_assignments (id, position_id, person_id, start_date, notes) VALUES (?, ?, ?, ?, ?)",
        ).bind(`assign-${position.id}-${person.id}`, position.id, person.id, person.startDate, person.notes));
      }
    }

    for (const node of seedOrgNodes) {
      statements.push(db.prepare(
        "INSERT INTO org_nodes (id, parent_id, name, type, position_id, sort_order, duties, purpose, supervisor_name, supervisor_title, confirmation_status, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ).bind(node.id, node.parentId, node.name, node.type, node.positionId, node.sortOrder, node.duties, node.purpose,
        node.supervisorName ?? "", node.supervisorTitle ?? "", node.organizationStatus, IMPORT_DATE_FOR_ORG));
    }

    statements.push(db.prepare(
      "INSERT INTO app_meta (key, value) VALUES ('source_import_version', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    ).bind(CURRENT_SOURCE_VERSION));
    statements.push(db.prepare(
      "INSERT INTO change_logs (entity_type, entity_id, action, detail) VALUES ('system', 'seed', 'initial_import', '依 2026-09-10 已定稿資料匯入 VT 組織與 3 份工作說明書')",
    ));
    await db.batch(statements);
  }
  const sourceVersion = await db.prepare("SELECT value FROM app_meta WHERE key = 'source_import_version'").first<{ value: string }>();
  if (sourceVersion?.value === CURRENT_SOURCE_VERSION || sourceVersion?.value === PREVIOUS_FINALIZED_SOURCE_VERSION) {
    await migrateCompetencyMaster(db);
    await migrateManagementUnits(db);
    await migrateFinalizedLanguageRequirements(db);
    await migrateFinalizedProductionAuthority(db);
  } else {
    await migrateToCompactConfirmation(db);
    await migratePeopleInventory(db);
    await migrateUnitSupervisors(db);
    await migrateAdminManagerV06(db);
    await migrateAdminStaffV07(db);
    await migrateAdminStaffV08(db);
    await migrateCompetencyMaster(db);
    await migratePeopleNationalityGender(db);
    await migrateFixAdminManagerAnnotations(db);
    await migrateManagementUnits(db);
    await migrateFinalizedLanguageRequirements(db);
    await migrateFinalizedProductionAuthority(db);
  }
  await migrateOrganizationStructureV18(db);
  await migrateCompetencyCatalogV25(db);
  await migrateFinalizedJobDescriptions20260914(db);
  await migrateFactorySupervisorJobDescription20260914(db);
  await migrateJobDescriptionLibrary20260914(db);
  await recoverLegacyJobDescriptionEdits(db);
  await migrateDepartmentMetaFromSeed(db);
  await initializeJobDescriptionVersions(db);
  await db.prepare("PRAGMA optimize").run();
}

async function migrateOrganizationStructureV18(db: D1Database) {
  const migration = await db.prepare("SELECT value FROM app_meta WHERE key = 'organization_structure_v18'").first<{ value: string }>();
  if (migration?.value === "3") return;

  const existingRows = await db.prepare(
    "SELECT id, name, department, unit, grade, reports_to, document_json FROM positions",
  ).all<{ id: string; name: string; department: string; unit: string; grade: string; reports_to: string; document_json: string }>();
  const existingById = new Map(existingRows.results.map((row) => [row.id, row]));
  const statements: D1PreparedStatement[] = [];

  for (const position of seedPositions) {
    const existing = existingById.get(position.id);
    if (!existing) {
      statements.push(db.prepare(
        `INSERT INTO positions
        (id, job_description_id, name, site, department, unit, grade, reports_to, status, version, effective_date, updated_at, confidentiality,
         headcount, confirmation_status, confirmed_by, confirmed_at, confirmation_note, document_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        position.id, position.jobDescriptionId, position.name, position.site, position.department, position.unit, position.grade,
        position.reportsTo, position.status, position.version, position.effectiveDate, position.updatedAt,
        position.confidentiality, position.headcount, position.confirmationStatus, position.confirmedBy,
        position.confirmedAt, position.confirmationNote, JSON.stringify(position.document),
      ));
      continue;
    }

    if (position.id === "p-field-staff-manager") {
      statements.push(db.prepare(
        `UPDATE positions SET name = ?, site = ?, department = ?, unit = ?, grade = ?, reports_to = ?, status = ?,
         version = ?, effective_date = ?, updated_at = ?, confidentiality = ?, headcount = ?, confirmation_status = ?,
         confirmed_by = ?, confirmed_at = ?, confirmation_note = ?, document_json = ? WHERE id = ?`,
      ).bind(
        position.name, position.site, position.department, position.unit, position.grade, position.reportsTo,
        position.status, position.version, position.effectiveDate, position.updatedAt, position.confidentiality,
        position.headcount, position.confirmationStatus, position.confirmedBy, position.confirmedAt,
        position.confirmationNote, JSON.stringify(position.document), position.id,
      ));
      continue;
    }

    let documentJson = existing.document_json;
    if (position.id === "p-upper-manager") {
      documentJson = documentJson
        .replaceAll("現場面部經理", "現場面部副協理")
        .replaceAll("VT現場面部經理_工作說明書.md", "VT現場面部副協理_工作說明書.md");
    }
    const changed = existing.name !== position.name
      || existing.department !== position.department
      || existing.unit !== position.unit
      || existing.grade !== position.grade
      || existing.reports_to !== position.reportsTo
      || documentJson !== existing.document_json;
    if (changed) {
      statements.push(db.prepare(
        `UPDATE positions SET name = ?, department = ?, unit = ?, grade = ?, reports_to = ?, updated_at = ?, document_json = ? WHERE id = ?`,
      ).bind(
        position.name, position.department, position.unit, position.grade, position.reportsTo,
        IMPORT_DATE_FOR_ORG, documentJson, position.id,
      ));
    }
  }

  for (const node of seedOrgNodes) {
    statements.push(db.prepare(
      `INSERT INTO org_nodes
       (id, parent_id, name, type, position_id, sort_order, duties, purpose, supervisor_name, supervisor_title, confirmation_status, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET parent_id = excluded.parent_id, name = excluded.name, type = excluded.type,
       position_id = excluded.position_id, sort_order = excluded.sort_order, duties = excluded.duties,
       purpose = excluded.purpose, supervisor_name = excluded.supervisor_name,
       supervisor_title = excluded.supervisor_title, confirmation_status = excluded.confirmation_status,
       updated_at = excluded.updated_at`,
    ).bind(
      node.id, node.parentId, node.name, node.type, node.positionId, node.sortOrder, node.duties, node.purpose,
      node.supervisorName ?? "", node.supervisorTitle ?? "", node.organizationStatus, IMPORT_DATE_FOR_ORG,
    ));
  }

  statements.push(db.prepare(
    "INSERT INTO app_meta (key, value) VALUES ('organization_structure_v18', '3') ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  ));
  statements.push(db.prepare(
    "INSERT INTO app_meta (key, value) VALUES ('source_import_version', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  ).bind(CURRENT_SOURCE_VERSION));
  statements.push(db.prepare(
    "INSERT INTO change_logs (entity_type, entity_id, action, detail) VALUES ('system', 'organization-structure-v1.8', 'import_md', '依 2026-09-12 已定稿組織簡表更新 35 個單位最高主管職位，並匯入現場幕僚副協理工作說明書；IE、LEAN 依表內唯一對應單位歸於產效改善')",
  ));
  await db.batch(statements);
}

async function migrateDepartmentMetaFromSeed(db: D1Database) {
  const migration = await db.prepare("SELECT value FROM app_meta WHERE key = 'department_meta_v1'").first<{ value: string }>();
  if (migration?.value === "1") return;

  const rows = await db.prepare("SELECT id, name, type, duties, purpose FROM org_nodes").all<{
    id: string; name: string; type: "unit" | "position"; duties: string; purpose: string;
  }>();
  const seededByName = new Map(seedOrgNodes.filter((node) => node.type === "unit").map((node) => [node.name, node]));
  const statements: D1PreparedStatement[] = [];

  for (const row of rows.results) {
    if (row.type !== "unit") continue;
    const seeded = seededByName.get(row.name);
    if (!seeded) continue;

    const hasPurpose = (row.purpose || "").trim() !== "";
    const hasCustomDuties = row.duties !== "" && !row.duties.includes("尚未提供") && !row.duties.includes("待確認");
    if (!hasPurpose || !hasCustomDuties) {
      statements.push(db.prepare(
        "UPDATE org_nodes SET purpose = ?, duties = ? WHERE id = ?",
      ).bind(
        hasPurpose ? row.purpose : seeded.purpose,
        hasCustomDuties ? row.duties : seeded.duties,
        row.id,
      ));
    }
  }

  statements.push(db.prepare("INSERT INTO app_meta (key, value) VALUES ('department_meta_v1', '1') ON CONFLICT(key) DO UPDATE SET value = excluded.value"));
  await db.batch(statements);
}

async function migrateFinalizedProductionAuthority(db: D1Database) {
  const migration = await db.prepare("SELECT value FROM app_meta WHERE key = 'finalized_production_authority_v1'").first<{ value: string }>();
  if (migration?.value === "1") return;

  const finalizedIds = new Set(["p-upper-manager", "p-bottom-manager"]);
  const finalizedAuthority = new Map(
    seedPositions
      .filter((position) => finalizedIds.has(position.id))
      .map((position) => [position.id, position.document.authority]),
  );
  const rows = await db.prepare("SELECT id, document_json FROM positions").all<{ id: string; document_json: string }>();
  const statements: D1PreparedStatement[] = [];
  for (const row of rows.results) {
    const authority = finalizedAuthority.get(row.id);
    if (!authority) continue;
    const document = JSON.parse(row.document_json);
    document.authority = authority;
    statements.push(db.prepare("UPDATE positions SET document_json = ? WHERE id = ?").bind(JSON.stringify(document), row.id));
  }
  statements.push(db.prepare("INSERT INTO app_meta (key, value) VALUES ('finalized_production_authority_v1', '1') ON CONFLICT(key) DO UPDATE SET value = excluded.value"));
  statements.push(db.prepare("INSERT INTO change_logs (entity_type, entity_id, action, detail) VALUES ('system', 'finalized-production-authority-v1', 'migration', '依已定稿工作說明書同步現場面部經理與現場底部經理的決策與權限；其他資料維持不變')"));
  await db.batch(statements);
}

async function migrateFinalizedLanguageRequirements(db: D1Database) {
  const migration = await db.prepare("SELECT value FROM app_meta WHERE key = 'finalized_language_requirements_v1'").first<{ value: string }>();
  if (migration?.value === "1") return;

  const finalizedIds = new Set(["p-admin-staff-manager", "p-upper-manager", "p-bottom-manager"]);
  const finalizedLanguages = new Map(
    seedPositions
      .filter((position) => finalizedIds.has(position.id))
      .map((position) => [position.id, position.document.languages]),
  );
  const rows = await db.prepare("SELECT id, document_json FROM positions").all<{ id: string; document_json: string }>();
  const statements: D1PreparedStatement[] = [];
  for (const row of rows.results) {
    const languages = finalizedLanguages.get(row.id);
    if (!languages) continue;
    const document = JSON.parse(row.document_json);
    document.languages = languages;
    statements.push(db.prepare("UPDATE positions SET document_json = ? WHERE id = ?").bind(JSON.stringify(document), row.id));
  }
  statements.push(db.prepare("INSERT INTO app_meta (key, value) VALUES ('finalized_language_requirements_v1', '1') ON CONFLICT(key) DO UPDATE SET value = excluded.value"));
  statements.push(db.prepare("INSERT INTO change_logs (entity_type, entity_id, action, detail) VALUES ('system', 'finalized-language-requirements-v1', 'migration', '依三份已定稿工作說明書同步語言要求；文件版本及其他資料維持不變')"));
  await db.batch(statements);
}

async function migrateManagementUnits(db: D1Database) {
  const migration = await db.prepare("SELECT value FROM app_meta WHERE key = 'management_unit_field_v1'").first<{ value: string }>();
  if (migration?.value === "1") return;

  const managementUnits: Record<string, string> = {
    "p-admin-staff-manager": "行政幕僚部門（秘書、總務、環安、人事）",
    "p-upper-manager": "所轄面部生產",
    "p-bottom-manager": "所轄底部生產",
  };
  const rows = await db.prepare("SELECT id, document_json FROM positions").all<{ id: string; document_json: string }>();
  const statements: D1PreparedStatement[] = [];
  for (const row of rows.results) {
    const document = JSON.parse(row.document_json);
    if (!document.managementUnit) {
      document.managementUnit = managementUnits[row.id] ?? "待確認";
      statements.push(db.prepare("UPDATE positions SET document_json = ? WHERE id = ?").bind(JSON.stringify(document), row.id));
    }
  }
  statements.push(db.prepare("INSERT INTO app_meta (key, value) VALUES ('management_unit_field_v1', '1') ON CONFLICT(key) DO UPDATE SET value = excluded.value"));
  statements.push(db.prepare("INSERT INTO change_logs (entity_type, entity_id, action, detail) VALUES ('system', 'management-unit-field-v1', 'migration', '工作說明書基本資料以管理單位取代缺額顯示；文件版本維持不變')"));
  await db.batch(statements);
}

async function migrateFixAdminManagerAnnotations(db: D1Database) {
  const version = await db.prepare("SELECT value FROM app_meta WHERE key = 'fix_admin_annotations_v1'").first<{ value: string }>();
  if (version?.value === "1") return;
  const adminPos = await db.prepare("SELECT document_json FROM positions WHERE id = 'p-admin-manager'").first<{ document_json: string }>();
  if (adminPos?.document_json) {
    try {
      const doc = JSON.parse(adminPos.document_json);
      doc.annotations = [
        { type: "待確認", content: "人事課及環安課是否納入行政幕僚、費用核決金額、退件權、對外代表權及代理人待柯執協確認。" }
      ];
      await db.prepare("UPDATE positions SET document_json = ? WHERE id = 'p-admin-manager'").bind(JSON.stringify(doc)).run();
    } catch (e) {
      console.error(e);
    }
  }
  await db.prepare("INSERT INTO app_meta (key, value) VALUES ('fix_admin_annotations_v1', '1') ON CONFLICT(key) DO UPDATE SET value = excluded.value").run();
}

async function migratePeopleNationalityGender(db: D1Database) {
  const version = await db.prepare("SELECT value FROM app_meta WHERE key = 'people_nat_gender_v1'").first<{ value: string }>();
  if (version?.value === "1") return;
  const statements: D1PreparedStatement[] = [
    db.prepare("UPDATE people SET nationality = '台籍', gender = '男' WHERE id IN ('person-yang-min-hsuan', 'person-ko-hung-yu')"),
    db.prepare("UPDATE people SET nationality = '越籍', gender = '女' WHERE id IN ('person-nguyen-phuong-thuy', 'person-nguyen-thi-duyen', 'person-nguyen-thi-thanh', 'person-nguyen-thi-ly')"),
    db.prepare("INSERT INTO app_meta (key, value) VALUES ('people_nat_gender_v1', '1') ON CONFLICT(key) DO UPDATE SET value = excluded.value"),
    db.prepare("INSERT INTO change_logs (entity_type, entity_id, action, detail) VALUES ('system', 'people-nat-gender-v1', 'migration', '更新現有人員之國籍與性別資料')"),
  ];
  await db.batch(statements);
}

async function migrateCompetencyMaster(db: D1Database) {
  const version = await db.prepare("SELECT value FROM app_meta WHERE key = 'competency_master_v1'").first<{ value: string }>();
  if (version?.value === "1") return;
  const statements: D1PreparedStatement[] = [];
  for (const comp of seedCompetencies) {
    statements.push(db.prepare(
      `INSERT INTO competencies (id, name, category, description, sort_order, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, category = excluded.category, description = excluded.description, sort_order = excluded.sort_order`
    ).bind(comp.id, comp.name, comp.category, comp.description, comp.sortOrder, comp.updatedAt));
  }
  statements.push(db.prepare("INSERT INTO app_meta (key, value) VALUES ('competency_master_v1', '1') ON CONFLICT(key) DO UPDATE SET value = excluded.value"));
  statements.push(db.prepare("INSERT INTO change_logs (entity_type, entity_id, action, detail) VALUES ('system', 'competency-master-v1', 'initial_import', '匯入現行共通、專業及語言職能主檔')"));
  await db.batch(statements);
}

async function migrateCompetencyCatalogV25(db: D1Database) {
  const version = await db.prepare("SELECT value FROM app_meta WHERE key = 'competency_catalog_v25'").first<{ value: string }>();
  if (version?.value === "1") return;

  const positionCompetencies: Record<string, string[]> = {
    "p-admin-staff-manager": ["M01", "M02", "M03", "M04", "M05", "M06", "P01", "P05"],
    "p-field-staff-manager": ["M01", "M02", "M03", "M04", "M05", "M06", "M07", "P04"],
    "p-upper-manager": ["M01", "M02", "M03", "M04", "M05", "M06", "M07", "P02"],
    "p-bottom-manager": ["M01", "M02", "M03", "M04", "M05", "M06", "M07", "P03"],
  };
  const rows = await db.prepare(
    `SELECT id, document_json FROM positions WHERE id IN
     ('p-admin-staff-manager', 'p-field-staff-manager', 'p-upper-manager', 'p-bottom-manager')`,
  ).all<{ id: string; document_json: string }>();

  const statements: D1PreparedStatement[] = [db.prepare("DELETE FROM competencies")];
  for (const comp of seedCompetencies) {
    statements.push(db.prepare(
      `INSERT INTO competencies (id, name, category, description, sort_order, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).bind(comp.id, comp.name, comp.category, comp.description, comp.sortOrder, comp.updatedAt));
  }
  for (const row of rows.results) {
    const document = JSON.parse(row.document_json);
    document.competencies = positionCompetencies[row.id];
    statements.push(db.prepare("UPDATE positions SET document_json = ? WHERE id = ?").bind(JSON.stringify(document), row.id));
  }
  statements.push(db.prepare("INSERT INTO app_meta (key, value) VALUES ('competency_catalog_v25', '1') ON CONFLICT(key) DO UPDATE SET value = excluded.value"));
  statements.push(db.prepare("INSERT INTO change_logs (entity_type, entity_id, action, detail) VALUES ('system', 'competency-catalog-v25', 'replace_import', '清空舊職能後，依職能清單 v2.5 匯入 15 項職能，並同步四份已定稿職位的關鍵能力')"));
  await db.batch(statements);
}

async function migrateFinalizedJobDescriptions20260914(db: D1Database) {
  const version = await db.prepare("SELECT value FROM app_meta WHERE key = 'job_descriptions_20260914_v1'").first<{ value: string }>();
  if (version?.value === "1") return;

  const positionIds = [
    "p-purchasing-director",
    "p-business-director",
    "p-productivity-improvement-deputy",
    "p-ie-director",
    "p-lean-section-chief",
    "p-ehs-director",
  ];
  const positionsById = new Map(seedPositions.filter((position) => positionIds.includes(position.id)).map((position) => [position.id, position]));
  const newCompetencyIds = new Set(["P09", "P10", "P11", "P12", "P13"]);
  const statements: D1PreparedStatement[] = [];

  for (const competency of seedCompetencies.filter((item) => newCompetencyIds.has(item.id))) {
    statements.push(db.prepare(
      `INSERT INTO competencies (id, name, category, description, sort_order, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, category = excluded.category,
       description = excluded.description, sort_order = excluded.sort_order, updated_at = excluded.updated_at`,
    ).bind(competency.id, competency.name, competency.category, competency.description, competency.sortOrder, competency.updatedAt));
  }

  for (const positionId of positionIds) {
    const position = positionsById.get(positionId);
    if (!position) throw new Error(`找不到工作說明書種子資料：${positionId}`);
    statements.push(db.prepare(
      `UPDATE positions SET name = ?, site = ?, department = ?, unit = ?, grade = ?, reports_to = ?,
       status = ?, version = ?, effective_date = ?, updated_at = ?, confidentiality = ?, document_json = ?
       WHERE id = ?`,
    ).bind(
      position.name, position.site, position.department, position.unit, position.grade, position.reportsTo,
      position.status, position.version, position.effectiveDate, position.updatedAt, position.confidentiality,
      JSON.stringify(position.document), position.id,
    ));
  }

  statements.push(db.prepare("UPDATE org_nodes SET name = 'IE主任' WHERE id = 'node-ie-director'"));
  statements.push(db.prepare("UPDATE org_nodes SET supervisor_title = 'IE主任' WHERE id = 'unit-ie'"));
  statements.push(db.prepare("UPDATE org_nodes SET name = '精實改善主任' WHERE id = 'node-lean-section-chief'"));
  statements.push(db.prepare("UPDATE org_nodes SET name = '精實改善', supervisor_title = '精實改善主任' WHERE id = 'unit-lean'"));
  statements.push(db.prepare("INSERT INTO app_meta (key, value) VALUES ('job_descriptions_20260914_v1', '1') ON CONFLICT(key) DO UPDATE SET value = excluded.value"));
  statements.push(db.prepare(
    "INSERT INTO change_logs (entity_type, entity_id, action, detail) VALUES ('system', 'job-descriptions-20260914', 'import_md', '匯入採購副理、業務副理、產效改善副理、環安主任、IE主任、精實改善主任工作說明書及 P09～P13 職能')",
  ));
  await db.batch(statements);
}

async function migrateFactorySupervisorJobDescription20260914(db: D1Database) {
  const version = await db.prepare("SELECT value FROM app_meta WHERE key = 'factory_supervisor_job_description_20260914_v1'").first<{ value: string }>();
  if (version?.value === "1") return;

  const position = seedPositions.find((item) => item.id === "p-factory-supervisor");
  if (!position) throw new Error("找不到廠主管工作說明書種子資料：p-factory-supervisor");

  await db.batch([
    db.prepare(
      `UPDATE positions SET name = ?, site = ?, department = ?, unit = ?, grade = ?, reports_to = ?,
       status = ?, version = ?, effective_date = ?, updated_at = ?, confidentiality = ?, document_json = ?
       WHERE id = ?`,
    ).bind(
      position.name, position.site, position.department, position.unit, position.grade, position.reportsTo,
      position.status, position.version, position.effectiveDate, position.updatedAt, position.confidentiality,
      JSON.stringify(position.document), position.id,
    ),
    db.prepare("INSERT INTO app_meta (key, value) VALUES ('factory_supervisor_job_description_20260914_v1', '1') ON CONFLICT(key) DO UPDATE SET value = excluded.value"),
    db.prepare(
      "INSERT INTO change_logs (entity_type, entity_id, action, detail) VALUES ('position', 'p-factory-supervisor', 'import_md', '匯入廠主管工作說明書；沿用既有 M01～M07，未新增職能')",
    ),
  ]);
}

async function migrateJobDescriptionLibrary20260914(db: D1Database) {
  const version = await db.prepare("SELECT value FROM app_meta WHERE key = 'job_description_library_20260914_v1'").first<{ value: string }>();
  if (version?.value === "1") return;

  const statements: D1PreparedStatement[] = [];
  for (const seedDescription of seedJobDescriptions) {
    let jobDescription = seedDescription;
    // When upgrading, preserve the user's edited legacy document and confirmation.
    const sourcePosition = seedPositions.find((item) => item.jobDescriptionId === seedDescription.id);
    if (sourcePosition && seedDescription.id !== "jd-upper-deputy") {
      const legacy = await db.prepare(`SELECT name AS title, site, department, grade,
        reports_to AS reportsTo, status, version, effective_date AS effectiveDate,
        updated_at AS updatedAt, confidentiality, confirmation_status AS confirmationStatus,
        confirmed_by AS confirmedBy, confirmed_at AS confirmedAt, confirmation_note AS confirmationNote,
        document_json AS documentJson FROM positions WHERE id = ?`).bind(sourcePosition.id)
        .first<Omit<SeedJobDescription, "id" | "code" | "document"> & { documentJson: string }>();
      if (legacy) jobDescription = { ...seedDescription, ...legacy, document: { ...JSON.parse(legacy.documentJson), successors: [] } };
    }
    statements.push(db.prepare(
      `INSERT INTO job_descriptions
       (id, code, title, site, department, grade, reports_to, status, version, effective_date, updated_at, confidentiality,
        confirmation_status, confirmed_by, confirmed_at, confirmation_note, document_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO NOTHING`,
    ).bind(
      jobDescription.id, jobDescription.code, jobDescription.title, jobDescription.site, jobDescription.department,
      jobDescription.grade, jobDescription.reportsTo, jobDescription.status, jobDescription.version,
      jobDescription.effectiveDate, jobDescription.updatedAt, jobDescription.confidentiality,
      jobDescription.confirmationStatus, jobDescription.confirmedBy, jobDescription.confirmedAt,
      jobDescription.confirmationNote, JSON.stringify(jobDescription.document),
    ));
  }

  for (const position of seedPositions.filter((item) => item.jobDescriptionId)) {
    statements.push(db.prepare(
      "UPDATE positions SET job_description_id = ? WHERE id = ? AND job_description_id IS NULL",
    ).bind(position.jobDescriptionId, position.id));
  }
  statements.push(db.prepare("INSERT INTO app_meta (key, value) VALUES ('job_description_library_20260914_v1', '1') ON CONFLICT(key) DO UPDATE SET value = excluded.value"));
  statements.push(db.prepare(
    "INSERT INTO change_logs (entity_type, entity_id, action, detail) VALUES ('system', 'job-description-library', 'shared_import', '建立工作說明書主檔與唯一代碼；既有 11 份文件各自連結，VT1、VT2、VT3、VT5 面部副理共同引用 JD-VT-012')",
  ));
  await db.batch(statements);
}

async function recoverLegacyJobDescriptionEdits(db: D1Database) {
  const key = "job_description_legacy_recovery_20260914_v1";
  if (await db.prepare("SELECT value FROM app_meta WHERE key = ?").bind(key).first()) return;
  const statements: D1PreparedStatement[] = [];
  for (const seed of seedJobDescriptions.filter((item) => item.id !== "jd-upper-deputy")) {
    const current = await db.prepare("SELECT * FROM job_descriptions WHERE id = ?").bind(seed.id).first<Record<string, unknown>>();
    if (!current) continue;
    const expected = {
      code: seed.code, title: seed.title, site: seed.site, department: seed.department,
      grade: seed.grade, reports_to: seed.reportsTo, status: seed.status, version: seed.version,
      effective_date: seed.effectiveDate, updated_at: seed.updatedAt, confidentiality: seed.confidentiality,
      confirmation_status: seed.confirmationStatus, confirmed_by: seed.confirmedBy,
      confirmed_at: seed.confirmedAt, confirmation_note: seed.confirmationNote,
      document_json: JSON.stringify(seed.document),
    };
    // Only repair a master still identical to the original seed; never replace later edits.
    if (!Object.entries(expected).every(([field, value]) => current[field] === value)) continue;
    const source = seedPositions.find((item) => item.jobDescriptionId === seed.id);
    if (!source) continue;
    const legacy = await db.prepare("SELECT * FROM positions WHERE id = ? AND job_description_id = ?")
      .bind(source.id, seed.id).first<Record<string, string | number | null>>();
    if (!legacy || typeof legacy.document_json !== "string") continue;
    const document = { ...JSON.parse(legacy.document_json), successors: [] };
    const fields = ["site", "department", "grade", "reports_to", "status", "version", "effective_date", "updated_at", "confidentiality", "confirmation_status", "confirmed_by", "confirmed_at", "confirmation_note"];
    if (legacy.name === current.title && fields.every((field) => legacy[field] === current[field]) && JSON.stringify(document) === current.document_json) continue;
    statements.push(db.prepare(`UPDATE job_descriptions SET title = ?, ${fields.map((field) => `${field} = ?`).join(", ")}, document_json = ? WHERE id = ?`)
      .bind(legacy.name, ...fields.map((field) => legacy[field]), JSON.stringify(document), seed.id));
    statements.push(db.prepare("INSERT INTO change_logs (entity_type, entity_id, action, detail) VALUES ('job_description', ?, 'recover_legacy', ?)")
      .bind(seed.id, "還原建立共用主檔前保留的人工修訂；僅修復仍與種子相同、尚未再次編輯的主檔。"));
  }
  statements.push(db.prepare("INSERT INTO app_meta (key, value) VALUES (?, '1')").bind(key));
  await db.batch(statements);
}

async function migrateAdminStaffV08(db: D1Database) {
  const version = await db.prepare("SELECT value FROM app_meta WHERE key = 'admin_staff_v08_version'").first<{ value: string }>();
  if (version?.value === "1") return;
  const adminPosition = seedPositions.find((p) => p.id === "p-admin-manager");
  if (!adminPosition) return;

  const statements: D1PreparedStatement[] = [
    db.prepare(`UPDATE positions SET status = ?, version = ?, updated_at = ?, document_json = ? WHERE id = 'p-admin-manager'`)
      .bind(adminPosition.status, adminPosition.version, adminPosition.updatedAt, JSON.stringify(adminPosition.document)),
    db.prepare("INSERT INTO app_meta (key, value) VALUES ('admin_staff_v08_version', '1') ON CONFLICT(key) DO UPDATE SET value = excluded.value"),
    db.prepare("INSERT INTO change_logs (entity_type, entity_id, action, detail) VALUES ('system', 'admin-staff-v08', 'import_md', '同步 2026-08-12 行政幕僚經理工作說明書 v0.8 至 DB')"),
  ];
  await db.batch(statements);
}

async function migrateAdminStaffV07(db: D1Database) {
  const version = await db.prepare("SELECT value FROM app_meta WHERE key = 'admin_staff_v07_version'").first<{ value: string }>();
  if (version?.value === "1") return;
  const adminPosition = seedPositions.find((p) => p.id === "p-admin-manager");
  const adminAssessment = seedAssessments.find((a) => a.id === "assessment-admin-manager");
  if (!adminPosition || !adminAssessment) return;

  const statements: D1PreparedStatement[] = [
    db.prepare("UPDATE org_nodes SET name = '行政幕僚' WHERE id = 'unit-admin'"),
    db.prepare("UPDATE org_nodes SET name = '行政幕僚經理' WHERE id = 'node-admin-manager'"),
    db.prepare("UPDATE positions SET department = '行政幕僚' WHERE id IN ('p-secretariat-director', 'p-visa-specialist', 'p-attendance-specialist', 'p-travel-assistant')"),
    db.prepare("UPDATE positions SET reports_to = 'VT 廠行政幕僚經理（待確認）' WHERE id = 'p-secretariat-director'"),
    db.prepare(`UPDATE positions SET name = ?, department = ?, reports_to = ?, status = ?, version = ?, updated_at = ?, document_json = ? WHERE id = 'p-admin-manager'`)
      .bind(adminPosition.name, adminPosition.department, adminPosition.reportsTo, adminPosition.status, adminPosition.version, adminPosition.updatedAt, JSON.stringify(adminPosition.document)),
    db.prepare(`UPDATE talent_assessments SET status = ?, version = ?, updated_at = ?, source_file = ?, document_json = ? WHERE id = 'assessment-admin-manager'`)
      .bind(adminAssessment.status, adminAssessment.version, adminAssessment.updatedAt, adminAssessment.sourceFile, JSON.stringify(adminAssessment.sections)),
    db.prepare("INSERT INTO app_meta (key, value) VALUES ('admin_staff_v07_version', '1') ON CONFLICT(key) DO UPDATE SET value = excluded.value"),
    db.prepare("INSERT INTO change_logs (entity_type, entity_id, action, detail) VALUES ('system', 'admin-staff-v07', 'rename', '調整單位名稱為行政幕僚，職位名稱為行政幕僚經理並同步 MD 至 DB')"),
  ];
  await db.batch(statements);
}

async function migrateAdminManagerV06(db: D1Database) {
  const version = await db.prepare("SELECT value FROM app_meta WHERE key = 'admin_manager_v06_version'").first<{ value: string }>();
  if (version?.value === "1") return;
  const adminPosition = seedPositions.find((p) => p.id === "p-admin-manager");
  const adminAssessment = seedAssessments.find((a) => a.id === "assessment-admin-manager");
  if (!adminPosition || !adminAssessment) return;

  const statements: D1PreparedStatement[] = [
    db.prepare(`UPDATE positions SET name = ?, reports_to = ?, status = ?, version = ?, updated_at = ?, document_json = ? WHERE id = 'p-admin-manager'`)
      .bind(adminPosition.name, adminPosition.reportsTo, adminPosition.status, adminPosition.version, adminPosition.updatedAt, JSON.stringify(adminPosition.document)),
    db.prepare(`UPDATE talent_assessments SET status = ?, version = ?, updated_at = ?, document_json = ? WHERE id = 'assessment-admin-manager'`)
      .bind(adminAssessment.status, adminAssessment.version, adminAssessment.updatedAt, JSON.stringify(adminAssessment.sections)),
    db.prepare("INSERT INTO app_meta (key, value) VALUES ('admin_manager_v06_version', '1') ON CONFLICT(key) DO UPDATE SET value = excluded.value"),
    db.prepare("INSERT INTO change_logs (entity_type, entity_id, action, detail) VALUES ('system', 'admin-manager-v06', 'import_md', '同步 2026-08-12 楊旻軒與行政部經理訪談修訂檔至 DB')"),
  ];
  await db.batch(statements);
}

async function migrateUnitSupervisors(db: D1Database) {
  const version = await db.prepare("SELECT value FROM app_meta WHERE key = 'unit_supervisor_version'").first<{ value: string }>();
  if (version?.value === "1") return;
  await db.batch([
    db.prepare("UPDATE org_nodes SET supervisor_name = '柯宏育', supervisor_title = '執行協理' WHERE id = 'node-factory-manager'"),
    db.prepare("UPDATE org_nodes SET supervisor_name = '楊旻軒', supervisor_title = '經理' WHERE id = 'unit-admin'"),
    db.prepare("UPDATE org_nodes SET supervisor_name = '阮氏李', supervisor_title = '課長' WHERE id = 'unit-secretariat'"),
    db.prepare("INSERT INTO app_meta (key, value) VALUES ('unit_supervisor_version', '1') ON CONFLICT(key) DO UPDATE SET value = excluded.value"),
    db.prepare("INSERT INTO change_logs (entity_type, entity_id, action, detail) VALUES ('system', 'unit-supervisor-v1', 'initial_import', '匯入使用者確認的三筆單位主管資料')"),
  ]);
}

async function migratePeopleInventory(db: D1Database) {
  const version = await db.prepare("SELECT value FROM app_meta WHERE key = 'people_seed_version'").first<{ value: string }>();
  if (version?.value === "3") return;
  const statements: D1PreparedStatement[] = [
    db.prepare(`INSERT OR IGNORE INTO position_people (id, position_id, person_id, relationship_type, start_date, notes)
      SELECT 'migrated-' || id, position_id, person_id, '現任者', start_date, notes FROM position_assignments`),
  ];
  for (const person of seedPeople) {
    statements.push(db.prepare(`INSERT INTO people (id, name, notes) VALUES (?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET name = excluded.name, notes = CASE WHEN people.notes = '' THEN excluded.notes ELSE people.notes END`)
      .bind(person.id, person.name, person.notes));
  }
  for (const link of seedPositionPeople) {
    statements.push(db.prepare(`INSERT INTO position_people (id, position_id, person_id, relationship_type, notes)
      VALUES (?, ?, ?, ?, ?) ON CONFLICT(position_id, person_id, relationship_type) DO UPDATE SET notes = excluded.notes`)
      .bind(link.id, link.positionId, link.personId, link.relationshipType, link.notes));
  }
  for (const assessment of seedAssessments) {
    statements.push(db.prepare(`INSERT INTO talent_assessments
      (id, target_position_id, person_id, status, version, updated_at, source_file, document_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET target_position_id = excluded.target_position_id,
      person_id = excluded.person_id, status = excluded.status, version = excluded.version, updated_at = excluded.updated_at,
      source_file = excluded.source_file, document_json = excluded.document_json`)
      .bind(assessment.id, assessment.targetPositionId, assessment.personId, assessment.status, assessment.version,
        assessment.updatedAt, assessment.sourceFile, JSON.stringify(assessment.sections)));
  }
  statements.push(db.prepare("INSERT INTO app_meta (key, value) VALUES ('people_seed_version', '3') ON CONFLICT(key) DO UPDATE SET value = excluded.value"));
  statements.push(db.prepare("INSERT INTO change_logs (entity_type, entity_id, action, detail) VALUES ('system', 'people-seed-v1', 'initial_import', '匯入 5 份人員盤點與多對多職位關係')"));
  await db.batch(statements);
}

function normalizeStoredText(value: string) {
  const stripped = value.replace(/VT\s*廠\s*/g, "").trim().replace(/🔴\s*/g, "").replace(/([\u3400-\u9fff])\s+([\u3400-\u9fff])/g, "$1$2");
  const withLabels = stripped.replace(/(待確認|待訪談|建議新增|權責調整)｜/g, "🔴 $1｜");
  if (/^(待確認|待訪談)$/.test(withLabels)) return `🔴 ${withLabels}`;
  return withLabels;
}

function normalizeStoredValue(value: unknown, keyName = ""): unknown {
  if (typeof value === "string") return keyName === "type" || keyName === "annotation" ? value : normalizeStoredText(value);
  if (Array.isArray(value)) return value.map((item) => normalizeStoredValue(item, keyName));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeStoredValue(item, key)]));
  }
  return value;
}

async function migrateToCompactConfirmation(db: D1Database) {
  const version = await db.prepare("SELECT value FROM app_meta WHERE key = 'ux_version'").first<{ value: string }>();
  if (version?.value === "4") return;
  const positionRows = await db.prepare("SELECT id, name, reports_to, document_json FROM positions").all<{
    id: string; name: string; reports_to: string; document_json: string;
  }>();
  const statements: D1PreparedStatement[] = [
    db.prepare("UPDATE org_nodes SET name = 'VT廠', type = 'unit', position_id = NULL, duties = CASE WHEN duties = '' THEN '🔴 待確認｜請主管確認本單位的主要執掌。' ELSE duties END WHERE id = 'node-factory-manager'"),
    db.prepare("INSERT OR IGNORE INTO org_nodes (id, parent_id, name, type, position_id, sort_order, duties) VALUES ('node-executive-associate', 'node-factory-manager', '執行協理', 'position', 'p-factory-manager', 0, '')"),
    db.prepare("UPDATE positions SET name = '執行協理', grade = '執行協理' WHERE id = 'p-factory-manager'"),
    db.prepare("UPDATE org_nodes SET duties = '🔴 待確認｜請主管確認本單位的主要執掌。' WHERE type = 'unit' AND duties = ''"),
  ];
  for (const row of positionRows.results) {
    const document = normalizeStoredValue(JSON.parse(row.document_json));
    const name = row.id === "p-factory-manager" ? "執行協理" : normalizeStoredText(row.name);
    statements.push(db.prepare("UPDATE positions SET name = ?, reports_to = ?, document_json = ? WHERE id = ?")
      .bind(name, normalizeStoredText(row.reports_to), JSON.stringify(document), row.id));
  }
  statements.push(db.prepare("INSERT INTO app_meta (key, value) VALUES ('ux_version', '4') ON CONFLICT(key) DO UPDATE SET value = excluded.value"));
  statements.push(db.prepare("INSERT INTO change_logs (entity_type, entity_id, action, detail) VALUES ('system', 'ux-v2', 'migration', '組織圖與職位確認流程調整')"));
  await db.batch(statements);
}

type PositionRow = {
  id: string; job_description_id: string | null; name: string; site: string; department: string; unit: string; grade: string;
  reports_to: string; status: string; version: string; effective_date: string; updated_at: string;
  confidentiality: string; headcount: number; document_json: string;
  confirmation_status: "待確認" | "在職人員確認" | "主管確認";
  confirmed_by: string; confirmed_at: string; confirmation_note: string;
  jd_title: string | null; jd_grade: string | null; jd_reports_to: string | null;
  jd_status: string | null; jd_version: string | null; jd_effective_date: string | null;
  jd_updated_at: string | null; jd_confidentiality: string | null; jd_document_json: string | null;
  jd_confirmation_status: "待確認" | "在職人員確認" | "主管確認" | null;
  jd_confirmed_by: string | null; jd_confirmed_at: string | null; jd_confirmation_note: string | null;
};

export async function readAppData(): Promise<AppData> {
  await ensureDatabase();
  const db = getBinding();
  const [positionsResult, jobDescriptionsResult, nodesResult, linksResult, peopleResult, assessmentsResult, competenciesResult] = await Promise.all([
    db.prepare(`SELECT p.*,
      jd.title AS jd_title, jd.grade AS jd_grade, jd.reports_to AS jd_reports_to,
      jd.status AS jd_status, jd.version AS jd_version, jd.effective_date AS jd_effective_date,
      jd.updated_at AS jd_updated_at, jd.confidentiality AS jd_confidentiality,
      jd.confirmation_status AS jd_confirmation_status, jd.confirmed_by AS jd_confirmed_by,
      jd.confirmed_at AS jd_confirmed_at, jd.confirmation_note AS jd_confirmation_note,
      jd.document_json AS jd_document_json
      FROM positions p LEFT JOIN job_descriptions jd ON jd.id = p.job_description_id
      ORDER BY p.department, p.unit, p.name`).all<PositionRow>(),
    db.prepare("SELECT * FROM job_descriptions ORDER BY code, title").all<{
      id: string; code: string; title: string; site: string; department: string; grade: string; reports_to: string;
      status: string; version: string; effective_date: string; updated_at: string; confidentiality: string;
      confirmation_status: "待確認" | "在職人員確認" | "主管確認"; confirmed_by: string;
      confirmed_at: string; confirmation_note: string; document_json: string;
    }>(),
    db.prepare("SELECT id, parent_id, name, type, position_id, sort_order, duties, purpose, supervisor_name, supervisor_title, confirmation_status FROM org_nodes ORDER BY sort_order, name").all<{
      id: string; parent_id: string | null; name: string; type: "unit" | "position"; position_id: string | null; sort_order: number; duties: string; purpose: string; supervisor_name: string; supervisor_title: string; confirmation_status: "待確認" | "已確認";
    }>(),
    db.prepare(`SELECT pp.id AS link_id, pp.position_id, pp.relationship_type, p.id, p.name, p.employee_no, pp.start_date, pp.notes
      FROM position_people pp JOIN people p ON p.id = pp.person_id ORDER BY p.name`).all<{
        link_id: string; position_id: string; relationship_type: "現任者" | "潛在接班人"; id: string; name: string; employee_no: string; start_date: string; notes: string;
      }>(),
    db.prepare("SELECT * FROM people ORDER BY name").all<{ id: string; name: string; employee_no: string; nationality: string; gender: string; notes: string; profile_json: string; confirmation_status: "待確認" | "在職人員確認" | "主管確認"; confirmed_by: string; confirmed_at: string; confirmation_note: string }>(),
    db.prepare("SELECT * FROM talent_assessments ORDER BY updated_at DESC, id").all<{ id: string; target_position_id: string; person_id: string | null; status: string; version: string; updated_at: string; source_file: string; document_json: string }>(),
    db.prepare("SELECT id, name, category, description, sort_order, updated_at FROM competencies ORDER BY sort_order, name").all<{
      id: string; name: string; category: "管理職能" | "專業職能" | "語言能力"; description: string; sort_order: number; updated_at: string;
    }>(),
  ]);

  const positions: PositionRecord[] = positionsResult.results.map((row) => {
    const usesSharedJobDescription = Boolean(row.job_description_id && row.jd_document_json);
    const document = JSON.parse(usesSharedJobDescription ? row.jd_document_json! : row.document_json);
    const linkedSuccessors = linksResult.results.filter((person) => person.position_id === row.id && person.relationship_type === "潛在接班人").map((person) => `${person.name}${person.notes ? `（${person.notes}）` : ""}`);
    if (linkedSuccessors.length) document.successors = linkedSuccessors;
    return ({
    id: row.id,
    jobDescriptionId: row.job_description_id,
    name: usesSharedJobDescription ? row.jd_title! : row.name,
    site: row.site,
    department: row.department,
    unit: row.unit,
    grade: usesSharedJobDescription ? row.jd_grade! : row.grade,
    reportsTo: usesSharedJobDescription ? row.jd_reports_to! : row.reports_to,
    status: usesSharedJobDescription ? row.jd_status! : row.status,
    version: usesSharedJobDescription ? row.jd_version! : row.version,
    effectiveDate: usesSharedJobDescription ? row.jd_effective_date! : row.effective_date,
    updatedAt: usesSharedJobDescription ? row.jd_updated_at! : row.updated_at,
    confidentiality: usesSharedJobDescription ? row.jd_confidentiality! : row.confidentiality,
    headcount: row.headcount,
    confirmationStatus: usesSharedJobDescription ? row.jd_confirmation_status! : row.confirmation_status,
    confirmedBy: usesSharedJobDescription ? row.jd_confirmed_by! : row.confirmed_by,
    confirmedAt: usesSharedJobDescription ? row.jd_confirmed_at! : row.confirmed_at,
    confirmationNote: usesSharedJobDescription ? row.jd_confirmation_note! : row.confirmation_note,
    document,
    incumbents: linksResult.results.filter((person) => person.position_id === row.id && person.relationship_type === "現任者").map((person) => ({
      id: person.id, name: person.name, employeeNo: person.employee_no, startDate: person.start_date, notes: person.notes,
    })),
    successors: linksResult.results.filter((person) => person.position_id === row.id && person.relationship_type === "潛在接班人").map((person) => ({
      id: person.id, name: person.name, employeeNo: person.employee_no, startDate: person.start_date, notes: person.notes,
    })),
    });
  });

  const jobDescriptionUsage = new Map<string, number>();
  for (const position of positions) {
    if (!position.jobDescriptionId) continue;
    jobDescriptionUsage.set(position.jobDescriptionId, (jobDescriptionUsage.get(position.jobDescriptionId) ?? 0) + 1);
  }

  const jobDescriptions: JobDescriptionRecord[] = jobDescriptionsResult.results.map((row) => ({
    id: row.id,
    code: row.code,
    title: row.title,
    site: row.site,
    department: row.department,
    grade: row.grade,
    reportsTo: row.reports_to,
    status: row.status,
    version: row.version,
    effectiveDate: row.effective_date,
    updatedAt: row.updated_at,
    confidentiality: row.confidentiality,
    confirmationStatus: row.confirmation_status,
    confirmedBy: row.confirmed_by,
    confirmedAt: row.confirmed_at,
    confirmationNote: row.confirmation_note,
    document: JSON.parse(row.document_json),
    usageCount: jobDescriptionUsage.get(row.id) ?? 0,
  }));
  for (const position of positions) {
    position.jobDescriptionUsageCount = position.jobDescriptionId
      ? jobDescriptionUsage.get(position.jobDescriptionId) ?? 1
      : 1;
  }

  const versions = await readVersions(db);
  for (const master of jobDescriptions) {
    master.versions = versions.filter((version) => version.record.id === master.id);
    const latest = master.versions[0];
    const active = master.versions.find((version) => version.status === "正式生效");
    if (latest) Object.assign(master, latest.record, { usageCount: master.usageCount, versions: master.versions });
    master.currentEffectiveVersion = active?.version;
    master.currentEffectiveRevisionId = active?.id;
    // A new draft never replaces the effective document used by organization positions.
    const displayed = active ?? latest;
    if (displayed) for (const position of positions.filter((item) => item.jobDescriptionId === master.id)) {
      const record = displayed.record;
      Object.assign(position, { name: record.title, grade: record.grade, reportsTo: record.reportsTo,
        reviewer: record.reviewer ?? "",
        status: record.status, version: record.version, effectiveDate: record.effectiveDate,
        updatedAt: record.updatedAt,
        confidentiality: record.confidentiality, confirmationStatus: record.confirmationStatus,
        confirmedBy: record.confirmedBy, confirmedAt: record.confirmedAt, confirmationNote: record.confirmationNote,
        document: { ...record.document, successors: position.document.successors } });
    }
  }

  const orgNodes: OrgNode[] = nodesResult.results.map((node) => ({
    id: node.id, parentId: node.parent_id, name: node.name, type: node.type,
    positionId: node.position_id, sortOrder: node.sort_order, duties: node.duties, purpose: node.purpose,
    supervisorName: node.supervisor_name, supervisorTitle: node.supervisor_title,
    organizationStatus: node.confirmation_status,
  }));
  const positionNames = new Map(positions.map((position) => [position.id, position.name]));
  const people: PersonRecord[] = peopleResult.results.map((person) => {
    const profileData = readPersonProfile(person.profile_json);
    return {
      id: person.id,
      name: person.name,
      employeeNo: person.employee_no,
      nationality: person.nationality || "越籍",
      gender: person.gender || "女",
      notes: person.notes,
      confirmationStatus: person.confirmation_status,
      confirmedBy: person.confirmed_by,
      confirmedAt: person.confirmed_at,
      confirmationNote: person.confirmation_note,
      positions: linksResult.results.filter((link) => link.id === person.id).map((link) => ({
        id: link.link_id, positionId: link.position_id, positionName: positionNames.get(link.position_id) ?? "職位待確認",
        relationshipType: link.relationship_type, notes: link.notes,
      })),
      possessedCompetencies: profileData.possessedCompetencies ?? [],
      achievements: profileData.achievements ?? [],
      departmentRotations: profileData.departmentRotations ?? [],
      managementExperiences: profileData.managementExperiences ?? [],
      trainingRecords: profileData.trainingRecords ?? [],
      rewardsAndDisciplinary: profileData.rewardsAndDisciplinary ?? [],
      careerTrajectories: profileData.careerTrajectories ?? [],
    };
  });
  const peopleNames = new Map(people.map((person) => [person.id, person.name]));
  const assessments = assessmentsResult.results.map((assessment) => {
    const { finalizedDate, sections } = readAssessmentDocument(assessment.document_json, assessment.updated_at);
    return {
      id: assessment.id,
      targetPositionId: assessment.target_position_id,
      targetPositionName: positionNames.get(assessment.target_position_id) ?? "職位待確認",
      personId: assessment.person_id,
      personName: assessment.person_id ? peopleNames.get(assessment.person_id) ?? "人員待確認" : "人員待確認",
      status: assessment.status,
      version: assessment.version,
      updatedAt: assessment.updated_at,
      finalizedDate,
      sourceFile: assessment.source_file,
      sections,
    };
  });
  const competencies: CompetencyRecord[] = competenciesResult.results.map((row) => ({
    id: row.id,
    name: row.name,
    category: row.category as "管理職能" | "專業職能" | "語言能力",
    description: row.description,
    sortOrder: row.sort_order,
    updatedAt: row.updated_at,
  }));

  return { positions, jobDescriptions, orgNodes, people, assessments, competencies };
}

export async function saveCompetency(comp: CompetencyRecord) {
  await ensureDatabase();
  const db = getBinding();
  const statements: D1PreparedStatement[] = [
    db.prepare(`INSERT INTO competencies (id, name, category, description, sort_order, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
      name = excluded.name, category = excluded.category,
      description = excluded.description, sort_order = excluded.sort_order, updated_at = excluded.updated_at`)
      .bind(comp.id, comp.name.trim(), comp.category, comp.description.trim(), comp.sortOrder || 0, new Date().toISOString().slice(0, 10)),
    db.prepare("INSERT INTO change_logs (entity_type, entity_id, action, detail) VALUES ('competency', ?, 'save', ?)").bind(comp.id, comp.name.trim()),
  ];
  await db.batch(statements);
}

export async function deleteCompetency(competencyId: string) {
  await ensureDatabase();
  const db = getBinding();
  const statements: D1PreparedStatement[] = [
    db.prepare("DELETE FROM competencies WHERE id = ?").bind(competencyId),
    db.prepare("INSERT INTO change_logs (entity_type, entity_id, action, detail) VALUES ('competency', ?, 'delete', '')").bind(competencyId),
  ];
  await db.batch(statements);
}

export async function saveJobDescription(jobDescription: JobDescriptionRecord) {
  await ensureDatabase();
  const db = getBinding();
  await db.batch(await prepareVersionSave(db, jobDescription));
}

export async function createJobDescriptionVersion(masterId: string, version: string, expectedId: string) {
  await ensureDatabase();
  await createVersion(getBinding(), masterId, version, expectedId);
}

export async function activateJobDescriptionVersion(masterId: string, revisionId: string, token: string, date: string) {
  await ensureDatabase();
  await activateVersion(getBinding(), masterId, revisionId, token, date);
}

export async function linkPositionJobDescription(positionId: string, jobDescriptionId: string | null) {
  await ensureDatabase();
  const db = getBinding();
  const position = await db.prepare("SELECT id FROM positions WHERE id = ?").bind(positionId).first<{ id: string }>();
  if (!position) throw new Error("找不到指定的組織職位。");
  if (jobDescriptionId) {
    const jobDescription = await db.prepare("SELECT id, title, grade, reports_to FROM job_descriptions WHERE id = ?")
      .bind(jobDescriptionId).first<{ id: string; title: string; grade: string; reports_to: string }>();
    if (!jobDescription) throw new Error("找不到指定的工作說明書。");
    await db.batch([
      db.prepare("UPDATE positions SET job_description_id = ?, name = ?, grade = ?, reports_to = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .bind(jobDescription.id, jobDescription.title, jobDescription.grade, jobDescription.reports_to, positionId),
      db.prepare("INSERT INTO change_logs (entity_type, entity_id, action, detail) VALUES ('position', ?, 'link_job_description', ?)")
        .bind(positionId, jobDescription.id),
    ]);
    return;
  }
  await db.batch([
    db.prepare("UPDATE positions SET job_description_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(positionId),
    db.prepare("INSERT INTO change_logs (entity_type, entity_id, action, detail) VALUES ('position', ?, 'unlink_job_description', '')").bind(positionId),
  ]);
}

export async function savePosition(position: PositionRecord) {
  await ensureDatabase();
  const db = getBinding();
  const existingPosition = await db.prepare("SELECT job_description_id FROM positions WHERE id = ?")
    .bind(position.id).first<{ job_description_id: string | null }>();
  if (!existingPosition) throw new Error("找不到指定的組織職位。");
  if (existingPosition.job_description_id !== position.jobDescriptionId) {
    throw new Error("此職位的工作說明書關聯已變更，請重新載入後再編輯。");
  }
  if (!position.name.trim()) throw new Error("職位名稱不可空白。");
  if (position.jobDescriptionId) {
    const current = (await readAppData()).positions.find((item) => item.id === position.id)!;
    const sharedFields = ["name", "grade", "reportsTo", "status", "version", "effectiveDate", "confidentiality", "confirmationStatus", "confirmedBy", "confirmedAt", "confirmationNote"] as const;
    if (sharedFields.some((field) => current[field] !== position[field]) ||
      JSON.stringify({ ...current.document, successors: [] }) !== JSON.stringify({ ...position.document, successors: [] })) {
      throw new Error("共用文件請到工作說明書頁編輯或新增版本；本頁僅更新組織配置與人員。");
    }
  }
  const updatedAt = new Date().toISOString().slice(0, 10);
  const document = {
    ...position.document,
    successors: position.jobDescriptionId ? [] : (position.successors ?? []).map((person) => person.name),
  };
  const linkedPeople = [...position.incumbents, ...(position.successors ?? [])];
  if (new Set(linkedPeople.map((person) => person.id)).size !== linkedPeople.length) {
    throw new Error("同一人不可重複設定為此職位的現任者或潛在接班人。");
  }
  for (const person of linkedPeople) {
    const existing = await db.prepare("SELECT id FROM people WHERE id = ?").bind(person.id).first<{ id: string }>();
    if (!existing) throw new Error("現任者或潛在接班人尚未對應到人員主檔，請先確認工號。");
  }
  const statements: D1PreparedStatement[] = [
    db.prepare(`UPDATE positions SET job_description_id = ?, name = ?, site = ?, department = ?, unit = ?, grade = ?, reports_to = ?,
      status = ?, version = ?, effective_date = ?, updated_at = ?, confidentiality = ?, headcount = ?,
      confirmation_status = ?, confirmed_by = ?, confirmed_at = ?, confirmation_note = ?, document_json = ? WHERE id = ?`)
      .bind(position.jobDescriptionId, position.name, position.site, position.department, position.unit, position.grade, position.reportsTo,
        position.status, position.version, position.effectiveDate, updatedAt, position.confidentiality,
        Math.max(0, Number(position.headcount) || 0), position.confirmationStatus, position.confirmedBy,
        position.confirmedAt, position.confirmationNote, JSON.stringify(document), position.id),
    db.prepare("DELETE FROM position_people WHERE position_id = ?").bind(position.id),
  ];
  for (const person of position.incumbents) {
    statements.push(db.prepare(
      "INSERT INTO position_people (id, position_id, person_id, relationship_type, start_date, notes) VALUES (?, ?, ?, '現任者', ?, ?)",
    ).bind(`current-${position.id}-${person.id}`, position.id, person.id, person.startDate, person.notes));
  }
  for (const person of position.successors ?? []) {
    statements.push(db.prepare(
      "INSERT INTO position_people (id, position_id, person_id, relationship_type, start_date, notes) VALUES (?, ?, ?, '潛在接班人', ?, ?)",
    ).bind(`successor-${position.id}-${person.id}`, position.id, person.id, person.startDate, person.notes));
  }

  statements.push(db.prepare(
    "INSERT INTO change_logs (entity_type, entity_id, action, detail) VALUES ('position', ?, 'update', '由網頁更新職位資料')",
  ).bind(position.id));
  await db.batch(statements);
}

export async function savePerson(person: PersonRecord) {
  await ensureDatabase();
  const db = getBinding();
  const uniqueRelations = new Set(person.positions.map((link) => `${link.positionId}:${link.relationshipType}`));
  if (uniqueRelations.size !== person.positions.length) throw new Error("同一人不可重複連結相同職位與關係類型。");
  const profileJson = JSON.stringify({
    possessedCompetencies: person.possessedCompetencies ?? [],
    achievements: person.achievements ?? [],
    departmentRotations: person.departmentRotations ?? [],
    managementExperiences: person.managementExperiences ?? [],
    trainingRecords: person.trainingRecords ?? [],
    rewardsAndDisciplinary: person.rewardsAndDisciplinary ?? [],
    careerTrajectories: person.careerTrajectories ?? [],
  });

  const statements: D1PreparedStatement[] = [
    db.prepare(`UPDATE people SET name = ?, employee_no = ?, nationality = ?, gender = ?, notes = ?, confirmation_status = ?,
      confirmed_by = ?, confirmed_at = ?, confirmation_note = ?, profile_json = ? WHERE id = ?`)
      .bind(person.name.trim(), person.employeeNo, person.nationality || "越籍", person.gender || "女", person.notes, person.confirmationStatus,
        person.confirmedBy, person.confirmedAt, person.confirmationNote, profileJson, person.id),
    db.prepare("DELETE FROM position_people WHERE person_id = ?").bind(person.id),
  ];
  for (const link of person.positions) {
    statements.push(db.prepare(`INSERT INTO position_people
      (id, position_id, person_id, relationship_type, notes) VALUES (?, ?, ?, ?, ?)`)
      .bind(link.id, link.positionId, person.id, link.relationshipType, link.notes));
  }
  statements.push(db.prepare(
    "INSERT INTO change_logs (entity_type, entity_id, action, detail) VALUES ('person', ?, 'update', '由網頁更新人員資料與職位連結')",
  ).bind(person.id));
  await db.batch(statements);
}

export async function moveOrgNode(nodeId: string, parentId: string | null) {
  await ensureDatabase();
  const db = getBinding();
  if (nodeId === "node-factory-manager") throw new Error("根節點不可移動。");
  const rows = await db.prepare("SELECT id, parent_id FROM org_nodes").all<{ id: string; parent_id: string | null }>();
  const parents = new Map(rows.results.map((row) => [row.id, row.parent_id]));
  let cursor = parentId;
  while (cursor) {
    if (cursor === nodeId) throw new Error("不可形成循環從屬關係。");
    cursor = parents.get(cursor) ?? null;
  }
  await db.batch([
    db.prepare("UPDATE org_nodes SET parent_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(parentId, nodeId),
    db.prepare("INSERT INTO change_logs (entity_type, entity_id, action, detail) VALUES ('org_node', ?, 'move', ?)").bind(nodeId, `新上層：${parentId ?? "無"}`),
  ]);
}

export async function addOrgNode(node: OrgNode, position?: PositionRecord) {
  await ensureDatabase();
  const db = getBinding();
  const statements: D1PreparedStatement[] = [
    db.prepare("INSERT INTO org_nodes (id, parent_id, name, type, position_id, sort_order, duties, purpose, supervisor_name, supervisor_title, confirmation_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(node.id, node.parentId, node.name, node.type, node.positionId, node.sortOrder, node.duties, node.purpose, node.supervisorName ?? "", node.supervisorTitle ?? "", node.organizationStatus),
  ];
  if (position) {
    statements.push(db.prepare(`INSERT INTO positions
      (id, job_description_id, name, site, department, unit, grade, reports_to, status, version, effective_date, confidentiality, headcount,
       confirmation_status, confirmed_by, confirmed_at, confirmation_note, document_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(position.id, position.jobDescriptionId, position.name, position.site, position.department, position.unit, position.grade,
        position.reportsTo, position.status, position.version, position.effectiveDate, position.confidentiality,
        position.headcount, position.confirmationStatus, position.confirmedBy, position.confirmedAt,
        position.confirmationNote, JSON.stringify(position.document)));
  }
  statements.push(db.prepare(
    "INSERT INTO change_logs (entity_type, entity_id, action, detail) VALUES ('org_node', ?, 'create', ?)",
  ).bind(node.id, node.name));
  await db.batch(statements);
}

export async function deleteOrgNode(nodeId: string) {
  await ensureDatabase();
  const db = getBinding();
  if (nodeId === "node-factory-manager") throw new Error("根節點不可刪除。");
  const child = await db.prepare("SELECT id FROM org_nodes WHERE parent_id = ? LIMIT 1").bind(nodeId).first();
  if (child) throw new Error("此節點仍有下層，請先移動或刪除下層內容。");
  const node = await db.prepare("SELECT position_id FROM org_nodes WHERE id = ?").bind(nodeId).first<{ position_id: string | null }>();
  const statements: D1PreparedStatement[] = [db.prepare("DELETE FROM org_nodes WHERE id = ?").bind(nodeId)];
  if (node?.position_id) {
    statements.push(db.prepare("DELETE FROM position_assignments WHERE position_id = ?").bind(node.position_id));
    statements.push(db.prepare("DELETE FROM position_people WHERE position_id = ?").bind(node.position_id));
    statements.push(db.prepare("DELETE FROM talent_assessments WHERE target_position_id = ?").bind(node.position_id));
    statements.push(db.prepare("DELETE FROM positions WHERE id = ?").bind(node.position_id));
  }
  statements.push(db.prepare("INSERT INTO change_logs (entity_type, entity_id, action, detail) VALUES ('org_node', ?, 'delete', '')").bind(nodeId));
  await db.batch(statements);
}

export async function saveOrgNodeDetails(nodeId: string, name: string, duties: string, purpose: string, supervisorName: string, supervisorTitle: string, organizationStatus: "待確認" | "已確認") {
  await ensureDatabase();
  const db = getBinding();
  await db.batch([
    db.prepare("UPDATE org_nodes SET name = ?, duties = ?, purpose = ?, supervisor_name = ?, supervisor_title = ?, confirmation_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND type = 'unit'")
      .bind(name.trim(), duties, purpose, supervisorName.trim(), supervisorTitle.trim(), organizationStatus, nodeId),
    db.prepare("INSERT INTO change_logs (entity_type, entity_id, action, detail) VALUES ('org_node', ?, 'update', ?)")
      .bind(nodeId, `更新單位名稱、部門目的、部門執掌與組織確認狀態：${organizationStatus}`),
  ]);
}
