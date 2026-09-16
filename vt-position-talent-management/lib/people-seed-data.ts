import type { AssessmentSection, PositionRelationshipType } from "./types";

/**
 * 舊人員與盤點資料已於 2026-09-10 依使用者指示清空。
 * 新資料只能在使用者指定新的來源路徑後重新匯入。
 */
export const seedPeople: Array<{
  id: string;
  name: string;
  nationality: string;
  gender: string;
  notes: string;
}> = [];

export const seedPositionPeople: Array<{
  id: string;
  positionId: string;
  personId: string;
  relationshipType: PositionRelationshipType;
  notes: string;
}> = [];

export const seedAssessments: Array<{
  id: string;
  targetPositionId: string;
  personId: string | null;
  status: string;
  version: string;
  updatedAt: string;
  sourceFile: string;
  sections: AssessmentSection[];
}> = [];
