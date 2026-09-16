import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const orgNodes = sqliteTable("org_nodes", {
  id: text("id").primaryKey(),
  parentId: text("parent_id"),
  name: text("name").notNull(),
  type: text("type").notNull(),
  positionId: text("position_id"),
  sortOrder: integer("sort_order").notNull().default(0),
  duties: text("duties").notNull().default(""),
  supervisorName: text("supervisor_name").notNull().default(""),
  supervisorTitle: text("supervisor_title").notNull().default(""),
  confirmationStatus: text("confirmation_status").notNull().default("已確認"),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const positions = sqliteTable("positions", {
  id: text("id").primaryKey(),
  jobDescriptionId: text("job_description_id"),
  name: text("name").notNull(),
  site: text("site").notNull().default("VT"),
  department: text("department").notNull().default(""),
  unit: text("unit").notNull().default(""),
  grade: text("grade").notNull().default(""),
  reportsTo: text("reports_to").notNull().default("待確認"),
  status: text("status").notNull().default("待建立"),
  version: text("version").notNull().default("0.1"),
  effectiveDate: text("effective_date").notNull().default(""),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  confidentiality: text("confidentiality").notNull().default("人事機密"),
  headcount: integer("headcount").notNull().default(1),
  confirmationStatus: text("confirmation_status").notNull().default("待確認"),
  confirmedBy: text("confirmed_by").notNull().default(""),
  confirmedAt: text("confirmed_at").notNull().default(""),
  confirmationNote: text("confirmation_note").notNull().default(""),
  documentJson: text("document_json").notNull().default("{}"),
});

export const jobDescriptions = sqliteTable("job_descriptions", {
  id: text("id").primaryKey(),
  code: text("code").notNull(),
  title: text("title").notNull(),
  site: text("site").notNull().default("VT"),
  department: text("department").notNull().default(""),
  grade: text("grade").notNull().default(""),
  reportsTo: text("reports_to").notNull().default("待確認"),
  status: text("status").notNull().default("訪談前初稿"),
  version: text("version").notNull().default("0.1"),
  effectiveDate: text("effective_date").notNull().default(""),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  confidentiality: text("confidentiality").notNull().default("人事機密"),
  confirmationStatus: text("confirmation_status").notNull().default("待確認"),
  confirmedBy: text("confirmed_by").notNull().default(""),
  confirmedAt: text("confirmed_at").notNull().default(""),
  confirmationNote: text("confirmation_note").notNull().default(""),
  documentJson: text("document_json").notNull().default("{}"),
}, (table) => [
  uniqueIndex("idx_job_descriptions_code").on(table.code),
]);

export const jobDescriptionVersions = sqliteTable("job_description_versions", {
  id: text("id").primaryKey(),
  masterId: text("master_id").notNull(),
  revision: integer("revision").notNull(),
  version: text("version").notNull(),
  status: text("status").notNull(),
  effectiveDate: text("effective_date").notNull().default(""),
  expiredDate: text("expired_date").notNull().default(""),
  recordJson: text("record_json").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("idx_jd_versions_revision").on(table.masterId, table.revision),
  uniqueIndex("idx_jd_versions_label").on(table.masterId, table.version),
  uniqueIndex("idx_jd_versions_effective").on(table.masterId).where(sql`${table.status} = '正式生效'`),
]);

export const people = sqliteTable("people", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  employeeNo: text("employee_no").notNull().default(""),
  nationality: text("nationality").notNull().default("越籍"),
  gender: text("gender").notNull().default("女"),
  notes: text("notes").notNull().default(""),
  profileJson: text("profile_json").notNull().default("{}"),
}, (table) => [
  uniqueIndex("idx_people_employee_no").on(table.employeeNo).where(sql`${table.employeeNo} <> ''`),
]);

export const positionAssignments = sqliteTable("position_assignments", {
  id: text("id").primaryKey(),
  positionId: text("position_id").notNull(),
  personId: text("person_id").notNull(),
  startDate: text("start_date").notNull().default(""),
  notes: text("notes").notNull().default(""),
}, (table) => [
  uniqueIndex("idx_position_assignments_position_person").on(table.positionId, table.personId),
]);

export const sectionConfirmations = sqliteTable("section_confirmations", {
  id: text("id").primaryKey(),
  positionId: text("position_id").notNull(),
  sectionKey: text("section_key").notNull(),
  status: text("status").notNull().default("待確認"),
  confirmedBy: text("confirmed_by").notNull().default(""),
  confirmedAt: text("confirmed_at").notNull().default(""),
  note: text("note").notNull().default(""),
}, (table) => [
  uniqueIndex("idx_section_confirmations_position_section").on(table.positionId, table.sectionKey),
]);

export const changeLogs = sqliteTable("change_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  action: text("action").notNull(),
  detail: text("detail").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const competencies = sqliteTable("competencies", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull().default("專業職能"),
  description: text("description").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
