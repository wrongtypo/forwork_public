import type { CSSProperties } from "react";
import type { CompetencyRecord, JobDescriptionRecord, PositionRecord } from "../lib/types";
import { displayEffectiveDate, jobDescriptionStatusTone } from "../lib/job-description-summary";

export function DocumentHeader({ record }: { record: JobDescriptionRecord }) {
  return <><header className="document-header"><div><p className="eyebrow">VT POSITION PROFILE</p><h1>{record.title}</h1></div></header>
    <div className="print-meta document-version-meta"><span>版本：v{record.version}</span><span>狀態：<b className={`jd-status jd-status-${jobDescriptionStatusTone(record.status)}`}>{record.status}</b></span><span>生效日：{displayEffectiveDate(record.status, record.effectiveDate)}</span><span>審核者：{record.reviewer || "待確認"}</span></div></>;
}
function Head({ title, index }: { title: string; index: string }) {
  return <div className="detail-section-head"><div><span>{index}</span><h2>{title}</h2></div></div>;
}
function Info({ label, value, className }: { label: string; value: string; className?: string }) {
  return <div className={className}><span>{label}</span><strong>{value || "待確認"}</strong></div>;
}
function List({ items }: { items: string[] }) {
  return <ul className="bullet-list">{items.map((item, index) => <li key={index}>{item}</li>)}</ul>;
}
export function CompetencyTags({ items, competencies }: { items: string[]; competencies: CompetencyRecord[] }) {
  return <div className="tag-list">{items.map((item, index) => {
    const competency = competencies.find((entry) => entry.id === item || entry.name === item);
    const prefix = (competency?.id ?? item).trim().match(/^([MPL])\d+/i)?.[1].toUpperCase();
    const category = prefix === "M" ? "管理職能" : prefix === "P" ? "專業職能" : prefix === "L" ? "語言能力" : "未分類";
    return <span key={index} className={`competency-tag competency-tag-${prefix ?? "unknown"}`} title={category}>{competency ? `${competency.id} ${competency.name}` : item}</span>;
  })}</div>;
}
function Authority({ value }: { value: string }) {
  const match = value.match(/可自行決定[：:]\s*([\s\S]*?)需協商[／/]會簽[：:]\s*([\s\S]*?)需向上核定[：:]\s*([\s\S]*)/u);
  if (!match) return <p className="lead-text">{value}</p>;
  return <div className="authority-table">{["可自行決定", "需協商／會簽", "需向上核定"].map((label, index) => <div className="authority-row" key={label}><strong>{label}</strong><p>{match[index + 1].trim()}</p></div>)}</div>;
}

export function PositionDocumentSections({ record, position, competencies }: {
  record: JobDescriptionRecord; position?: PositionRecord; competencies: CompetencyRecord[];
}) {
  const doc = record.document;
  const printStyle = { "--print-responsibility-rows": Math.max(1, Math.ceil(doc.responsibilities.length / 2)) } as CSSProperties;
  return <>
    <section className="detail-section" id="section-basic"><Head title="職位基本資料" index="01" /><div className="basic-grid">
      <Info label="廠區" value={position?.site ?? record.site} /><Info label="部門／單位" value={position ? [position.department, position.unit].filter(Boolean).join("／") : record.department} />
      <Info label="職等" value={record.grade} /><Info label="直接主管" value={record.reportsTo} />
      {doc.interviewee && <Info label="受訪人" value={doc.interviewee} />}
      {position && <Info label="編制／現職" value={position.headcount > 0 ? `${position.headcount}／${position.incumbents.length} 人` : "待確認"} />}
      <Info label="工作說明書代碼" value={record.code || "未關聯"} /><Info className="management-unit" label="管理單位" value={doc.managementUnit} />
    </div></section>
    <section className="detail-section" id="section-purpose"><Head title="職位目的" index="02" /><p className="lead-text">{doc.purpose}</p></section>
    <section className="detail-section" id="section-responsibilities"><Head title="主要職責" index="03" /><div className="responsibility-list" style={printStyle}>{doc.responsibilities.map((item, index) => <div key={index}><span>{item.code}</span><p>{item.text}{item.annotation && <em className="inline-note">🔴 {item.annotation}</em>}</p></div>)}</div></section>
    <section className="detail-section" id="section-authority"><Head title="決策與權限" index="04" /><Authority value={doc.authority} /></section>
    <section className="detail-section" id="section-performance"><Head title="績效衡量方向" index="05" /><List items={doc.performance} /></section>
    <section className="detail-section" id="section-requirements"><Head title="關鍵能力與任職條件" index="06" /><div className="two-column-content"><div><h3>關鍵能力</h3><CompetencyTags items={doc.competencies} competencies={competencies} /></div><div><h3>任職條件與必要歷練</h3><List items={doc.requirements} /></div></div></section>
    <section className="detail-section" id="section-languages"><Head title="語言要求" index="07" /><div className="language-grid">{([ ["中文／國語", doc.languages.mandarin], ["越文", doc.languages.vietnamese], ["英文", doc.languages.english] ]).map(([label, value]) => <div key={label}><span>{label}</span><p>{value || "待確認"}</p></div>)}</div></section>
  </>;
}
