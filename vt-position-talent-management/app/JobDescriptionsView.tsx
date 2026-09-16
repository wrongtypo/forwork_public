"use client";

import { useState } from "react";
import type { AppData, JobDescriptionRecord, ConfirmationStatus } from "../lib/types";
import { displayEffectiveDate, jobDescriptionRelations, jobDescriptionStatusTone } from "../lib/job-description-summary";

import { DocumentHeader, PositionDocumentSections } from "./PositionDocument";

type Props = {
  onPrint: () => void;
  initialId?: string | null;
  data: AppData; busy: boolean; makeBlank: () => JobDescriptionRecord; normalizeSearch: (value: string) => string;
  postAction: (body: object, msg: string) => Promise<AppData | null>;
  onOpenPosition: (id: string) => void; onOpenPerson: (id: string) => void;
};
const editableStatuses = ["訪談前初稿", "待確認", "主管確認中", "待修正", "訪談後修訂", "已確認"];
function Status({ value }: { value: string }) {
  return <span className={`jd-status jd-status-${jobDescriptionStatusTone(value)}`}>{value}</span>;
}
export default function JobDescriptionsView({ data, busy, makeBlank, normalizeSearch, postAction, onOpenPosition, onOpenPerson, initialId, onPrint }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(initialId ?? null);
  const [revisionId, setRevisionId] = useState<string | null>(null);
  const [draft, setDraft] = useState<JobDescriptionRecord | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState("code");
  const [history, setHistory] = useState(false);
  const [relations, setRelations] = useState<{ id: string; kind: "positions" | "incumbents" | "successors" } | null>(null);
  const [operation, setOperation] = useState<"create" | "activate" | null>(null);
  const [versionLabel, setVersionLabel] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const master = data.jobDescriptions.find((item) => item.id === selectedId);
  const selectedVersion = master?.versions?.find((item) => item.id === revisionId) ?? master?.versions?.[0];
  const shown = selectedVersion?.record ?? master;
  const isLatest = !selectedVersion || selectedVersion.id === master?.revisionId;
  const editable = isLatest && shown?.status !== "正式生效" && shown?.status !== "已失效";
  const term = normalizeSearch(search);
  const rows = data.jobDescriptions.filter((item) => (!term || normalizeSearch(`${item.code} ${item.title} ${item.department}`).includes(term)) && (!filter || item.status === filter))
    .sort((a, b) => {
      if (sort === "date-desc" || sort === "date-asc") {
        const date = (j: JobDescriptionRecord) => /^\d{4}-\d{2}-\d{2}$/.test(j.effectiveDate) ? j.effectiveDate : "";
        const left = date(a), right = date(b);
        if (!left || !right) return left ? -1 : right ? 1 : a.code.localeCompare(b.code);
        return (sort === "date-desc" ? right.localeCompare(left) : left.localeCompare(right)) || a.code.localeCompare(b.code);
      }
      return a.code.localeCompare(b.code, "en", { numeric: true });
    });
  function open(id: string) { setSelectedId(id); setRevisionId(null); setHistory(false); setOperation(null); setRelations(null); }
  function update(updater: (next: JobDescriptionRecord) => void) {
    setDraft((current) => { if (!current) return current; const next = structuredClone(current); updater(next); return next; });
  }
  async function save() {
    if (!draft) return;
    const payload = await postAction({ action: "saveJobDescription", jobDescription: draft }, "工作說明書版本已儲存");
    if (payload) { open(draft.id); setDraft(null); }
  }
  async function runOperation() {
    if (!master || !shown) return;
    const payload = await postAction(operation === "create"
      ? { action: "createJobDescriptionVersion", jobDescriptionId: master.id, revisionId: master.revisionId, version: versionLabel }
      : { action: "activateJobDescriptionVersion", jobDescriptionId: master.id, revisionId: shown.revisionId, revisionToken: shown.revisionToken, effectiveDate },
    operation === "create" ? "新版草稿已建立，原有效版仍繼續適用" : "新版已正式生效，舊版已保留於歷史版本");
    if (payload) { setOperation(null); setRevisionId(null); }
  }

  if (draft) return <div className="page-stack jd-page">
    <div className="detail-actions"><button className="back-button" disabled={busy} onClick={() => setDraft(null)}>← 取消編輯</button><button className="button primary" disabled={busy || !draft.code.trim() || !draft.title.trim()} onClick={() => void save()}>{busy ? "儲存中…" : "儲存草稿"}</button></div>
    <section className="toolbar-card"><h2>{draft.revisionId ? `${draft.code} · v${draft.version}` : "新增工作說明書"}</h2><p>草稿儲存後，再操作「正式生效」並填寫生效日期。</p></section>
    <fieldset className="job-description-form" disabled={busy}><legend>版本內容</legend><div className="form-grid">
      {([ ["code", "唯一代碼"], ["title", "職務名稱"], ["site", "適用範圍"], ["department", "部門"], ["grade", "職等"], ["reportsTo", "直接主管"], ["version", "版本號"] ] as const).map(([key, label]) => <label key={key}>{label}<input value={draft[key]} disabled={Boolean(draft.revisionId) && (key === "code" || key === "version")} onChange={(event) => update((next) => { next[key] = event.target.value; })} /></label>)}
      <label>文件狀態<select value={draft.status} onChange={(event) => update((next) => { next.status = event.target.value; })}>{Array.from(new Set([draft.status, ...editableStatuses])).map((status) => <option key={status}>{status}</option>)}</select></label>
      <label>確認階段<select value={draft.confirmationStatus} onChange={(event) => update((next) => { next.confirmationStatus = event.target.value as ConfirmationStatus; })}>{["待確認", "在職人員確認", "主管確認"].map((status) => <option key={status}>{status}</option>)}</select></label>
      <label>審核者<input value={draft.reviewer ?? ""} onChange={(event) => update((next) => { next.reviewer = event.target.value; })} /></label>
      <label>生效日期（預填不代表已生效）<input type="date" value={draft.effectiveDate} onChange={(event) => update((next) => { next.effectiveDate = event.target.value; })} /></label>
      <label>確認人<input value={draft.confirmedBy} onChange={(event) => update((next) => { next.confirmedBy = event.target.value; })} /></label>
      <label>確認日期<input type="date" value={draft.confirmedAt} onChange={(event) => update((next) => { next.confirmedAt = event.target.value; })} /></label>
      <label>機密等級<input value={draft.confidentiality} onChange={(event) => update((next) => { next.confidentiality = event.target.value; })} /></label>
      <label className="wide">確認備註<textarea value={draft.confirmationNote} onChange={(event) => update((next) => { next.confirmationNote = event.target.value; })} /></label>
      {([ ["managementUnit", "管理單位"], ["purpose", "職位目的"], ["authority", "決策與權限"] ] as const).map(([key, label]) => <label key={key} className="wide">{label}<textarea value={draft.document[key]} onChange={(event) => update((next) => { next.document[key] = event.target.value; })} /></label>)}
      <label className="wide">主要職責（每行 R01|內容）<textarea className="tall" value={draft.document.responsibilities.map((item) => `${item.code}|${item.text}`).join("\n")} onChange={(event) => update((next) => {
        next.document.responsibilities = event.target.value.split("\n").map((line, index) => { const [code, ...text] = line.split("|"); return { ...next.document.responsibilities[index], code, text: text.join("|") }; });
      })} /></label>
      {([ ["performance", "績效衡量方向"], ["competencies", "關鍵能力代碼"], ["requirements", "任職條件"] ] as const).map(([key, label]) => <label key={key} className="wide">{label}（每行一項）<textarea value={draft.document[key].join("\n")} onChange={(event) => update((next) => { next.document[key] = event.target.value.split("\n"); })} /></label>)}
      {([ ["mandarin", "中文／國語"], ["vietnamese", "越文"], ["english", "英文"] ] as const).map(([key, label]) => <label key={key}>{label}要求<textarea value={draft.document.languages[key]} onChange={(event) => update((next) => { next.document.languages[key] = event.target.value; })} /></label>)}
    </div></fieldset>
  </div>;

  if (relations) {
    const relationMaster = data.jobDescriptions.find((item) => item.id === relations.id)!;
    const related = jobDescriptionRelations(data, relations.id);
    const title = { positions: "已關聯職位", incumbents: "現職者", successors: "接班者" }[relations.kind];
    return <div className="page-stack jd-page"><button className="back-button" onClick={() => setRelations(null)}>← 返回工作說明書</button><section className="toolbar-card"><h2>{relationMaster.title} · {title}</h2><p>{relations.kind === "positions" ? "同一份文件的組織職位配置。" : "依人員主檔去重計算；顯示目前關聯，不代表歷史版本當時的人員。"}</p>{relations.kind === "successors" && <p>接班者人數不代表已具備接任準備度；盤點與發展需求請查看個人資料。</p>}</section>
      <div className="jd-table-scroll"><table className="jd-table"><thead><tr>{(relations.kind === "positions" ? ["單位", "職位", "編制", "查看"] : ["工號", "姓名", "關聯職位", "查看"]).map((label) => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>
        {relations.kind === "positions" ? related.positions.map((position) => <tr key={position.id}><td>{position.unit || position.department}</td><td>{position.name}</td><td>{position.headcount}</td><td><button className="jd-link" onClick={() => onOpenPosition(position.id)}>查看職位</button></td></tr>) : related[relations.kind].map((person) => <tr key={person.id}><td>{person.employeeNo || "待確認"}</td><td>{person.name}</td><td>{person.linkedPositions.map((position) => `${position.unit}／${position.name}`).join("、")}</td><td><button className="jd-link" onClick={() => onOpenPerson(person.id)}>查看人員盤點</button></td></tr>)}
        {!related[relations.kind].length && <tr><td colSpan={4} className="jd-empty">尚未建立{title}關聯。</td></tr>}
      </tbody></table></div></div>;
  }

  if (master && shown) return <div className="page-stack jd-page jd-document-view">
    <div className="detail-actions no-print"><button className="back-button" onClick={() => { setSelectedId(null); setOperation(null); }}>← 返回工作說明書</button><div><button className="button secondary" onClick={onPrint}>列印／另存 PDF</button><button className="button secondary" aria-expanded={history} onClick={() => setHistory(!history)}>歷史版本（{master.versions?.length ?? 1}）</button>{editable ? <><button className="button secondary" disabled={busy} onClick={() => setDraft(structuredClone(shown))}>編輯草稿</button><button className="button primary" disabled={busy} onClick={() => { setOperation("activate"); setEffectiveDate(shown.effectiveDate); }}>正式生效</button></> : isLatest && <button className="button primary" disabled={busy} onClick={() => { setOperation("create"); const parts = shown.version.split("."); setVersionLabel(`${parts[0]}.${Number(parts[1] ?? 0) + 1}`); }}>＋ 新增版本</button>}</div></div>
    <div className="jd-context no-print"><div className="jd-counts">{([ ["positions", "職位"], ["incumbents", "現職者"], ["successors", "接班者"] ] as const).map(([kind, label]) => <button className="jd-link" key={kind} onClick={() => setRelations({ id: master.id, kind })}>{label} {jobDescriptionRelations(data, master.id)[kind].length}</button>)}</div></div>
    {shown.status !== "正式生效" && <div className="jd-notice no-print">{shown.status === "已失效" ? "此為歷史版本，僅供查閱。" : "此版本尚未生效。"}{master.currentEffectiveVersion ? <>目前有效：<button className="jd-link" onClick={() => { setRevisionId(master.currentEffectiveRevisionId ?? null); setOperation(null); }}>v{master.currentEffectiveVersion}</button></> : "目前尚無正式生效版本。"}{!isLatest && <button className="jd-link" onClick={() => { setRevisionId(null); setOperation(null); }}>查看最新版 v{master.version}</button>}</div>}
    {!isLatest && shown.status === "正式生效" && <div className="jd-notice no-print">此為目前有效版；另有新版待生效。<button className="jd-link" onClick={() => setRevisionId(null)}>查看最新版 v{master.version}</button></div>}
    {operation && <form className="jd-operation no-print" onSubmit={(event) => { event.preventDefault(); void runOperation(); }}><h3>{operation === "create" ? "建立新版草稿" : "確認正式生效"}</h3><p>{operation === "create" ? "複製最新版內容供修訂；原有效版仍繼續適用。" : "生效後將鎖定此版內容，並讓原有效版失效。後續修改須新增版本。"}</p><label>{operation === "create" ? "新版本號" : "生效日期（不可晚於今天）"}<input required type={operation === "create" ? "text" : "date"} value={operation === "create" ? versionLabel : effectiveDate} onChange={(event) => operation === "create" ? setVersionLabel(event.target.value) : setEffectiveDate(event.target.value)} /></label><div><button type="button" className="button secondary" disabled={busy} onClick={() => setOperation(null)}>取消</button><button className="button primary" disabled={busy} type="submit">{busy ? "處理中…" : operation === "create" ? "建立草稿" : "確認生效"}</button></div></form>}
    {history && <section className="jd-history no-print"><h3>版本歷程</h3><p className="jd-muted">系統從啟用版本管理時開始留存，未臆建過去未保存的版本。</p><div className="jd-table-scroll"><table className="jd-table"><thead><tr>{["版本", "狀態", "生效日", "失效日", "查看"].map((label) => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{master.versions?.map((version) => <tr key={version.id} aria-selected={version.id === selectedVersion?.id}><td>v{version.version}{version.id === master.revisionId && <small>最新版</small>}</td><td><Status value={version.status} /></td><td>{displayEffectiveDate(version.status, version.effectiveDate)}</td><td>{version.expiredDate || "—"}</td><td><button className="jd-link" onClick={() => { setRevisionId(version.id); setOperation(null); }}>查看內容</button></td></tr>)}</tbody></table></div></section>}
    <article className="position-detail print-document"><DocumentHeader record={shown} /><PositionDocumentSections record={shown} competencies={data.competencies} /><footer className="document-footer">{master.code} · v{shown.version} · 審核者：{shown.reviewer || "待確認"}</footer></article>
  </div>;

  return <div className="page-stack jd-page">
    <section className="toolbar-card job-description-toolbar"><div><p className="eyebrow">JOB DESCRIPTIONS</p><h2>工作說明書</h2><p>每份工作說明書一列，查看關聯職位、人員及最新版本。</p></div><button className="button primary" disabled={busy} onClick={() => setDraft(makeBlank())}>＋ 新增工作說明書</button></section>
    <section className="filter-bar jd-filters"><label>搜尋<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="代碼、職務名稱或部門" /></label><label>狀態<select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="">全部狀態</option>{Array.from(new Set(data.jobDescriptions.map((item) => item.status))).map((status) => <option key={status}>{status}</option>)}</select></label><label>排序<select value={sort} onChange={(event) => setSort(event.target.value)}><option value="code">代碼排序</option><option value="date-desc">生效日：新到舊</option><option value="date-asc">生效日：舊到新</option></select></label><span className="result-count">{rows.length} 份工作說明書</span></section>
    <div className="jd-table-scroll"><table className="jd-table jd-overview" aria-label="工作說明書總覽">
      <thead><tr>{["代碼", "職務名稱", "已關聯", "現職者", "接班者", "最新版本", "狀態", "生效日"].map((label) => <th key={label} scope="col">{label}</th>)}</tr></thead>
      <tbody>{rows.map((item) => {
        const related = jobDescriptionRelations(data, item.id);
        return <tr key={item.id}>
          <td><button className="jd-link" onClick={() => open(item.id)}>{item.code}</button></td>
          <th scope="row"><button className="jd-link" onClick={() => open(item.id)}>{item.title}</button></th>
          {([ ["positions", "職位"], ["incumbents", "人"], ["successors", "人"] ] as const).map(([kind, unit]) => <td key={kind}><button className="jd-link" aria-label={`${item.title}：${{ positions: "已關聯", incumbents: "現職者", successors: "接班者" }[kind]} ${related[kind].length} ${unit}`} onClick={() => setRelations({ id: item.id, kind })}>{related[kind].length} {unit}</button></td>)}
          <td><button className="jd-link" onClick={() => open(item.id)}>v{item.version}</button><small><button className="jd-link" onClick={() => { open(item.id); setHistory(true); }}>歷史版本</button></small></td>
          <td><Status value={item.status} />{item.status !== "正式生效" && item.currentEffectiveVersion && <small>目前有效：v{item.currentEffectiveVersion}</small>}</td>
          <td>{displayEffectiveDate(item.status, item.effectiveDate)}</td>
        </tr>;
      })}{!rows.length && <tr><td colSpan={8} className="jd-empty">沒有符合條件的工作說明書。</td></tr>}</tbody>
    </table></div>
    <p className="jd-muted">現職者與接班者按同一份工作說明書的關聯人員去重計算；接班人數不代表接任準備度。</p>
  </div>;
}
