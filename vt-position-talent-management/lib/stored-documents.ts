import type { AssessmentSection, PersonRecord } from "./types";

export type PersonProfile = Pick<PersonRecord, "possessedCompetencies" | "achievements" | "departmentRotations" | "managementExperiences" | "trainingRecords" | "rewardsAndDisciplinary" | "careerTrajectories">;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseJson(json: string, label: string): unknown {
  try { return JSON.parse(json); }
  catch { throw new Error(`${label}格式損壞，請先修復原始資料後再編輯。`); }
}

export function readPersonProfile(json: string): PersonProfile {
  const value = parseJson(json || "{}", "人員履歷");
  if (!isObject(value)) throw new Error("人員履歷必須是物件，請先修復原始資料。");
  const fields: Record<keyof PersonProfile, Record<string, "string" | "number">> = {
    possessedCompetencies: { competencyName: "string", reason: "string", dateRecorded: "string" },
    achievements: { title: "string", description: "string", dateRecorded: "string" },
    departmentRotations: { departmentName: "string", role: "string", dateRecorded: "string" },
    managementExperiences: { title: "string", teamSize: "number", dateRecorded: "string" },
    trainingRecords: { courseName: "string", hours: "number", dateRecorded: "string" },
    rewardsAndDisciplinary: { type: "string", title: "string", dateRecorded: "string" },
    careerTrajectories: { eventName: "string", dateRecorded: "string" },
  };
  for (const [key, shape] of Object.entries(fields)) {
    const items = value[key];
    if (items === undefined) continue;
    if (!Array.isArray(items) || !items.every((item: unknown) => isObject(item)
      && Object.entries(shape).every(([field, type]) => typeof item[field] === type)
      && (key !== "rewardsAndDisciplinary" || item.type === "獎勵" || item.type === "懲戒"))) {
      throw new Error(`人員履歷 ${key} 格式不正確，請先修復原始資料。`);
    }
  }
  return value as PersonProfile;
}

export function readAssessmentDocument(json: string, updatedAt: string): { finalizedDate: string; sections: AssessmentSection[] } {
  const value = parseJson(json, "人員盤點");
  const sections = Array.isArray(value) ? value : isObject(value) ? value.sections : undefined;
  if (!Array.isArray(sections) || !sections.every((section: unknown) => isObject(section)
    && typeof section.title === "string"
    && Array.isArray(section.columns) && section.columns.every((column: unknown) => typeof column === "string")
    && Array.isArray(section.rows) && section.rows.every((row: unknown) => isObject(row)
      && typeof row.label === "string" && Array.isArray(row.values) && row.values.every((cell: unknown) => typeof cell === "string"))
    && (section.note === undefined || typeof section.note === "string"))) {
    throw new Error("人員盤點章節格式不正確，請先修復原始資料。");
  }
  return {
    finalizedDate: isObject(value) && typeof value.finalizedDate === "string" ? value.finalizedDate : updatedAt,
    sections: (sections as AssessmentSection[]).filter((section) => section.title !== "優先待驗證項目與發展行動初稿"),
  };
}
