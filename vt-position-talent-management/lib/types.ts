export type AnnotationType = "待確認" | "待訪談" | "建議新增" | "權責調整" | "主管定義參考" | "訪談修訂";
export type ConfirmationStatus = "待確認" | "在職人員確認" | "主管確認";
export type OrgConfirmationStatus = "待確認" | "已確認";

export interface Responsibility {
  code: string;
  text: string;
  annotation?: AnnotationType;
}

export interface Annotation {
  type: AnnotationType;
  content: string;
}

export interface JobDocument {
  interviewee?: string;
  coreResults?: { result: string; measurement: string }[];
  sourceMarkdown?: string;
  summary: string;
  managementUnit: string;
  purpose: string;
  responsibilities: Responsibility[];
  authority: string;
  performance: string[];
  competencies: string[];
  requirements: string[];
  languages: {
    mandarin: string;
    vietnamese: string;
    english: string;
  };
  successors: string[];
  interviewQuestions: string[];
  sources: string[];
  annotations: Annotation[];
}

export interface Incumbent {
  id: string;
  name: string;
  employeeNo: string;
  startDate: string;
  notes: string;
}

export type PositionRelationshipType = "現任者" | "潛在接班人";

export interface PositionLink {
  id: string;
  positionId: string;
  positionName: string;
  relationshipType: PositionRelationshipType;
  notes: string;
}

export interface AssessmentRow {
  label: string;
  values: string[];
}

export interface AssessmentSection {
  title: string;
  columns: string[];
  rows: AssessmentRow[];
  note?: string;
}

export interface PossessedCompetencyItem {
  competencyName: string;
  reason: string;
  dateRecorded: string;
}

export interface AchievementItem {
  title: string;
  description: string;
  dateRecorded: string;
}

export interface DepartmentRotationItem {
  departmentName: string;
  role: string;
  dateRecorded: string;
}

export interface ManagementExpItem {
  title: string;
  teamSize: number;
  dateRecorded: string;
}

export interface TrainingRecordItem {
  courseName: string;
  hours: number;
  dateRecorded: string;
}

export interface RewardDisciplineItem {
  type: "獎勵" | "懲戒";
  title: string;
  dateRecorded: string;
}

export interface CareerTrajectoryItem {
  eventName: string;
  dateRecorded: string;
}

export interface TalentAssessment {
  id: string;
  targetPositionId: string;
  targetPositionName: string;
  personId: string | null;
  personName: string;
  status: string;
  version: string;
  updatedAt: string;
  finalizedDate?: string;
  sourceFile: string;
  sections: AssessmentSection[];
}

export interface PersonRecord {
  id: string;
  name: string;
  employeeNo: string;
  nationality: string;
  gender: string;
  notes: string;
  confirmationStatus: ConfirmationStatus;
  confirmedBy: string;
  confirmedAt: string;
  confirmationNote: string;
  positions: PositionLink[];
  possessedCompetencies?: PossessedCompetencyItem[];
  achievements?: AchievementItem[];
  departmentRotations?: DepartmentRotationItem[];
  managementExperiences?: ManagementExpItem[];
  trainingRecords?: TrainingRecordItem[];
  rewardsAndDisciplinary?: RewardDisciplineItem[];
  careerTrajectories?: CareerTrajectoryItem[];
}

export interface PositionRecord {
  reviewer?: string;
  id: string;
  jobDescriptionId: string | null;
  jobDescriptionUsageCount?: number;
  name: string;
  site: string;
  department: string;
  unit: string;
  grade: string;
  reportsTo: string;
  status: string;
  version: string;
  effectiveDate: string;
  updatedAt: string;
  confidentiality: string;
  headcount: number;
  confirmationStatus: ConfirmationStatus;
  confirmedBy: string;
  confirmedAt: string;
  confirmationNote: string;
  document: JobDocument;
  incumbents: Incumbent[];
  successors?: Incumbent[];
}

export interface JobDescriptionRecord {
  reviewer?: string;
  revisionId?: string;
  revisionNumber?: number;
  revisionToken?: string;
  versions?: JobDescriptionVersion[];
  currentEffectiveVersion?: string;
  currentEffectiveRevisionId?: string;
  id: string;
  code: string;
  title: string;
  site: string;
  department: string;
  grade: string;
  reportsTo: string;
  status: string;
  version: string;
  effectiveDate: string;
  updatedAt: string;
  confidentiality: string;
  confirmationStatus: ConfirmationStatus;
  confirmedBy: string;
  confirmedAt: string;
  confirmationNote: string;
  document: JobDocument;
  usageCount: number;
}

export interface JobDescriptionVersion {
  id: string;
  revision: number;
  version: string;
  status: string;
  effectiveDate: string;
  expiredDate: string;
  updatedAt: string;
  record: JobDescriptionRecord;
}

export interface OrgNode {
  id: string;
  parentId: string | null;
  name: string;
  type: "unit" | "position";
  positionId: string | null;
  sortOrder: number;
  duties: string;
  purpose: string;
  supervisorName?: string;
  supervisorTitle?: string;
  organizationStatus: OrgConfirmationStatus;
}

export type CompetencyCategory = "管理職能" | "專業職能" | "語言能力";

export interface CompetencyRecord {
  id: string;
  name: string;
  category: CompetencyCategory;
  description: string;
  sortOrder: number;
  updatedAt: string;
}

export interface AppData {
  positions: PositionRecord[];
  jobDescriptions: JobDescriptionRecord[];
  orgNodes: OrgNode[];
  people: PersonRecord[];
  assessments: TalentAssessment[];
  competencies: CompetencyRecord[];
}
