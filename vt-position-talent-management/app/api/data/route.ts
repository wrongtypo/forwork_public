import { addOrgNode, deleteCompetency, deleteOrgNode, linkPositionJobDescription, moveOrgNode, readAppData, saveCompetency, saveJobDescription, saveOrgNodeDetails, savePerson, savePosition } from "../../../db/repository";
import type { CompetencyRecord, JobDescriptionRecord, OrgNode, PersonRecord, PositionRecord } from "../../../lib/types";
import { createJobDescriptionVersion, activateJobDescriptionVersion } from "../../../db/repository";

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "資料處理失敗。";
  return Response.json({ error: message }, { status: 500 });
}

export async function GET() {
  try {
    return Response.json(await readAppData());
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      action: "savePosition" | "savePerson" | "moveNode" | "addNode" | "deleteNode" | "saveUnit" | "saveCompetency" | "deleteCompetency" | "saveJobDescription" | "linkPositionJobDescription" | "createJobDescriptionVersion" | "activateJobDescriptionVersion";
      version?: string;
      revisionId?: string;
      revisionToken?: string;
      effectiveDate?: string;
      position?: PositionRecord;
      jobDescription?: JobDescriptionRecord;
      jobDescriptionId?: string | null;
      positionId?: string;
      person?: PersonRecord;
      node?: OrgNode;
      competency?: CompetencyRecord;
      competencyId?: string;
      nodeId?: string;
      parentId?: string | null;
      name?: string;
      duties?: string;
      purpose?: string;
      supervisorName?: string;
      supervisorTitle?: string;
      organizationStatus?: "待確認" | "已確認";
    };
    if (body.action === "savePosition" && body.position) await savePosition(body.position);
    else if (body.action === "savePerson" && body.person) await savePerson(body.person);
    else if (body.action === "moveNode" && body.nodeId) await moveOrgNode(body.nodeId, body.parentId ?? null);
    else if (body.action === "addNode" && body.node) await addOrgNode(body.node, body.position);
    else if (body.action === "deleteNode" && body.nodeId) await deleteOrgNode(body.nodeId);
    else if (body.action === "saveUnit" && body.nodeId && body.name) await saveOrgNodeDetails(body.nodeId, body.name, body.duties ?? "", body.purpose ?? "", body.supervisorName ?? "", body.supervisorTitle ?? "", body.organizationStatus ?? "待確認");
    else if (body.action === "saveCompetency" && body.competency) await saveCompetency(body.competency);
    else if (body.action === "deleteCompetency" && body.competencyId) await deleteCompetency(body.competencyId);
    else if (body.action === "saveJobDescription" && body.jobDescription) await saveJobDescription(body.jobDescription);
    else if (body.action === "createJobDescriptionVersion" && body.jobDescriptionId && body.version && body.revisionId) await createJobDescriptionVersion(body.jobDescriptionId, body.version, body.revisionId);
    else if (body.action === "activateJobDescriptionVersion" && body.jobDescriptionId && body.revisionId && body.revisionToken && body.effectiveDate) await activateJobDescriptionVersion(body.jobDescriptionId, body.revisionId, body.revisionToken, body.effectiveDate);
    else if (body.action === "linkPositionJobDescription" && body.positionId) await linkPositionJobDescription(body.positionId, body.jobDescriptionId ?? null);
    else return Response.json({ error: "不支援的操作。" }, { status: 400 });
    return Response.json(await readAppData());
  } catch (error) {
    return errorResponse(error);
  }
}
