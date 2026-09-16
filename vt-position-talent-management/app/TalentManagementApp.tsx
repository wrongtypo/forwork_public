"use client";

import { Component, type CSSProperties, type ErrorInfo, type ReactNode, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { loadChineseConverters, toSimplifiedChinese, toTraditionalChinese } from "../lib/chinese-conversion";
import { observeSimplifiedChinese } from "../lib/chinese-dom";
import JobDescriptionsView from "./JobDescriptionsView";
import { CompetencyTags, DocumentHeader, PositionDocumentSections } from "./PositionDocument";
import {
  type AppData,
  type CompetencyCategory,
  type CompetencyRecord,
  type ConfirmationStatus,
  type JobDocument,
  type JobDescriptionRecord,
  type OrgNode,
  type PersonRecord,
  type PositionRecord,
  type TalentAssessment,
} from "../lib/types";

type View = "dashboard" | "org" | "job-descriptions" | "detail" | "unit" | "people" | "person" | "assessment" | "competencies";
type DisplayLocale = "zh-Hant" | "zh-Hans";

function readDisplayLocale(): DisplayLocale {
  return window.localStorage.getItem("vt-display-locale") === "zh-Hans" ? "zh-Hans" : "zh-Hant";
}
function subscribeDisplayLocale(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener("vt-locale-change", listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener("vt-locale-change", listener);
  };
}
function setDisplayLocale(locale: DisplayLocale) {
  window.localStorage.setItem("vt-display-locale", locale);
  window.dispatchEvent(new Event("vt-locale-change"));
}

function searchable(value: string) {
  return toTraditionalChinese(value).trim().toLowerCase();
}

function normalizeToTraditional<T>(value: T): T {
  if (typeof value === "string") return toTraditionalChinese(value) as T;
  if (Array.isArray(value)) return value.map((item) => normalizeToTraditional(item)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeToTraditional(item)])) as T;
  }
  return value;
}

const confirmationOptions: ConfirmationStatus[] = ["待確認", "在職人員確認", "主管確認"];
const positionStatusOptions = ["待建立", "訪談前初稿", "主管確認中", "待修正", "已確認", "正式生效"];
function hasConfirmedImportedDocument(position: PositionRecord) {
  return Boolean(position.jobDescriptionId);
}

const blankDocument = (): JobDocument => ({
  summary: "新建職位，內容待主管確認。",
  managementUnit: "待確認",
  purpose: "🔴 待確認｜請主管確認本職位目的。",
  responsibilities: [{ code: "R01", text: "🔴 待確認｜請主管確認主要職責。", annotation: "待確認" }],
  authority: "🔴 待訪談｜請主管確認本職位的決策與權限。",
  performance: ["🔴 待確認｜請主管確認績效衡量方向。"],
  competencies: ["🔴 待確認｜請主管確認關鍵能力。"],
  requirements: ["🔴 待確認｜請主管確認任職條件。"],
  languages: { mandarin: "🔴 待確認｜實際使用情境與程度。", vietnamese: "🔴 待確認｜實際使用情境與程度。", english: "🔴 待確認｜實際使用情境與程度。" },
  successors: [],
  interviewQuestions: ["請主管確認本職位的職位目的、主要成果、責任範圍與任職條件。"],
  sources: [],
  annotations: [{ type: "待確認", content: "新建職位，尚未取得工作說明書或訪談資料。" }],
});

const blankJobDescription = (): JobDescriptionRecord => ({
  id: `jd-${Date.now().toString(36)}`,
  code: "",
  title: "",
  site: "VT",
  department: "",
  grade: "",
  reportsTo: "待確認",
  status: "訪談前初稿",
  version: "0.1",
  effectiveDate: "",
  updatedAt: new Date().toISOString().slice(0, 10),
  confidentiality: "人事機密",
  confirmationStatus: "待確認",
  confirmedBy: "",
  confirmedAt: "",
  confirmationNote: "",
  document: blankDocument(),
  usageCount: 0,
});

function deepCopy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function SectionHead({ title, index }: { sectionKey?: string; title: string; index: string }) {
  return <div className="detail-section-head"><div><span>{index}</span><h2>{title}</h2></div></div>;
}

function Modal({ children, label, onClose, style }: {
  children: ReactNode; label: string; onClose: () => void; style?: CSSProperties;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useLayoutEffect(() => { closeRef.current = onClose; });
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const previousFocus = document.activeElement;
    const controls = () => Array.from(panel.querySelectorAll<HTMLElement>('button, input, select, textarea, a[href], [tabindex]'))
      .filter((element) => element.tabIndex >= 0 && !element.matches(':disabled') && element.getClientRects().length > 0);
    panel.focus();
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") { event.preventDefault(); closeRef.current(); }
      if (event.key !== "Tab") return;
      const items = controls();
      const first = items[0];
      const last = items.at(-1);
      if (!first || !last) { event.preventDefault(); panel?.focus(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel)) {
        event.preventDefault(); first.focus();
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);
  return <div className="modal-backdrop no-print" role="presentation" onMouseDown={(event) => {
    if (event.target === event.currentTarget) onClose();
  }}>
    <div className="modal" role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} ref={panelRef} style={style}>{children}</div>
  </div>;
}

function lines(value: string[]) {
  return value.join("\n");
}

function fromLines(value: string) {
  return value.split("\n").map((item) => item.trim()).filter(Boolean);
}

function statusClass(status: string) {
  if (status === "主管確認" || status === "已確認" || status === "正式生效") return "status confirmed";
  if (status === "在職人員確認") return "status staff-confirmed";
  if (status === "需要修改" || status === "待修正") return "status revise";
}

class AppErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null; errorInfo: ErrorInfo | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("System Runtime Error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "40px 20px", maxWidth: "800px", margin: "40px auto", background: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px", boxShadow: "0 10px 30px rgba(0,0,0,0.1)", fontFamily: "sans-serif" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
            <span style={{ fontSize: "24px" }}>⚠️</span>
            <h2 style={{ margin: 0, color: "#0b2744", fontSize: "20px" }}>系統運作提示 (Runtime Notice)</h2>
          </div>
          <p style={{ color: "#4b5d6b", fontSize: "14px", lineHeight: 1.6, margin: "0 0 16px" }}>
            網頁在執行時捕捉到非預期異常。詳細錯誤訊息如下：
          </p>
          <pre style={{ background: "#fff0f1", border: "1px solid #f2c7cc", padding: "14px", borderRadius: "8px", color: "#b4232f", overflow: "auto", fontSize: "12px", lineHeight: 1.5 }}>
            {this.state.error?.toString()}
            {"\n\nStack Trace:\n"}
            {this.state.error?.stack}
          </pre>
          <div style={{ marginTop: "24px", display: "flex", gap: "12px" }}>
            <button
              style={{ padding: "10px 18px", background: "#0b2744", color: "#fff", border: 0, borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "13px" }}
              onClick={() => { window.localStorage.clear(); window.location.reload(); }}
            >
              清除快取並重試
            </button>
            <button
              style={{ padding: "10px 18px", background: "#fff", color: "#1b4f79", border: "1px solid #cbd5dd", borderRadius: "6px", cursor: "pointer", fontSize: "13px" }}
              onClick={() => window.location.reload()}
            >
              重新載入頁面
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function TalentManagementApp() {
  return (
    <AppErrorBoundary>
      <ChineseReadyApp />
    </AppErrorBoundary>
  );
}

function ChineseReadyApp() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void loadChineseConverters().then(() => { if (active) setReady(true); }).catch(() => {
      if (active) setError("繁簡字典載入失敗，請重新載入頁面。");
    });
    return () => { active = false; };
  }, []);
  if (error) return <div className="loading-screen" role="alert"><p>{error}</p><button className="button secondary" onClick={() => window.location.reload()}>重新載入</button></div>;
  if (!ready) return <div className="loading-screen"><div className="loading-mark">VT</div><p>正在讀取職位資料…</p></div>;
  return <TalentManagementInnerApp />;
}

function TalentManagementInnerApp() {
  const appShellRef = useRef<HTMLDivElement>(null);
  const displayLocale = useSyncExternalStore(subscribeDisplayLocale, readDisplayLocale, () => "zh-Hant" as DisplayLocale);
  const [data, setData] = useState<AppData | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return new URLSearchParams(window.location.search).get("pos");
    }
    return null;
  });
  const [view, setView] = useState<View>(() => {
    if (typeof window !== "undefined") {
      const pos = new URLSearchParams(window.location.search).get("pos");
      if (pos) return "detail";
    }
    return "dashboard";
  });
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [libraryMasterId, setLibraryMasterId] = useState<string | null>(null);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string | null>(null);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [positionEditDraft, setDraft] = useState<PositionRecord | null>(null);
  const [personEditDraft, setPersonDraft] = useState<PersonRecord | null>(null);
  const [editing, setEditing] = useState(false);
  const [orgEditing, setOrgEditing] = useState(false);
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [addParentId, setAddParentId] = useState<string | null>(null);
  const [newNodeType, setNewNodeType] = useState<"unit" | "position">("position");
  const [newNodeName, setNewNodeName] = useState("");
  const [newNodeGrade, setNewNodeGrade] = useState("");
  const [peopleSearch, setPeopleSearch] = useState("");
  const [globalSearchType, setGlobalSearchType] = useState<"position" | "unit">("position");
  const [globalSearch, setGlobalSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const handlePrint = useCallback(async () => {
    await document.fonts?.ready;
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => window.print()));
  }, []);

  useEffect(() => {
    document.documentElement.lang = displayLocale === "zh-Hans" ? "zh-CN" : "zh-TW";
  }, [displayLocale]);

  useLayoutEffect(() => {
    const root = appShellRef.current;
    if (!root || displayLocale !== "zh-Hans") return;
    return observeSimplifiedChinese(root, toSimplifiedChinese);
  });

  useEffect(() => {
    const controller = new AbortController();
    async function loadData() {
      try {
        const response = await fetch("/api/data", { cache: "no-store", signal: controller.signal });
        const payload = await response.json() as AppData & { error?: string };
        if (!response.ok) throw new Error(payload.error || "讀取資料失敗。");
        if (!controller.signal.aborted) setData(payload);
      } catch (loadError) {
        if (!controller.signal.aborted) setError(loadError instanceof Error ? loadError.message : "讀取資料失敗。");
      }
    }
    void loadData();
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function postAction(body: object, successMessage: string) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/data", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(normalizeToTraditional(body)),
      });
      const payload = await response.json() as AppData & { error?: string };
      if (!response.ok) throw new Error(payload.error || "儲存失敗。");
      setData(payload);
      setToast(successMessage);
      return payload;
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "儲存失敗。");
      return null;
    } finally {
      setBusy(false);
    }
  }

  const selected = useMemo(
    () => data?.positions.find((position) => position.id === selectedId) ?? null,
    [data, selectedId],
  );
  const selectedUnit = useMemo(
    () => data?.orgNodes.find((node) => node.id === selectedUnitId && node.type === "unit") ?? null,
    [data, selectedUnitId],
  );
  const selectedAssessment = useMemo(
    () => data?.assessments.find((assessment) => assessment.id === selectedAssessmentId) ?? null,
    [data, selectedAssessmentId],
  );
  const selectedPerson = useMemo(
    () => data?.people.find((person) => person.id === selectedPersonId) ?? null,
    [data, selectedPersonId],
  );

  const draft = editing ? positionEditDraft : selected;
  const personDraft = editing ? personEditDraft : selectedPerson;

  const pendingItems = useMemo(() => (data?.positions ?? []).filter(
    (position) => position.confirmationStatus !== "主管確認",
  ), [data]);

  const globalResults = useMemo(() => {
    const term = searchable(globalSearch);
    if (!term || !data) return [];
    if (globalSearchType === "unit") return data.orgNodes.filter((node) => node.type === "unit" && node.name.toLowerCase().includes(term)).slice(0, 8);
    return data.positions.filter((position) => `${position.name} ${position.department} ${position.unit}`.toLowerCase().includes(term)).slice(0, 8);
  }, [data, globalSearch, globalSearchType]);

  const metrics = useMemo(() => {
    const positions = data?.positions ?? [];
    const headcountKnown = positions.length > 0 && positions.every((position) => Number.isFinite(position.headcount) && position.headcount > 0);
    const headcount = positions.reduce((sum, position) => sum + position.headcount, 0);
    const unknownHeadcountPositions = positions.filter((position) => position.headcount <= 0).length;
    const current = positions.reduce((sum, position) => sum + position.incumbents.length, 0);
    return {
      total: positions.length,
      built: positions.filter((position) => position.status !== "待建立").length,
      confirmed: positions.filter((position) => position.confirmationStatus === "主管確認").length,
      pending: pendingItems.length,
      headcount: headcountKnown ? headcount : null,
      knownHeadcount: headcount,
      unknownHeadcountPositions,
      current,
      vacancy: headcountKnown ? Math.max(0, headcount - current) : null,
    };
  }, [data, pendingItems]);

  function openPosition(id: string) {
    setSelectedId(id);
    setEditing(false);
    setView("detail");
    window.setTimeout(() => {
      document.querySelector("main")?.scrollTo({ top: 0 });
    }, 50);
  }

  function openUnit(id: string) {
    setSelectedUnitId(id);
    setView("unit");
    setGlobalSearch("");
  }

  function openAssessment(id: string) {
    setSelectedAssessmentId(id);
    setView("assessment");
  }

  function openPerson(id: string) {
    setSelectedPersonId(id);
    setEditing(false);
    setView("person");
  }

  function navigate(nextView: View) {
    if (nextView === "job-descriptions") setLibraryMasterId(null);
    setView(nextView);
    setEditing(false);
  }

  async function saveDraft() {
    if (!draft) return;
    if (!draft.name.trim()) {
      setError("職位名稱不可空白。");
      return;
    }
    const cleanDraft = deepCopy(draft);
    if (!cleanDraft.jobDescriptionId) cleanDraft.document.annotations = (cleanDraft.document.annotations || []).filter((item) => item.content.trim() !== "");
    const linkedPeople = [...cleanDraft.incumbents, ...(cleanDraft.successors ?? [])];
    if (linkedPeople.some((person) => !data?.people.some((master) => master.id === person.id))) {
      setError("現任者或潛在接班人的工號尚未對應到人員主檔，請先確認工號。");
      return;
    }
    const payload = await postAction({ action: "savePosition", position: cleanDraft }, "職位資料已儲存至本機資料庫");
    if (payload) {
      setDraft(deepCopy(payload.positions.find((position) => position.id === cleanDraft.id)!));
      setEditing(false);
    }
  }

  async function savePersonDraft() {
    if (!personDraft?.name.trim()) return setError("人員姓名不可空白。");
    const payload = await postAction({ action: "savePerson", person: personDraft }, "人員與職位連結已儲存至本機資料庫");
    if (payload) {
      setPersonDraft(deepCopy(payload.people.find((person) => person.id === personDraft.id)!));
      setEditing(false);
    }
  }

  function updateDraft(updater: (next: PositionRecord) => void) {
    setDraft((current) => {
      if (!current) return current;
      const next = deepCopy(current);
      updater(next);
      return next;
    });
  }

  function ancestorsFor(nodeId: string) {
    if (!data) return [];
    const byId = new Map(data.orgNodes.map((node) => [node.id, node]));
    const result: OrgNode[] = [];
    let cursor = byId.get(nodeId);
    while (cursor) {
      result.unshift(cursor);
      cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
    }
    return result;
  }

  async function createNode() {
    if (!data || !addParentId || !newNodeName.trim()) return;
    const stamp = Date.now().toString(36);
    const nodeId = `node-${stamp}`;
    const positionId = newNodeType === "position" ? `p-${stamp}` : null;
    const siblingCount = data.orgNodes.filter((node) => node.parentId === addParentId).length;
    const node: OrgNode = {
      id: nodeId, parentId: addParentId, name: newNodeName.trim(), type: newNodeType,
      positionId, sortOrder: siblingCount + 1,
      duties: newNodeType === "unit" ? "🔴 待確認｜請主管確認本單位的主要執掌。" : "",
      purpose: newNodeType === "unit" ? "🔴 待確認｜請主管確認本單位的部門目的。" : "",
      organizationStatus: newNodeType === "unit" ? "待確認" : "已確認",
    };
    let position: PositionRecord | undefined;
    if (positionId) {
      const units = ancestorsFor(addParentId).filter((item) => item.type === "unit").map((item) => item.name);
      position = {
        id: positionId, jobDescriptionId: null, name: newNodeName.trim(), site: "VT", department: units[0] ?? "",
        unit: units.length > 1 ? units.at(-1)! : "", grade: newNodeGrade.trim(), reportsTo: "待確認",
        status: "待建立", version: "0.1", effectiveDate: "", updatedAt: new Date().toISOString().slice(0, 10),
        confidentiality: "人事機密", headcount: 1, confirmationStatus: "待確認", confirmedBy: "", confirmedAt: "",
        confirmationNote: "", document: blankDocument(), incumbents: [],
      };
    }
    const payload = await postAction({ action: "addNode", node, position }, "新節點已建立");
    if (payload) {
      setAddParentId(null);
      setNewNodeName("");
      setNewNodeGrade("");
    }
  }

  async function dropNode(targetParentId: string) {
    if (!draggedNodeId || draggedNodeId === targetParentId || !data) return;
    const moved = data.orgNodes.find((node) => node.id === draggedNodeId);
    const target = data.orgNodes.find((node) => node.id === targetParentId);
    if (!moved || !target) return;
    if (!window.confirm(`確認將「${moved.name}」移至「${target.name}」之下？`)) return;
    await postAction({ action: "moveNode", nodeId: moved.id, parentId: target.id }, "組織歸屬已更新");
    setDraggedNodeId(null);
  }

  async function removeNode(node: OrgNode) {
    if (!window.confirm(`確認刪除「${node.name}」？此操作會寫入本機資料庫。`)) return;
    await postAction({ action: "deleteNode", nodeId: node.id }, "節點已刪除");
  }

  if (!data && !error) {
    return <div className="loading-screen"><div className="loading-mark">VT</div><p>正在讀取職位資料…</p></div>;
  }

  return (
    <div ref={appShellRef} className="app-shell" lang="zh-TW">
      <header className="sidebar no-print">
        <div className="brand">
          <div className="brand-mark">VT</div>
          <div><strong>職位與人才</strong><span>管理系統</span></div>
        </div>
        <nav aria-label="主要導覽">
          <button className={view === "dashboard" ? "active" : ""} onClick={() => navigate("dashboard")}><span>◫</span>管理總覽</button>
          <button className={view === "org" ? "active" : ""} onClick={() => navigate("org")}><span>⌘</span>組織圖</button>
          <button className={view === "job-descriptions" ? "active" : ""} onClick={() => navigate("job-descriptions")}><span>▤</span>工作說明書</button>
          <button className={view === "people" || view === "person" || view === "assessment" ? "active" : ""} onClick={() => navigate("people")}><span>◎</span>人員盤點</button>
          <button className={view === "competencies" ? "active" : ""} onClick={() => navigate("competencies")}><span>❖</span>職能盤點</button>
        </nav>
      </header>

      <div className="workspace">
        <header className="topbar no-print">
          <div>
            <p className="eyebrow">VT POSITION & TALENT</p>
            <h1>{view === "dashboard" ? "管理總覽" : view === "org" ? "動態組織圖" : view === "job-descriptions" ? "工作說明書" : view === "people" ? "人員盤點" : view === "competencies" ? "職能盤點" : view === "person" ? selectedPerson?.name ?? "人員明細" : view === "assessment" ? selectedAssessment?.personName ?? "盤點明細" : view === "unit" ? selectedUnit?.name ?? "單位明細" : selected?.name ?? "職位明細"}</h1>
          </div>
          <div className="topbar-actions">
            <label className="locale-switcher" title="資料庫只保存一份繁體中文資料">
              <span>顯示語系</span>
              <select aria-label="顯示語系" value={displayLocale} onChange={(event) => setDisplayLocale(event.target.value as DisplayLocale)}>
                <option value="zh-Hant">繁體中文</option>
                <option value="zh-Hans">簡體中文</option>
              </select>
            </label>
            <div className="global-search">
              <select aria-label="搜尋類型" value={globalSearchType} onChange={(event) => setGlobalSearchType(event.target.value as "position" | "unit")}><option value="position">職位</option><option value="unit">部門</option></select>
              <input aria-label="全站搜尋" value={globalSearch} onChange={(event) => setGlobalSearch(event.target.value)} placeholder={globalSearchType === "position" ? "搜尋職位" : "搜尋部門"} />
              {globalResults.length > 0 && <div className="global-results">{globalResults.map((result) => <button key={result.id} onClick={() => { if (globalSearchType === "unit") openUnit(result.id); else openPosition(result.id); setGlobalSearch(""); }}>{result.name}<small>{"department" in result ? [result.department, result.unit].filter(Boolean).join("／") : "單位"}</small></button>)}</div>}
            </div>
          </div>
        </header>

        <main className={view === "detail" ? "detail-main" : ""}>
          {error && <div className="alert no-print"><strong>無法完成操作</strong><span>{error}</span><button onClick={() => setError("")} aria-label="關閉">×</button></div>}
          {toast && <div className="toast no-print">✓ {toast}</div>}

          {view === "dashboard" && <Dashboard metrics={metrics} pendingItems={pendingItems} onOpen={openPosition} />}
          {view === "org" && data && (
            <OrgChart
              data={data}
              orgEditing={orgEditing}
              busy={busy}
              draggedNodeId={draggedNodeId}
              onToggleEdit={() => setOrgEditing((value) => !value)}
              onOpen={openPosition}
              onOpenUnit={openUnit}
              onDragStart={setDraggedNodeId}
              onDrop={dropNode}
              onAdd={setAddParentId}
              onDelete={removeNode}
              onPrint={handlePrint}
            />
          )}
          {view === "job-descriptions" && data && <JobDescriptionsView key={libraryMasterId ?? "overview"} initialId={libraryMasterId} data={data} busy={busy} postAction={postAction} makeBlank={blankJobDescription} normalizeSearch={searchable} onPrint={handlePrint} onOpenPosition={openPosition} onOpenPerson={openPerson} />}
          {view === "people" && data && <PeopleInventory data={data} search={peopleSearch} onSearch={setPeopleSearch} onOpenPerson={openPerson} onPrint={handlePrint} />}
          {view === "competencies" && data && (
            <CompetenciesView
              data={data}
              busy={busy}
              onOpenPosition={openPosition}
              onOpenPerson={openPerson}
              postAction={postAction}
            />
          )}
          {view === "person" && data && personDraft && <PersonDetail person={personDraft} positions={data.positions} competencies={data.competencies ?? []} assessments={data.assessments.filter((item) => item.personId === personDraft.id)} editing={editing} busy={busy} onEdit={() => { setPersonDraft(deepCopy(personDraft)); setEditing(true); }} onCancel={() => { setPersonDraft(selectedPerson ? deepCopy(selectedPerson) : null); setEditing(false); }} onSave={savePersonDraft} onBack={() => navigate("people")} onOpenAssessment={openAssessment} onOpenPosition={openPosition} onPrint={handlePrint} update={(updater) => setPersonDraft((current) => { if (!current) return current; const next = deepCopy(current); updater(next); return next; })} />}
          {view === "assessment" && selectedAssessment && <AssessmentDetail assessment={selectedAssessment} onBack={() => navigate("people")} onOpenPosition={openPosition} onPrint={handlePrint} />}
          {view === "detail" && draft && (
            <PositionDetail
              position={draft}
              people={data?.people ?? []}
              competencies={data?.competencies ?? []}
              jobDescriptions={data?.jobDescriptions ?? []}
              editing={editing}
              busy={busy}
              onEdit={() => { setDraft(deepCopy(draft)); setEditing(true); }}
              onCancel={() => { setDraft(selected ? deepCopy(selected) : null); setEditing(false); }}
              onSave={saveDraft}
              onBack={() => navigate("org")}
              onPrint={handlePrint}
              onLinkJobDescription={async (jobDescriptionId) => {
                const payload = await postAction({ action: "linkPositionJobDescription", positionId: draft.id, jobDescriptionId }, jobDescriptionId ? "已關聯工作說明書" : "已取消工作說明書關聯");
                if (payload) setDraft(deepCopy(payload.positions.find((position) => position.id === draft.id)!));
              }}
              onOpenJobDescription={() => { setLibraryMasterId(draft.jobDescriptionId); setView("job-descriptions"); setEditing(false); }}
              update={updateDraft}
            />
          )}
          {view === "unit" && selectedUnit && <UnitDetail key={selectedUnit.id} unit={selectedUnit} positions={data?.positions ?? []} orgNodes={data?.orgNodes ?? []} busy={busy} onBack={() => navigate("org")} onSave={async (name, purpose, duties, supervisorName, supervisorTitle, organizationStatus) => {
            const payload = await postAction({ action: "saveUnit", nodeId: selectedUnit.id, name, purpose, duties, supervisorName, supervisorTitle, organizationStatus }, "單位資料已儲存");
            return Boolean(payload);
          }} />}
        </main>
      </div>

      {addParentId && (
        <Modal label="新增下層節點" onClose={() => setAddParentId(null)}>
            <div className="modal-head"><div><p className="eyebrow">組織編輯</p><h2 id="new-node-title">新增下層節點</h2></div><button onClick={() => setAddParentId(null)} aria-label="關閉">×</button></div>
            <label>節點類型<select value={newNodeType} onChange={(event) => setNewNodeType(event.target.value as "unit" | "position")}><option value="position">職位</option><option value="unit">部門／單位</option></select></label>
            <label>{newNodeType === "position" ? "職位名稱" : "單位名稱"}<input value={newNodeName} onChange={(event) => setNewNodeName(event.target.value)} placeholder="請輸入名稱" /></label>
            {newNodeType === "position" && <label>職等<input value={newNodeGrade} onChange={(event) => setNewNodeGrade(event.target.value)} placeholder="例如：經理、高專" /></label>}
            <div className="modal-actions"><button className="button secondary" onClick={() => setAddParentId(null)}>取消</button><button className="button primary" disabled={busy || !newNodeName.trim()} onClick={createNode}>建立節點</button></div>
        </Modal>
      )}
    </div>
  );
}

function Dashboard({ metrics, pendingItems, onOpen }: {
  metrics: { total: number; built: number; confirmed: number; pending: number; headcount: number | null; knownHeadcount: number; unknownHeadcountPositions: number; current: number; vacancy: number | null };
  pendingItems: PositionRecord[];
  onOpen: (id: string) => void;
}) {
  return <div className="page-stack">
    <section className="metric-grid" aria-label="職位統計">
      <Metric label="組織職位" value={metrics.total} note={`已有內容 ${metrics.built} 個`} tone="navy" />
      <Metric label="待確認職位" value={metrics.pending} note="依確認階段追蹤" tone="amber" />
      <Metric label="已確認職位" value={metrics.confirmed} note="不含正式生效" tone="green" />
      <Metric label="編制／現職" value={metrics.headcount === null ? `${metrics.current} / 已知 ${metrics.knownHeadcount}` : `${metrics.current} / ${metrics.headcount}`} note={metrics.vacancy === null ? `另有 ${metrics.unknownHeadcountPositions} 個職位編制待確認` : `目前缺額 ${metrics.vacancy} 人`} tone="blue" />
    </section>
    <section className="content-card">
      <div className="section-title"><div><p className="eyebrow">FOCUS ITEMS</p><h2>待確認事項</h2></div><span className="count-pill">{pendingItems.length} 項</span></div>
      <div className="pending-list">
        {pendingItems.slice(0, 12).map((position) => (
          <button key={position.id} onClick={() => onOpen(position.id)}>
            <span className={statusClass(position.confirmationStatus)}>{position.confirmationStatus}</span>
            <span className="pending-main"><strong>{position.name}</strong><small>{position.incumbents.length ? `現任者：${position.incumbents.map((item) => item.name).join("、")}` : "現任者待確認"}{position.confirmationNote ? ` · ${position.confirmationNote}` : ""}</small></span>
            <span className="arrow">→</span>
          </button>
        ))}
        {!pendingItems.length && <div className="empty-state">目前沒有待確認事項。</div>}
      </div>
    </section>
  </div>;
}

function Metric({ label, value, note, tone }: { label: string; value: string | number; note: string; tone: string }) {
  return <article className={`metric ${tone}`}><div className="metric-icon">{tone === "navy" ? "職" : tone === "amber" ? "?" : tone === "green" ? "✓" : "人"}</div><div><span>{label}</span><strong>{value}</strong><small>{note}</small></div></article>;
}

function OrgChart({ data, orgEditing, busy, draggedNodeId, onToggleEdit, onOpen, onOpenUnit, onDragStart, onDrop, onAdd, onDelete, onPrint }: {
  data: AppData; orgEditing: boolean; busy: boolean; draggedNodeId: string | null;
  onToggleEdit: () => void; onOpen: (id: string) => void; onOpenUnit: (id: string) => void;
  onDragStart: (id: string | null) => void; onDrop: (id: string) => void; onAdd: (id: string) => void;
  onDelete: (node: OrgNode) => void; onPrint: () => void;
}) {
  const [expandMode, setExpandMode] = useState<"none" | "all" | "associate" | "manager">("none");
  const root = data.orgNodes.find((node) => node.type === "unit" && !node.parentId);
  const gradeRank = (grade: string) => grade.includes("協理") ? 5 : grade.includes("經理") ? 4 : grade.includes("主任") ? 3 : grade.includes("高專") || grade.includes("專員") ? 2 : 1;
  const threshold = expandMode === "associate" ? 5 : expandMode === "manager" ? 4 : 0;

  function showPositionsFor(unitId: string, positions: PositionRecord[]) {
    if (expandMode === "all") return positions;
    if (expandMode === "associate" || expandMode === "manager") return positions.filter((position) => gradeRank(position.grade) >= threshold);
    return [];
  }

  function UnitBranch({ unit }: { unit: OrgNode }) {
    const childNodes = data.orgNodes.filter((node) => node.parentId === unit.id).sort((a, b) => a.sortOrder - b.sortOrder);
    const positionNodes = childNodes.filter((node) => node.type === "position");
    const childUnits = childNodes.filter((node) => node.type === "unit");
    const allPositions = positionNodes.map((node) => ({ node, position: data.positions.find((position) => position.id === node.positionId) })).filter((item): item is { node: OrgNode; position: PositionRecord } => Boolean(item.position));
    const visiblePositions = showPositionsFor(unit.id, allPositions.map((item) => item.position));
    const nodeById = new Map(data.orgNodes.map((node) => [node.id, node]));
    const unitPositions = data.positions.filter((position) => {
      let node = data.orgNodes.find((item) => item.type === "position" && item.positionId === position.id);
      while (node?.parentId) {
        if (node.parentId === unit.id) return true;
        node = nodeById.get(node.parentId);
      }
      return false;
    });
    const currentPeople = unitPositions.reduce((sum, position) => sum + position.incumbents.length, 0);
    const totalHeadcount = unitPositions.reduce((sum, position) => sum + position.headcount, 0);
    const hasUnknownHeadcount = unitPositions.some((position) => position.headcount <= 0);
    const unitPending = unit.organizationStatus === "待確認";
    const inferredSupervisorPosition = [...allPositions].sort((a, b) => gradeRank(b.position.grade) - gradeRank(a.position.grade)).find((item) => item.position.incumbents.length > 0)?.position;
    const supervisorName = unit.supervisorName || inferredSupervisorPosition?.incumbents[0]?.name || "—";
    const supervisorTitle = unit.supervisorTitle || inferredSupervisorPosition?.grade || "主管未設定";
    return <div className={`org-unit-branch ${unit.id === "node-factory-manager" ? "root-tree" : ""}`}>
      <div
        className={`unit-card ${unit.id === "node-factory-manager" ? "root" : ""} ${unitPending ? "org-pending-node" : ""} ${draggedNodeId === unit.id ? "dragging" : ""}`}
        draggable={orgEditing && unit.id !== "node-factory-manager"}
        onDragStart={() => onDragStart(unit.id)} onDragEnd={() => onDragStart(null)}
        onDragOver={(event) => { if (orgEditing) event.preventDefault(); }}
        onDrop={(event) => { event.preventDefault(); if (orgEditing) void onDrop(unit.id); }}
      >
        <button className="unit-card-main" onClick={() => onOpenUnit(unit.id)}><span>{unitPending ? "單位 · 待確認" : "單位"}</span><strong>{unit.name}</strong><div className="unit-supervisor-line"><b>{supervisorName}</b><em>{supervisorTitle}</em></div><small>{totalHeadcount > 0 ? `已知編制：${currentPeople}/${totalHeadcount}人${hasUnknownHeadcount ? "；另有待確認" : ""}` : "編制待確認"}</small></button>
        {orgEditing && <div className="unit-card-tools"><button onClick={() => onAdd(unit.id)}>＋</button>{unit.id !== "node-factory-manager" && <button onClick={() => void onDelete(unit)}>×</button>}</div>}
      </div>
      {visiblePositions.length > 0 && <div className="unit-positions">{allPositions.filter((item) => visiblePositions.some((position) => position.id === item.position.id)).map(({ node, position }) => <button
        key={node.id} draggable={orgEditing} onDragStart={() => onDragStart(node.id)} onDragEnd={() => onDragStart(null)} onClick={() => onOpen(position.id)}
        className={`${hasConfirmedImportedDocument(position) ? "document-imported" : "document-pending"} ${draggedNodeId === node.id ? "dragging" : ""}`}
      ><span>{hasConfirmedImportedDocument(position) ? `工作說明書 · ${data.jobDescriptions.find((item) => item.id === position.jobDescriptionId)?.code ?? "已關聯"}` : "工作說明書 · 待關聯"}</span><strong>{position.name}</strong><small>{position.headcount > 0 ? `人數：${position.incumbents.length}/${position.headcount}人` : "編制待確認"}</small></button>)}</div>}
      {childUnits.length > 0 && <div className="org-unit-children">{childUnits.map((child) => <UnitBranch key={child.id} unit={child} />)}</div>}
    </div>;
  }

  return <div className="page-stack">
    <section className="toolbar-card org-toolbar">
      <div><p className="eyebrow">ORGANIZATION</p><h2>單位與職位層級</h2><p>{orgEditing ? "可拖拉單位或職位調整歸屬；所有異動均會再次確認。" : "同層單位並列顯示，點擊單位可維護部門執掌。"}</p><DocumentImportLegend positions={data.positions} /></div>
      <div className="org-toolbar-actions">
        <div className="expand-actions"><span>展開職位</span><button className={expandMode === "none" ? "active" : ""} onClick={() => setExpandMode("none")}>收合</button><button className={expandMode === "associate" ? "active" : ""} onClick={() => setExpandMode("associate")}>協理層級</button><button className={expandMode === "manager" ? "active" : ""} onClick={() => setExpandMode("manager")}>部門主管層級</button><button className={expandMode === "all" ? "active" : ""} onClick={() => setExpandMode("all")}>全部展開</button></div>
        <button className="button secondary no-print" style={{ minHeight: "44px", borderRadius: "10px", padding: "0 16px" }} onClick={onPrint}>列印／PDF</button>
        <button className={`mode-toggle ${orgEditing ? "editing" : ""}`} onClick={onToggleEdit} disabled={busy}><span>{orgEditing ? "編輯中" : "展示中"}</span><strong>{orgEditing ? "結束組織編輯" : "進入組織編輯"}</strong></button>
      </div>
    </section>
    {orgEditing && <div className="edit-notice">管理操作模式：可新增、刪除或拖拉節點。未來正式上線後，此模式僅限 Admin。</div>}
    <section className="org-canvas top-down">{root ? <UnitBranch unit={root} /> : <div className="empty-state">尚未建立根單位。</div>}</section>
  </div>;
}


function DocumentImportLegend({ positions = [] }: { positions?: PositionRecord[] }) {
  const importedDocumentCount = new Set(
    positions.filter(hasConfirmedImportedDocument).map((position) => position.jobDescriptionId ?? position.id),
  ).size;
  return <div className="document-import-legend" aria-label="工作說明書匯入狀態圖例">
    <span><i className="imported" />已匯入（{importedDocumentCount} 份）</span>
    <span><i className="pending" />待建立</span>
  </div>;
}


function PeopleInventory({ data, search, onSearch, onOpenPerson, onPrint }: {
  data: AppData; search: string; onSearch: (value: string) => void; onOpenPerson: (id: string) => void; onPrint?: () => void;
}) {
  const [nationalityFilter, setNationalityFilter] = useState("");
  const [genderFilter, setGenderFilter] = useState("");
  const term = searchable(search);
  const people = data.people.filter((person) => {
    const links = person.positions.map((link) => `${link.positionName} ${link.relationshipType}`).join(" ");
    const matchTerm = !term || `${person.name} ${person.employeeNo} ${person.notes} ${links}`.toLowerCase().includes(term);
    const matchNat = !nationalityFilter || person.nationality === nationalityFilter;
    const matchGender = !genderFilter || person.gender === genderFilter;
    return matchTerm && matchNat && matchGender;
  });
  return <div className="page-stack">
    <section className="filter-bar people-filter">
      <label className="search-box"><span>⌕</span><input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="搜尋人員、目標職位或關係" /></label>
      <label>國籍<select value={nationalityFilter} onChange={(e) => setNationalityFilter(e.target.value)}><option value="">全部國籍</option><option value="台籍">🇹🇼 台籍</option><option value="越籍">🇻🇳 越籍</option></select></label>
      <label>性別<select value={genderFilter} onChange={(e) => setGenderFilter(e.target.value)}><option value="">全部性別</option><option value="男">👨 男</option><option value="女">👩 女</option></select></label>
      <button className="button secondary no-print" onClick={onPrint || (() => window.print())}>列印／PDF</button>
      <span className="result-count">{people.length} 位人員</span>
    </section>
    <section className="table-card">
      <div className="people-table" role="table" aria-label="人員盤點列表">
        <div className="people-table-row people-table-head" role="row"><span>人員</span><span>現任職位</span><span>潛在接班職位</span><span>盤點資料</span><span>確認階段</span><span></span></div>
        {people.map((person) => {
          const assessments = data.assessments.filter((item) => item.personId === person.id);
          const current = person.positions.filter((link) => link.relationshipType === "現任者");
          const successors = person.positions.filter((link) => link.relationshipType === "潛在接班人");
          return <button className="people-table-row" role="row" key={person.id} onClick={() => onOpenPerson(person.id)}>
            <span className="position-cell"><strong>{person.name}</strong><small>{person.nationality || "越籍"}／{person.gender || "女"}{person.employeeNo ? ` · 工號：${person.employeeNo}` : ""}</small></span>
            <span>{current.length ? current.map((link) => link.positionName).join("、") : "—"}</span>
            <span>{successors.length ? successors.map((link) => link.positionName).join("、") : "—"}</span>
            <span><strong>{assessments.length} 份</strong><small>{assessments[0]?.status ?? "尚未建立"}</small></span>
            <span><em className={statusClass(person.confirmationStatus)}>{person.confirmationStatus}</em></span>
            <span className="arrow">→</span>
          </button>;
        })}
      </div>
      {!people.length && <div className="empty-state">沒有符合條件的人員。</div>}
    </section>
  </div>;
}

function PersonDetail({ person, positions, competencies = [], assessments, editing, busy, onEdit, onCancel, onSave, onBack, onOpenAssessment, onOpenPosition, onPrint, update }: {
  person: PersonRecord; positions: PositionRecord[]; competencies?: CompetencyRecord[]; assessments: TalentAssessment[]; editing: boolean; busy: boolean;
  onEdit: () => void; onCancel: () => void; onSave: () => void; onBack: () => void; onOpenAssessment: (id: string) => void; onOpenPosition: (id: string) => void;
  onPrint?: () => void;
  update: (updater: (next: PersonRecord) => void) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const possessedComp = person.possessedCompetencies ?? [];
  const achievements = person.achievements ?? [];
  const rotations = person.departmentRotations ?? [];

  return <article className="person-detail">
    <div className="detail-actions no-print"><button className="back-button" onClick={onBack}>← 返回人員盤點</button><div>{editing ? <><button className="button secondary" onClick={onCancel}>取消</button><button className="button primary" disabled={busy} onClick={onSave}>{busy ? "儲存中…" : "儲存變更"}</button></> : <><button className="button secondary" onClick={onPrint || (() => window.print())}>列印／PDF</button><button className="button primary" onClick={onEdit}>編輯人員</button></>}</div></div>
    <header><p className="eyebrow light">TALENT PROFILE</p>{editing ? <input value={person.name} onChange={(event) => update((next) => { next.name = event.target.value; })} /> : <h1>{person.name}</h1>}<p>人員基本資料、個人資產履歷與盤點紀錄</p></header>
    
    <section><div className="detail-section-head"><div><span>01</span><h2>基本資料與確認</h2></div></div>{editing ? <div className="form-grid">
      <label>員工編號<input value={person.employeeNo} onChange={(event) => update((next) => { next.employeeNo = event.target.value; })} /></label>
      <label>國籍<select value={person.nationality || "越籍"} onChange={(event) => update((next) => { next.nationality = event.target.value; })}><option value="台籍">🇹🇼 台籍</option><option value="越籍">🇻🇳 越籍</option></select></label>
      <label>性別<select value={person.gender || "女"} onChange={(event) => update((next) => { next.gender = event.target.value; })}><option value="男">👨 男</option><option value="女">👩 女</option></select></label>
      <label>確認階段<select value={person.confirmationStatus} onChange={(event) => update((next) => { next.confirmationStatus = event.target.value as ConfirmationStatus; })}>{confirmationOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label>確認人<input value={person.confirmedBy} onChange={(event) => update((next) => { next.confirmedBy = event.target.value; })} /></label>
      <label>確認日期<input type="date" value={person.confirmedAt} onChange={(event) => update((next) => { next.confirmedAt = event.target.value; })} /></label>
      <label className="wide">人員備註<textarea value={person.notes} onChange={(event) => update((next) => { next.notes = event.target.value; })} /></label>
      <label className="wide">確認備註<textarea value={person.confirmationNote} onChange={(event) => update((next) => { next.confirmationNote = event.target.value; })} /></label>
    </div> : <div className="basic-grid"><Info label="員工編號" value={person.employeeNo || "待確認"} /><Info label="國籍／性別" value={`${person.nationality || "越籍"}／${person.gender || "女"}`} /><Info label="確認階段" value={person.confirmationStatus} /><Info label="確認人／日期" value={[person.confirmedBy, person.confirmedAt].filter(Boolean).join("／") || "待確認"} /><Info label="備註" value={person.notes || "待確認"} /></div>}</section>

    <section><div className="detail-section-head"><div><span>02</span><h2>職位連結</h2></div></div>{editing ? <div className="person-link-editor">
      {person.positions.map((link, index) => <div key={link.id} className="person-link-row"><select value={link.positionId} onChange={(event) => update((next) => { const position = positions.find((item) => item.id === event.target.value); next.positions[index].positionId = event.target.value; next.positions[index].positionName = position?.name ?? ""; })}>{positions.map((position) => <option value={position.id} key={position.id}>{position.name}</option>)}</select><select value={link.relationshipType} onChange={(event) => update((next) => { next.positions[index].relationshipType = event.target.value as PersonRecord["positions"][number]["relationshipType"]; })}><option>現任者</option><option>潛在接班人</option></select><input value={link.notes} onChange={(event) => update((next) => { next.positions[index].notes = event.target.value; })} placeholder="關係備註" /><button onClick={() => update((next) => { next.positions.splice(index, 1); })}>移除</button></div>)}
      <button className="add-row" onClick={() => update((next) => { const position = positions[0]; if (!position) return; next.positions.push({ id: `link-${Date.now().toString(36)}`, positionId: position.id, positionName: position.name, relationshipType: "現任者", notes: "" }); })}>＋ 新增職位連結</button>
    </div> : <div className="linked-position-list">{person.positions.map((link) => <button key={link.id} onClick={() => onOpenPosition(link.positionId)}><span>{link.relationshipType}</span><strong>{link.positionName}</strong><p>{link.notes || "關係備註待確認"}</p><small>查看職位 →</small></button>)}{!person.positions.length && <div className="empty-inline">尚未連結職位</div>}</div>}</section>

    <section><div className="detail-section-head"><div><span>03</span><h2>個人資產與履歷歷程</h2></div></div>
      {editing ? <div style={{ display: "grid", gap: "20px" }}>
        <div>
          <h4 style={{ margin: "0 0 8px", fontSize: "13px", color: "var(--navy-950)" }}>⭐ 認定具備職能 (含認定依據)</h4>
          <div style={{ display: "grid", gap: "8px" }}>
            {possessedComp.map((item, idx) => (
              <div key={idx} style={{ display: "grid", gridTemplateColumns: "1.2fr 2fr 130px auto", gap: "8px", alignItems: "center" }}>
                <select value={item.competencyName} onChange={(e) => update((next) => { (next.possessedCompetencies ??= [])[idx].competencyName = e.target.value; })}>
                  <option value="">-- 選擇職能 --</option>
                  {competencies.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                  {item.competencyName && !competencies.some((c) => c.name === item.competencyName) && <option value={item.competencyName}>{item.competencyName}</option>}
                </select>
                <input value={item.reason} placeholder="為什麼認定具備的原因／佐證經歷" onChange={(e) => update((next) => { (next.possessedCompetencies ??= [])[idx].reason = e.target.value; })} />
                <input type="date" value={item.dateRecorded || today} onChange={(e) => update((next) => { (next.possessedCompetencies ??= [])[idx].dateRecorded = e.target.value; })} />
                <button type="button" className="button secondary" style={{ color: "var(--red)", borderColor: "#e6c2c6" }} onClick={() => update((next) => { (next.possessedCompetencies ??= []).splice(idx, 1); })}>移除</button>
              </div>
            ))}
            <button type="button" className="button secondary" style={{ fontSize: "12px" }} onClick={() => update((next) => { (next.possessedCompetencies ??= []).push({ competencyName: competencies[0]?.name || "團隊合作", reason: "", dateRecorded: today }); })}>＋ 新增具備職能</button>
          </div>
        </div>

        <div>
          <h4 style={{ margin: "0 0 8px", fontSize: "13px", color: "var(--navy-950)" }}>🏆 崗位成就</h4>
          <div style={{ display: "grid", gap: "8px" }}>
            {achievements.map((item, idx) => (
              <div key={idx} style={{ display: "grid", gridTemplateColumns: "1.2fr 2fr 130px auto", gap: "8px", alignItems: "center" }}>
                <input value={item.title} placeholder="成就主題 (如：完成發電機優化)" onChange={(e) => update((next) => { (next.achievements ??= [])[idx].title = e.target.value; })} />
                <input value={item.description} placeholder="具體成果說明與數據" onChange={(e) => update((next) => { (next.achievements ??= [])[idx].description = e.target.value; })} />
                <input type="date" value={item.dateRecorded || today} onChange={(e) => update((next) => { (next.achievements ??= [])[idx].dateRecorded = e.target.value; })} />
                <button type="button" className="button secondary" style={{ color: "var(--red)", borderColor: "#e6c2c6" }} onClick={() => update((next) => { (next.achievements ??= []).splice(idx, 1); })}>移除</button>
              </div>
            ))}
            <button type="button" className="button secondary" style={{ fontSize: "12px" }} onClick={() => update((next) => { (next.achievements ??= []).push({ title: "", description: "", dateRecorded: today }); })}>＋ 新增崗位成就</button>
          </div>
        </div>

        <div>
          <h4 style={{ margin: "0 0 8px", fontSize: "13px", color: "var(--navy-950)" }}>🔄 歷練部門歷史</h4>
          <div style={{ display: "grid", gap: "8px" }}>
            {rotations.map((item, idx) => (
              <div key={idx} style={{ display: "grid", gridTemplateColumns: "1.2fr 2fr 130px auto", gap: "8px", alignItems: "center" }}>
                <input value={item.departmentName} placeholder="部門名稱 (如：資材部)" onChange={(e) => update((next) => { (next.departmentRotations ??= [])[idx].departmentName = e.target.value; })} />
                <input value={item.role} placeholder="歷練職務 (如：資材採購幹部)" onChange={(e) => update((next) => { (next.departmentRotations ??= [])[idx].role = e.target.value; })} />
                <input type="date" value={item.dateRecorded || today} onChange={(e) => update((next) => { (next.departmentRotations ??= [])[idx].dateRecorded = e.target.value; })} />
                <button type="button" className="button secondary" style={{ color: "var(--red)", borderColor: "#e6c2c6" }} onClick={() => update((next) => { (next.departmentRotations ??= []).splice(idx, 1); })}>移除</button>
              </div>
            ))}
            <button type="button" className="button secondary" style={{ fontSize: "12px" }} onClick={() => update((next) => { (next.departmentRotations ??= []).push({ departmentName: "", role: "", dateRecorded: today }); })}>＋ 新增歷練部門</button>
          </div>
        </div>
      </div> : <div style={{ display: "grid", gap: "16px" }}>
        <div>
          <h4 style={{ margin: "0 0 8px", fontSize: "13px", color: "var(--navy-950)" }}>⭐ 認定具備職能 (含認定依據)</h4>
          {possessedComp.length ? <div className="tag-list">{possessedComp.map((c, i) => <span key={i} title={c.reason}>⭐ <strong>{c.competencyName}</strong>{c.reason ? ` (${c.reason})` : ""}<small style={{ marginLeft: "4px", color: "var(--slate-500)" }}>{c.dateRecorded}</small></span>)}</div> : <div className="empty-inline">尚無紀錄</div>}
        </div>
        <div>
          <h4 style={{ margin: "0 0 8px", fontSize: "13px", color: "var(--navy-950)" }}>🏆 崗位成就</h4>
          {achievements.length ? <div style={{ display: "grid", gap: "6px" }}>{achievements.map((a, i) => <div key={i} style={{ padding: "8px 12px", background: "#f8fafc", borderRadius: "6px", border: "1px solid var(--slate-200)" }}><strong>{a.title}</strong><span style={{ marginLeft: "8px", fontSize: "11px", color: "var(--slate-500)" }}>{a.dateRecorded}</span><p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--slate-700)" }}>{a.description}</p></div>)}</div> : <div className="empty-inline">尚無紀錄</div>}
        </div>
        <div>
          <h4 style={{ margin: "0 0 8px", fontSize: "13px", color: "var(--navy-950)" }}>🔄 歷練部門歷史</h4>
          {rotations.length ? <div style={{ display: "grid", gap: "6px" }}>{rotations.map((r, i) => <div key={i} style={{ padding: "6px 12px", background: "#f8fafc", borderRadius: "6px", border: "1px solid var(--slate-200)", fontSize: "12px" }}><strong>{r.departmentName}</strong> · {r.role}<span style={{ marginLeft: "8px", fontSize: "11px", color: "var(--slate-500)" }}>{r.dateRecorded}</span></div>)}</div> : <div className="empty-inline">尚無紀錄</div>}
        </div>
      </div>}
    </section>

    <section><div className="detail-section-head"><div><span>04</span><h2>盤點文件歷史</h2></div></div><div className="assessment-link-list">{assessments.map((assessment) => <button key={assessment.id} onClick={() => onOpenAssessment(assessment.id)}><strong>{assessment.targetPositionName}</strong><span>{assessment.status} · v{assessment.version} · 定稿日期：{assessment.finalizedDate || assessment.updatedAt}</span><small>查看盤點明細 →</small></button>)}{!assessments.length && <div className="empty-inline">尚未建立盤點文件</div>}</div></section>
  </article>;
}

function AssessmentDetail({ assessment, onBack, onOpenPosition, onPrint }: {
  assessment: TalentAssessment; onBack: () => void; onOpenPosition: (id: string) => void; onPrint?: () => void;
}) {
  const sections = assessment.sections.filter((s) => s.title !== "優先待驗證項目與發展行動初稿");

  const compMatched: string[] = [];
  const compMissing: string[] = [];
  const qualCompleted: string[] = [];
  const qualPending: string[] = [];

  sections.forEach((sec) => {
    (sec.rows || []).forEach((row) => {
      const valStr = (row.values || []).join(" ");
      const isPossessed = valStr.includes("已具備") || valStr.includes("有") || valStr.includes("獨立") || valStr.includes("具備");
      const isMissing = valStr.includes("尚未具備") || valStr.includes("未經歷") || valStr.includes("證據不足");

      if (sec.title.includes("能力") || sec.title.includes("要求")) {
        if (isPossessed) compMatched.push(row.label);
        else if (isMissing) compMissing.push(row.label);
      } else {
        if (isPossessed) qualCompleted.push(row.label);
        else if (isMissing) qualPending.push(row.label);
      }
    });
  });

  const totalComp = compMatched.length + compMissing.length;
  const totalQual = qualCompleted.length + qualPending.length;

  return <article className="assessment-detail">
    <div className="detail-actions no-print"><button className="back-button" onClick={onBack}>← 返回人員盤點</button><button className="button secondary" onClick={onPrint || (() => window.print())}>列印／PDF</button></div>
    <header><div><p className="eyebrow light">TALENT ASSESSMENT</p><h1>{assessment.personName}</h1><p>現職人員盤點與評估明細</p></div><button onClick={() => onOpenPosition(assessment.targetPositionId)}><span>目標職位</span><strong>{assessment.targetPositionName}</strong><small>查看職位明細 →</small></button></header>
    <div className="assessment-meta"><span>狀態：{assessment.status}</span><span>版本：v{assessment.version}</span><span>定稿日期：{assessment.finalizedDate || assessment.updatedAt}</span></div>

    <div className="assessment-overview-bar no-print">
      <div className="metric-hover-box">
        <span className="metric-caption">🎯 職能條件達成率 (滑鼠移至此處呈現符合清單)</span>
        <strong>{compMatched.length} / {totalComp || compMatched.length} 職能</strong>
        <small>{compMissing.length ? `仍有 ${compMissing.length} 項未具備` : "全數符合職能標準"}</small>
        <div className="tooltip-popup">
          <h4>職能盤點動態比對明細</h4>
          <div><strong>✅ 已具備 ({compMatched.length})：</strong></div>
          <ul>{compMatched.length ? compMatched.map((item, i) => <li key={i}>{item}</li>) : <li>無</li>}</ul>
          <div style={{ marginTop: "6px" }}><strong>❌ 尚未具備 ({compMissing.length})：</strong></div>
          <ul>{compMissing.length ? compMissing.map((item, i) => <li key={i}>{item}</li>) : <li>無</li>}</ul>
        </div>
      </div>

      <div className="metric-hover-box">
        <span className="metric-caption">🏁 歷練與任職條件達成率 (滑鼠移至此處呈現符合清單)</span>
        <strong>{qualCompleted.length} / {totalQual || qualCompleted.length} 條件</strong>
        <small>{qualPending.length ? `仍有 ${qualPending.length} 項未完成` : "全數滿足任職條件"}</small>
        <div className="tooltip-popup">
          <h4>歷練條件動態比對明細</h4>
          <div><strong>✅ 已完成 ({qualCompleted.length})：</strong></div>
          <ul>{qualCompleted.length ? qualCompleted.map((item, i) => <li key={i}>{item}</li>) : <li>無</li>}</ul>
          <div style={{ marginTop: "6px" }}><strong>❌ 尚未完成 ({qualPending.length})：</strong></div>
          <ul>{qualPending.length ? qualPending.map((item, i) => <li key={i}>{item}</li>) : <li>無</li>}</ul>
        </div>
      </div>
    </div>

    {sections.map((section, sectionIndex) => <section key={`${section.title}-${sectionIndex}`}><div className="detail-section-head"><div><span>{String(sectionIndex + 1).padStart(2, "0")}</span><h2>{section.title}</h2></div></div><div className="assessment-table">
      {section.rows.map((row, rowIndex) => {
        const valStr = (row.values || []).join(" ");
        const isPossessed = valStr.includes("已具備") || valStr.includes("有") || valStr.includes("獨立") || valStr.includes("具備");
        const isMissing = valStr.includes("尚未具備") || valStr.includes("未經歷") || valStr.includes("證據不足");
        const rowClass = isPossessed ? "assessment-row-possessed" : isMissing ? "assessment-row-missing" : "assessment-row-pending";
        return <div key={`${row.label}-${rowIndex}`} className={rowClass}><strong>{row.label}</strong>{row.values.map((value, valueIndex) => <p key={valueIndex}>{value || "待確認"}</p>)}</div>;
      })}
    </div>{section.note && <p className="assessment-note">{section.note}</p>}</section>)}
    <footer>資料來源：{assessment.sourceFile}</footer>
  </article>;
}

function PositionDetail({ position, people, competencies = [], jobDescriptions = [], editing, busy, onEdit, onCancel, onSave, onBack, onPrint, onLinkJobDescription, onOpenJobDescription, update }: {
  position: PositionRecord; people: PersonRecord[]; competencies?: CompetencyRecord[]; jobDescriptions?: JobDescriptionRecord[]; editing: boolean; busy: boolean; onEdit: () => void; onCancel: () => void;
  onSave: () => void; onBack: () => void; onPrint: () => void; onLinkJobDescription: (jobDescriptionId: string | null) => Promise<void>; update: (updater: (next: PositionRecord) => void) => void;
  onOpenJobDescription: () => void;
}) {
  const documentEditing = editing && !position.jobDescriptionId;
  const vacancy = Math.max(0, position.headcount - position.incumbents.length);
  const successors = position.successors ?? [];
  const responsibilityPrintStyle = {
    "--print-responsibility-rows": Math.max(1, Math.ceil(position.document.responsibilities.length / 2)),
  } as CSSProperties;
  const editableStatusOptions = positionStatusOptions.includes(position.status)
    ? positionStatusOptions
    : [position.status, ...positionStatusOptions];
  const linkedJobDescription = jobDescriptions.find((item) => item.id === position.jobDescriptionId);
  const displayedDocument: JobDescriptionRecord = { ...position, id: linkedJobDescription?.id ?? position.id, code: linkedJobDescription?.code ?? "", title: position.name, usageCount: position.jobDescriptionUsageCount ?? 0 };
  function selectPerson(inputVal: string, relation: "incumbents" | "successors", index: number, field: "employeeNo" | "name") {
    update((next) => {
      const target = relation === "incumbents" ? next.incumbents : (next.successors ??= []);
      const trimmed = inputVal.trim();
      
      let master = people.find((p) => 
        (field === "employeeNo" && p.employeeNo && p.employeeNo === trimmed) ||
        (field === "name" && p.name && p.name === trimmed)
      );
      if (!master && trimmed) {
        master = people.find((p) => (p.employeeNo && p.employeeNo === trimmed) || (p.name && p.name === trimmed));
      }

      if (master) {
        target[index] = {
          ...target[index],
          id: master.id,
          name: master.name,
          employeeNo: master.employeeNo,
        };
      } else {
        target[index] = {
          ...target[index],
          id: target[index].id && !target[index].id.startsWith("unresolved-") ? target[index].id : `person-temp-${Date.now().toString(36)}`,
          [field]: inputVal,
        };
      }
    });
  }

  return <article className="position-detail print-document">
    <div className="detail-actions no-print">
      <button className="back-button" onClick={onBack}>← 返回組織圖</button>
      <div>{editing ? <><button className="button secondary" onClick={onCancel}>取消</button><button className="button primary" disabled={busy} onClick={onSave}>{busy ? "儲存中…" : "儲存變更"}</button></> : <><button className="button secondary" onClick={onPrint}>列印／PDF</button><button className="button primary" onClick={onEdit}>編輯職位</button></>}</div>
    </div>
    {editing ? <><header className="document-header">
      <div><p className="eyebrow">VT POSITION PROFILE</p>{documentEditing ? <input className="title-input" value={position.name} onChange={(event) => update((next) => { next.name = event.target.value; })} /> : <h1>{position.name}</h1>}</div>
    </header>
    <div className={`print-meta${editing ? " editing" : ""}`}>
      {documentEditing ? <>
        <label>版本<input value={position.version} onChange={(event) => update((next) => { next.version = event.target.value; })} /></label>
        <label>文件狀態<select value={position.status} onChange={(event) => update((next) => { next.status = event.target.value; })}>{editableStatusOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
        <span>更新：{position.updatedAt}</span>
        <label>確認階段<select value={position.confirmationStatus} onChange={(event) => update((next) => { next.confirmationStatus = event.target.value as ConfirmationStatus; })}>{confirmationOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
      </> : <><span>版本：v{position.version}</span><span>文件狀態：{position.status}</span><span>更新：{position.updatedAt}</span><span>確認階段：{position.confirmationStatus}</span></>}
    </div></> : <DocumentHeader record={displayedDocument} />}
    <div className="job-description-linker no-print">
      <div><span>工作說明書關聯</span><strong>{linkedJobDescription ? `${linkedJobDescription.code}｜${linkedJobDescription.title}` : "尚未關聯主檔"}</strong><small>組織職位的編制與人員分開保存；工作內容由所選主檔共用。</small>{linkedJobDescription && <button className="jd-link" disabled={editing || busy} onClick={onOpenJobDescription}>查看最新版與歷史版本</button>}</div>
      <label>選擇工作說明書
        <select value={position.jobDescriptionId ?? ""} disabled={busy || editing} onChange={async (event) => {
          const nextId = event.target.value || null;
          const nextLabel = nextId ? jobDescriptions.find((item) => item.id === nextId)?.code ?? "所選文件" : "未關聯";
          if (!window.confirm(`確認將此職位關聯改為「${nextLabel}」？`)) return;
          await onLinkJobDescription(nextId);
        }}>
          <option value="">未關聯工作說明書</option>
          {jobDescriptions.map((item) => <option key={item.id} value={item.id}>{item.code}｜{item.title}{item.usageCount ? `（使用中 ${item.usageCount}）` : ""}</option>)}
        </select>
      </label>
    </div>
    {(position.jobDescriptionUsageCount ?? 1) > 1 && <div className="shared-document-notice">
      共用工作說明書 {linkedJobDescription?.code ? `(${linkedJobDescription.code})` : ""}｜此內容由 {position.jobDescriptionUsageCount} 個職位配置共同引用；本頁的編制、現任者與單位歸屬仍分開保存。
    </div>}

    {position.jobDescriptionId && editing && <div className="shared-document-notice">此頁編輯單位、編制與人員；共用文件內容與版本請至上方「工作說明書」管理，以保留生效版與歷史紀錄。</div>}
    {editing ? <><section className="detail-section" id="section-basic"><SectionHead sectionKey="basic" title="職位基本資料" index="01" />
      {editing ? <div className="form-grid">
        <label>廠區<input value={position.site} onChange={(event) => update((next) => { next.site = event.target.value; })} /></label>
        <label>部門<input value={position.department} onChange={(event) => update((next) => { next.department = event.target.value; })} /></label>
        <label>單位<input value={position.unit} onChange={(event) => update((next) => { next.unit = event.target.value; })} /></label>
        <label>職等<input disabled={Boolean(position.jobDescriptionId)} value={position.grade} onChange={(event) => update((next) => { next.grade = event.target.value; })} /></label>
        <label>直接主管<input disabled={Boolean(position.jobDescriptionId)} value={position.reportsTo} onChange={(event) => update((next) => { next.reportsTo = event.target.value; })} /></label>
        <label>編制人數<input type="number" min="0" value={position.headcount} onChange={(event) => update((next) => { next.headcount = Number(event.target.value); })} /></label>
        <label className="management-unit-edit">管理單位<input disabled={Boolean(position.jobDescriptionId)} value={position.document.managementUnit} onChange={(event) => update((next) => { next.document.managementUnit = event.target.value; })} /></label>
        <label>生效日期<input type="date" disabled={Boolean(position.jobDescriptionId)} value={position.effectiveDate} onChange={(event) => update((next) => { next.effectiveDate = event.target.value; })} /></label>
        <label>審核者<input disabled value={position.reviewer ?? ""} placeholder="由工作說明書帶入" /></label>
      </div> : <div className="basic-grid">
        <Info label="廠區" value={position.site} /><Info label="部門／單位" value={[position.department, position.unit].filter(Boolean).join("／") || "待確認"} />
        <Info label="職等" value={position.grade || "待確認"} /><Info label="直接主管" value={position.reportsTo} />
        <Info label="編制／現職" value={position.headcount > 0 ? `${position.headcount}／${position.incumbents.length} 人` : "待確認"} /><Info label="工作說明書代碼" value={linkedJobDescription?.code ?? "未關聯"} /><Info className="management-unit" label="管理單位" value={position.document.managementUnit || "待確認"} />
      </div>}
    </section>

    <section className="detail-section" id="section-purpose"><SectionHead sectionKey="purpose" title="職位目的" index="02" />
      {documentEditing ? <textarea className="content-editor" value={position.document.purpose} onChange={(event) => update((next) => { next.document.purpose = event.target.value; })} /> : <p className="lead-text">{position.document.purpose}</p>}
    </section>

    <section className="detail-section" id="section-responsibilities"><SectionHead sectionKey="responsibilities" title="主要職責" index="03" />
      {documentEditing ? <textarea className="content-editor tall" value={position.document.responsibilities.map((item) => `${item.code}|${item.text}`).join("\n")} onChange={(event) => update((next) => { next.document.responsibilities = fromLines(event.target.value).map((item, index) => { const [code, ...text] = item.split("|"); return { code: text.length ? code : `R${String(index + 1).padStart(2, "0")}`, text: text.length ? text.join("|") : code }; }); })} /> : <div className="responsibility-list" style={responsibilityPrintStyle}>{position.document.responsibilities.map((item) => <div key={`${item.code}-${item.text}`}><span>{item.code}</span><p>{item.text}{item.annotation && <em className="inline-note">🔴 {item.annotation}</em>}</p></div>)}</div>}
    </section>

    <section className="detail-section" id="section-authority"><SectionHead sectionKey="authority" title="決策與權限" index="04" />
      {documentEditing ? <textarea className="content-editor" value={position.document.authority} onChange={(event) => update((next) => { next.document.authority = event.target.value; })} /> : <AuthorityTable value={position.document.authority} />}
    </section>

    <section className="detail-section" id="section-performance"><SectionHead sectionKey="performance" title="績效衡量方向" index="05" />
      {documentEditing ? <textarea className="content-editor" value={lines(position.document.performance)} onChange={(event) => update((next) => { next.document.performance = fromLines(event.target.value); })} /> : <BulletList items={position.document.performance} />}
    </section>

    <section className="detail-section" id="section-requirements"><SectionHead sectionKey="requirements" title="關鍵能力與任職條件" index="06" />
      {documentEditing ? (
        <div className="two-column-edit">
          <div>
            <div style={{ display: "block", marginBottom: "8px", fontWeight: "bold" }}>
              關鍵能力（由職能盤點主檔選擇）
            </div>
            <div style={{ display: "grid", gap: "8px" }}>
              {(position.document.competencies || []).map((compTag, cIdx) => (
                <div key={`${compTag}-${cIdx}`} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <select
                    style={{ flex: 1, height: "38px", padding: "0 8px" }}
                    value={compTag}
                    onChange={(e) =>
                      update((next) => {
                        next.document.competencies[cIdx] = e.target.value;
                      })
                    }
                  >
                    <option value="">-- 請選擇職能 --</option>
                    {competencies.map((c) => (
                      <option key={c.id} value={c.id}>
                        [{c.category}] {c.id} {c.name}
                      </option>
                    ))}
                    {compTag && !competencies.some((c) => c.name === compTag || c.id === compTag) && (
                      <option value={compTag}>{compTag} (原始標籤)</option>
                    )}
                  </select>
                  <button
                    type="button"
                    className="button secondary"
                    style={{ height: "38px", padding: "0 10px", fontSize: "11px", color: "var(--red)", border: "1px solid #e6c2c6" }}
                    onClick={() =>
                      update((next) => {
                        next.document.competencies.splice(cIdx, 1);
                      })
                    }
                  >
                    移除
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="button secondary"
                style={{ marginTop: "4px", fontSize: "12px", height: "36px" }}
                onClick={() =>
                  update((next) => {
                    const defaultComp = competencies[0]?.id || "";
                    next.document.competencies.push(defaultComp);
                  })
                }
              >
                ＋ 新增關鍵能力
              </button>
              <small style={{ color: "var(--slate-500)", marginTop: "4px", display: "block", fontSize: "10px" }}>
                💡 若下拉選單無所需能力，請至「❖ 職能盤點」先建立新職能。
              </small>
            </div>
          </div>
          <label>
            任職條件與必要歷練（每行一項）
            <textarea
              value={lines(position.document.requirements)}
              onChange={(event) =>
                update((next) => {
                  next.document.requirements = fromLines(event.target.value);
                })
              }
            />
          </label>
        </div>
      ) : (
        <div className="two-column-content">
          <div>
            <h3>關鍵能力</h3>
            <CompetencyTags items={position.document.competencies} competencies={competencies} />
          </div>
          <div>
            <h3>任職條件與必要歷練</h3>
            <BulletList items={position.document.requirements} />
          </div>
        </div>
      )}
    </section>

    <section className="detail-section" id="section-languages"><SectionHead sectionKey="languages" title="語言要求" index="07" />
      <div className="language-grid">{(["mandarin", "vietnamese", "english"] as const).map((key) => <div key={key}><span>{key === "mandarin" ? "中文／國語" : key === "vietnamese" ? "越文" : "英文"}</span>{documentEditing ? <textarea value={position.document.languages[key]} onChange={(event) => update((next) => { next.document.languages[key] = event.target.value; })} /> : <p>{position.document.languages[key]}</p>}</div>)}</div>
    </section></> : <PositionDocumentSections record={displayedDocument} position={position} competencies={competencies} />}

    <section className="detail-section print-hide" id="section-incumbents"><SectionHead sectionKey="incumbents" title="編制與現任者" index="08" />
      <div className="headcount-summary"><div><span>核定編制</span><strong>{position.headcount > 0 ? position.headcount : "待確認"}</strong></div><div><span>現職人數</span><strong>{position.incumbents.length}</strong></div><div className={position.headcount > 0 && vacancy ? "has-vacancy" : ""}><span>目前缺額</span><strong>{position.headcount > 0 ? vacancy : "待確認"}</strong></div></div>
      {editing ? <div className="incumbent-editor">
        {position.incumbents.map((person, index) => <div className="incumbent-row linked-person-row" key={`${person.id}-${index}`}>
          <label>工號<input list="employee-master-list" value={person.employeeNo} onChange={(event) => selectPerson(event.target.value, "incumbents", index, "employeeNo")} placeholder="輸入工號 (自動帶出)" /></label>
          <label>姓名<input list="employee-name-master-list" value={person.name} onChange={(event) => selectPerson(event.target.value, "incumbents", index, "name")} placeholder="輸入姓名 (自動帶出)" /></label>
          <label>到任日期<input type="date" value={person.startDate} onChange={(event) => update((next) => { next.incumbents[index].startDate = event.target.value; })} /></label>
          <label>關係備註<input value={person.notes} onChange={(event) => update((next) => { next.incumbents[index].notes = event.target.value; })} placeholder="備註" /></label>
          <button onClick={() => update((next) => { next.incumbents.splice(index, 1); })}>移除</button>
        </div>)}
        <button className="add-row" onClick={() => update((next) => { next.incumbents.push({ id: `person-temp-${Date.now().toString(36)}`, name: "", employeeNo: "", startDate: "", notes: "" }); })}>＋ 新增現任者 (自動連動人員盤點)</button>
      </div> : position.incumbents.length ? <div className="people-list">{position.incumbents.map((person) => <div key={person.id}><span className="avatar">{person.name.slice(0, 1)}</span><div><strong>{person.name}</strong><small>{person.employeeNo || "員工編號待確認"}{person.startDate ? ` · 到任 ${person.startDate}` : ""}</small>{person.notes && <p>{person.notes}</p>}</div></div>)}</div> : <div className="empty-inline">現任者待確認</div>}
      <div className="successor-box"><div><span>潛在接班人</span><small>輸入工號或姓名自動連動人員盤點</small></div>{editing ? <div className="successor-editor">{successors.map((person, index) => <div className="incumbent-row linked-person-row" key={`${person.id}-${index}`}>
        <label>工號<input list="employee-master-list" value={person.employeeNo} onChange={(event) => selectPerson(event.target.value, "successors", index, "employeeNo")} placeholder="輸入工號" /></label>
        <label>姓名<input list="employee-name-master-list" value={person.name} onChange={(event) => selectPerson(event.target.value, "successors", index, "name")} placeholder="輸入姓名" /></label>
        <label>關係起日<input type="date" value={person.startDate} onChange={(event) => update((next) => { (next.successors ??= [])[index].startDate = event.target.value; })} /></label>
        <label>關係備註<input value={person.notes} onChange={(event) => update((next) => { (next.successors ??= [])[index].notes = event.target.value; })} /></label>
        <button onClick={() => update((next) => { (next.successors ??= []).splice(index, 1); })}>移除</button>
      </div>)}<button className="add-row" onClick={() => update((next) => { (next.successors ??= []).push({ id: `person-temp-${Date.now().toString(36)}`, name: "", employeeNo: "", startDate: "", notes: "" }); })}>＋ 新增接班者</button></div> : <strong>{successors.length ? successors.map((person) => `${person.name}${person.employeeNo ? `（${person.employeeNo}）` : ""}`).join("、") : "待確認"}</strong>}</div>
      <datalist id="employee-master-list">{people.filter((person) => person.employeeNo).map((person) => <option value={person.employeeNo} key={person.id}>{person.name} ({person.nationality || "越籍"})</option>)}</datalist>
      <datalist id="employee-name-master-list">{people.map((person) => <option value={person.name} key={person.id}>{person.name} {person.employeeNo ? `(${person.employeeNo})` : ""}</option>)}</datalist>
    </section>

    <footer className="document-footer">VT 職位與人才管理系統 · v{position.version}</footer>
  </article>;
}

function UnitDetail({ unit, positions = [], orgNodes = [], busy, onBack, onSave }: {
  unit: OrgNode; positions?: PositionRecord[]; orgNodes?: OrgNode[]; busy: boolean; onBack: () => void; onSave: (name: string, purpose: string, duties: string, supervisorName: string, supervisorTitle: string, organizationStatus: "待確認" | "已確認") => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(unit.name);
  const [duties, setDuties] = useState(unit.duties);
  const [purpose, setPurpose] = useState(unit.purpose);
  const [organizationStatus, setOrganizationStatus] = useState<"待確認" | "已確認">(unit.organizationStatus);

  const derivedSupervisor = useMemo(() => {
    const childNodes = orgNodes.filter((node) => node.parentId === unit.id);
    const positionNodes = childNodes.filter((node) => node.type === "position");
    const positionsInUnit = positionNodes.map((n) => positions.find((p) => p.id === n.positionId)).filter(Boolean) as PositionRecord[];
    
    const gradeRank = (grade: string) => grade.includes("協理") ? 5 : grade.includes("經理") ? 4 : grade.includes("主任") ? 3 : grade.includes("高專") || grade.includes("專員") ? 2 : 1;
    const highestPos = positionsInUnit.sort((a, b) => gradeRank(b.grade) - gradeRank(a.grade))[0];
    
    if (highestPos) {
      const names = highestPos.incumbents.map((i) => i.name).join("、") || unit.supervisorName || "待指派";
      return { name: names, title: `${highestPos.name} (${highestPos.grade})` };
    }
    if (unit.id === "node-factory-manager") {
      return { name: "柯宏育", title: "執行協理" };
    }
    return { name: unit.supervisorName || "—", title: unit.supervisorTitle || "主管職位待連動" };
  }, [unit, positions, orgNodes]);

  return <div className="unit-detail page-stack">
    <div className="detail-actions no-print"><button className="back-button" onClick={onBack}>← 返回組織圖</button><div>{editing ? <><button className="button secondary" onClick={() => { setEditing(false); setName(unit.name); setDuties(unit.duties); setPurpose(unit.purpose); setOrganizationStatus(unit.organizationStatus); }}>取消</button><button className="button primary" disabled={busy || !name.trim()} onClick={async () => { if (await onSave(name, purpose, duties, derivedSupervisor.name, derivedSupervisor.title, organizationStatus)) setEditing(false); }}>儲存單位</button></> : <button className="button primary" onClick={() => { setName(unit.name); setDuties(unit.duties); setPurpose(unit.purpose); setOrganizationStatus(unit.organizationStatus); setEditing(true); }}>編輯單位</button>}</div></div>
    <section className="unit-profile-card">
      <header><p className="eyebrow light">ORGANIZATION UNIT</p>{editing ? <input value={name} onChange={(event) => setName(event.target.value)} /> : <h1>{unit.name}</h1>}<p>點擊編輯後，可補充本單位的責任範圍與主要執掌。</p>{editing ? <label className="unit-status-editor">組織確認狀態<select value={organizationStatus} onChange={(event) => setOrganizationStatus(event.target.value as "待確認" | "已確認")}><option>待確認</option><option>已確認</option></select></label> : <span className={`unit-status-badge ${unit.organizationStatus === "待確認" ? "pending" : "confirmed"}`}>組織狀態：{unit.organizationStatus}</span>}</header>
      <div className="unit-supervisor-content"><div><span>01</span><h2>單位主管</h2></div><p style={{ display: "flex", alignItems: "center", gap: "8px" }}><strong>{derivedSupervisor.name}</strong> · <span>{derivedSupervisor.title}</span><small style={{ color: "var(--slate-500)" }}>(由職位與現任者自動連動)</small></p></div>
      <div className="unit-duty-content"><div><span>02</span><h2>部門目的</h2></div>{editing ? <textarea value={purpose} onChange={(event) => setPurpose(event.target.value)} placeholder="請輸入部門目的；尚未確認的內容請保留 🔴 待確認｜ 標示" /> : <p>{unit.purpose || "🔴 待確認｜請主管確認本單位的部門目的。"}</p>}</div>
      <div className="unit-duty-content"><div><span>03</span><h2>部門執掌</h2></div>{editing ? <textarea value={duties} onChange={(event) => setDuties(event.target.value)} placeholder="請輸入部門主要執掌；尚未確認的內容請保留 🔴 待確認｜ 標示" /> : <p>{unit.duties || "🔴 待確認｜請主管確認本單位的主要執掌。"}</p>}</div>
    </section>
  </div>;
}

function Info({ label, value, className }: { label: string; value: string; className?: string }) {
  return <div className={className}><span>{label}</span><strong>{value}</strong></div>;
}

function BulletList({ items }: { items: string[] }) {
  return <ul className="bullet-list">{items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul>;
}

function AuthorityTable({ value }: { value: string }) {
  const match = value.match(/可自行決定[：:]\s*([\s\S]*?)需協商[／/]會簽[：:]\s*([\s\S]*?)需向上核定[：:]\s*([\s\S]*)/u);
  if (!match) return <p className="lead-text">{value}</p>;

  const rows = [
    ["可自行決定", match[1].trim()],
    ["需協商／會簽", match[2].trim()],
    ["需向上核定", match[3].trim()],
  ];
  return <div className="authority-table">{rows.map(([label, content]) => <div className="authority-row" key={label}><strong>{label}</strong><p>{content}</p></div>)}</div>;
}

function CompetenciesView({ data, busy, onOpenPosition, onOpenPerson, postAction }: {
  data: AppData;
  busy: boolean;
  onOpenPosition: (id: string) => void;
  onOpenPerson: (id: string) => void;
  postAction: (body: object, msg: string) => Promise<AppData | null>;
}) {
  const [categoryFilter, setCategoryFilter] = useState<"all" | CompetencyCategory>("all");
  const [unitFilter, setUnitFilter] = useState<string>("all");
  const [natFilter, setNatFilter] = useState("");
  const [genderFilter, setGenderFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedComp, setSelectedComp] = useState<CompetencyRecord | null>(null);
  const [editingComp, setEditingComp] = useState<CompetencyRecord | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState<CompetencyCategory>("專業職能");
  const [formDescription, setFormDescription] = useState("");

  const competencies = data.competencies;
  const orgNodes = data.orgNodes;
  const positionsList = data.positions;

  const unitNodes = useMemo(() => orgNodes.filter((n) => n.type === "unit"), [orgNodes]);

  const hierarchicalUnitSet = useMemo(() => {
    const set = new Set<string>();
    if (!unitFilter || unitFilter === "all") return set;

    const rootNode = orgNodes.find((n) => n.id === unitFilter || n.name === unitFilter);
    if (!rootNode) {
      set.add(unitFilter);
      return set;
    }

    const stack = [rootNode.id];
    const nameMap = new Map(orgNodes.map((n) => [n.id, n.name]));

    while (stack.length > 0) {
      const currId = stack.pop()!;
      set.add(currId);
      const name = nameMap.get(currId);
      if (name) set.add(name);

      const children = orgNodes.filter((n) => n.parentId === currId && n.type === "unit");
      children.forEach((c) => stack.push(c.id));
    }
    return set;
  }, [orgNodes, unitFilter]);

  const getUsage = useCallback((comp: CompetencyRecord) => {
    if (!comp || !comp.name) return { neededPositions: [], possessedPeople: [] };
    const normName = (comp.name || "").trim().toLowerCase();
    const compIdNorm = (comp.id || "").toLowerCase();

    const neededPositions = positionsList.filter((pos) => {
      if (unitFilter !== "all" && hierarchicalUnitSet.size > 0) {
        const posNode = orgNodes.find((n) => n.type === "position" && n.positionId === pos.id);
        let matchUnit = false;
        if (posNode && posNode.parentId && hierarchicalUnitSet.has(posNode.parentId)) {
          matchUnit = true;
        }
        if (hierarchicalUnitSet.has(pos.department) || hierarchicalUnitSet.has(pos.unit)) {
          matchUnit = true;
        }
        if (!matchUnit) return false;
      }

      const competencyMatch = (pos.document?.competencies || []).some((c) => {
        if (!c || typeof c !== "string") return false;
        const tagNorm = c.trim().toLowerCase();
        if (!tagNorm) return false;
        return (
          tagNorm === compIdNorm ||
          tagNorm === normName ||
          (normName.length > 0 && (tagNorm.includes(normName) || normName.includes(tagNorm)))
        );
      });
      if (competencyMatch) return true;
      const languageKey = comp.id === "L01" ? "mandarin" : comp.id === "L02" ? "vietnamese" : comp.id === "L03" ? "english" : null;
      const languageRequirement = languageKey ? pos.document?.languages?.[languageKey] : "";
      return Boolean(languageRequirement && !languageRequirement.includes("尚未提供"));
    });

    const personSet = new Map<string, PersonRecord>();
    neededPositions.forEach((pos) => {
      (pos.incumbents || []).forEach((inc) => {
        const p = (data?.people || []).find((item) => item.id === inc.id || (item.employeeNo && item.employeeNo === inc.employeeNo));
        if (p) personSet.set(p.id, p);
      });
    });

    (data?.people || []).forEach((person) => {
      if (person.notes && typeof person.notes === "string" && normName.length > 0 && person.notes.toLowerCase().includes(normName)) {
        personSet.set(person.id, person);
      }
    });

    const filteredPeople = Array.from(personSet.values()).filter((person) => {
      const matchNat = !natFilter || (person.nationality || "越籍") === natFilter;
      const matchGen = !genderFilter || (person.gender || "女") === genderFilter;
      return matchNat && matchGen;
    });

    return {
      neededPositions,
      possessedPeople: filteredPeople,
    };
  }, [data, positionsList, orgNodes, unitFilter, hierarchicalUnitSet, natFilter, genderFilter]);

  const filtered = useMemo(() => {
    const term = searchable(searchTerm);
    return competencies.filter((item) => {
      if (!item) return false;
      const matchCat = categoryFilter === "all" || item.category === categoryFilter;
      const nameMatch = (item.name || "").toLowerCase().includes(term);
      const descMatch = (item.description || "").toLowerCase().includes(term);
      const matchSearch = !term || nameMatch || descMatch;

      if (unitFilter !== "all") {
        const usage = getUsage(item);
        if (usage.neededPositions.length === 0) return false;
      }

      return matchCat && matchSearch;
    });
  }, [competencies, categoryFilter, searchTerm, unitFilter, getUsage]);

  const metrics = useMemo(() => {
    const total = competencies.length;
    const managementCount = competencies.filter((c) => c.category === "管理職能").length;
    const profCount = competencies.filter((c) => c.category === "專業職能").length;
    const languageCount = competencies.filter((c) => c.category === "語言能力").length;
    let topName = "無";
    let maxCount = 0;
    competencies.forEach((comp) => {
      const { neededPositions } = getUsage(comp);
      if (neededPositions.length > maxCount) {
        maxCount = neededPositions.length;
        topName = comp.name;
      }
    });
    return { total, managementCount, profCount, languageCount, topName: maxCount > 0 ? `${topName} (${maxCount}職位)` : "評估中" };
  }, [competencies, getUsage]);

  function openCreateModal() {
    setFormName("");
    setFormCategory("專業職能");
    setFormDescription("");
    setIsAdding(true);
  }

  function openEditModal(comp: CompetencyRecord) {
    setEditingComp(comp);
    setFormName(comp.name);
    setFormCategory(comp.category);
    setFormDescription(comp.description);
  }

  async function handleSave() {
    if (!formName.trim()) return;

    const generateNextId = () => {
      const prefix = formCategory === "管理職能" ? "M" : formCategory === "專業職能" ? "P" : "L";
      let maxNum = 0;
      competencies.filter((c) => c.category === formCategory).forEach((c) => {
        const matches = (c.id || "").match(/\d+/g);
        if (matches) {
          matches.forEach((m) => {
            const val = parseInt(m, 10);
            if (!isNaN(val) && val > maxNum) maxNum = val;
          });
        }
      });
      return `${prefix}${String(maxNum + 1).padStart(2, "0")}`;
    };

    const comp: CompetencyRecord = editingComp
      ? { ...editingComp, name: formName.trim(), category: formCategory, description: formDescription.trim(), updatedAt: new Date().toISOString().slice(0, 10) }
      : {
          id: generateNextId(),
          name: formName.trim(),
          category: formCategory,
          description: formDescription.trim(),
          sortOrder: formCategory === "管理職能" ? 1 : formCategory === "專業職能" ? 100 : 200,
          updatedAt: new Date().toISOString().slice(0, 10),
        };

    const res = await postAction({ action: "saveCompetency", competency: comp }, editingComp ? "職能已更新" : "新職能已建立");
    if (res) {
      setIsAdding(false);
      setEditingComp(null);
    }
  }

  async function handleDelete(comp: CompetencyRecord) {
    const normName = (comp.name || "").trim().toLowerCase();
    const compIdNorm = (comp.id || "").toLowerCase();

    // 1. Check needed positions
    const neededPositions = (data.positions || []).filter((pos) => {
      const competencyMatch = (pos.document?.competencies || []).some((c) => {
        if (!c || typeof c !== "string") return false;
        const tagNorm = c.trim().toLowerCase();
        return (
          tagNorm === compIdNorm ||
          tagNorm === normName ||
          (normName.length > 0 && (tagNorm.includes(normName) || normName.includes(tagNorm)))
        );
      });
      if (competencyMatch) return true;
      const languageKey = comp.id === "L01" ? "mandarin" : comp.id === "L02" ? "vietnamese" : comp.id === "L03" ? "english" : null;
      const languageRequirement = languageKey ? pos.document?.languages?.[languageKey] : "";
      return Boolean(languageRequirement && !languageRequirement.includes("尚未提供"));
    });

    // 2. Check total possessed people (unfiltered by nationality/gender)
    const possessedPeople = (data.people || []).filter((person) => {
      const isIncumbentOfNeeded = neededPositions.some((pos) =>
        (pos.incumbents || []).some(
          (inc) => inc.id === person.id || (inc.employeeNo && inc.employeeNo === person.employeeNo)
        )
      );
      if (isIncumbentOfNeeded) return true;
      if (person.notes && typeof person.notes === "string" && normName.length > 0 && person.notes.toLowerCase().includes(normName)) {
        return true;
      }
      return false;
    });

    // 3. Check history assessments
    const assessmentRefs = (data.assessments || []).filter((a) =>
      (a.sections || []).some((sec) =>
        (sec.rows || []).some((row) => {
          const labelNorm = (row.label || "").toLowerCase();
          const valStr = (row.values || []).join(" ").toLowerCase();
          return (
            (normName.length > 0 && (labelNorm.includes(normName) || normName.includes(labelNorm) || valStr.includes(normName))) ||
            (compIdNorm.length > 0 && labelNorm.includes(compIdNorm))
          );
        })
      )
    );

    const reasons: string[] = [];
    if (neededPositions.length > 0) {
      reasons.push(`• 現已有 ${neededPositions.length} 個職位（如：${neededPositions.slice(0, 2).map((p) => p.name).join("、")}）將此能力列為關鍵條件`);
    }
    if (possessedPeople.length > 0) {
      reasons.push(`• 現已有 ${possessedPeople.length} 位人員（如：${possessedPeople.slice(0, 2).map((p) => p.name).join("、")}）被認定具備此能力`);
    }
    if (assessmentRefs.length > 0) {
      reasons.push(`• 現已有 ${assessmentRefs.length} 份盤點歷史紀錄（人才評估文件）引用此能力`);
    }

    if (reasons.length > 0) {
      alert(
        `⛔ 無法刪除職能「${comp.name}」！\n\n系統防護原因：\n${reasons.join("\n")}\n\n依管理防護規則，凡被職位、人員或歷史盤點紀錄引用之職能均不可刪除。請先至對應職位/人員移除此能力之關聯後再試。`
      );
      return;
    }

    if (!window.confirm(`確認刪除職能「${comp.name}」？此操作無法復原。`)) return;
    await postAction({ action: "deleteCompetency", competencyId: comp.id }, "職能已刪除");
  }

  return (
    <div className="page-stack">
      <section className="metric-grid" aria-label="職能統計">
        <Metric label="總職能項目" value={metrics.total} note="管理、專業與語言能力" tone="navy" />
        <Metric label="管理職能" value={metrics.managementCount} note="主管統籌、協調、風險與帶人能力" tone="amber" />
        <Metric label="專業職能" value={metrics.profCount} note="各部門專業領域能力" tone="green" />
        <Metric label="語言能力" value={metrics.languageCount} note="中文／國語、越文、英文" tone="blue" />
      </section>

      <section className="filter-bar">
        <label className="search-box">
          <span>⌕</span>
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="搜尋職能名稱或說明..."
          />
        </label>
        <label>
          部門／單位
          <select value={unitFilter} onChange={(e) => setUnitFilter(e.target.value)}>
            <option value="all">🏢 全公司 (含所有部門)</option>
            {unitNodes.map((u) => (
              <option key={u.id} value={u.id}>
                {u.id === "node-factory-manager" ? "🏭 VT廠 (全廠階層)" : `📍 ${u.name}`}
              </option>
            ))}
          </select>
        </label>
        <label>
          職能類別
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value as "all" | CompetencyCategory)}>
            <option value="all">全部類別 ({competencies.length})</option>
            <option value="管理職能">管理職能</option>
            <option value="專業職能">專業職能</option>
            <option value="語言能力">語言能力</option>
          </select>
        </label>
        <label>
          人員國籍
          <select value={natFilter} onChange={(e) => setNatFilter(e.target.value)}>
            <option value="">全部國籍</option>
            <option value="台籍">🇹🇼 台籍</option>
            <option value="越籍">🇻🇳 越籍</option>
          </select>
        </label>
        <label>
          人員性別
          <select value={genderFilter} onChange={(e) => setGenderFilter(e.target.value)}>
            <option value="">全部性別</option>
            <option value="男">👨 男</option>
            <option value="女">👩 女</option>
          </select>
        </label>
        <button className="button primary" style={{ marginLeft: "auto" }} onClick={openCreateModal}>
          ＋ 新增職能
        </button>
      </section>

      <section className="table-card">
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 110px 2.5fr 140px 140px auto", padding: "13px 21px", background: "#eef3f6", fontWeight: "900", fontSize: "10px", color: "var(--slate-500)", borderBottom: "1px solid var(--slate-200)" }}>
          <span>職能名稱</span>
          <span>類別</span>
          <span>說明與定義</span>
          <span>需求職位</span>
          <span>現職／具備人員</span>
          <span style={{ textAlign: "right" }}>操作</span>
        </div>
        {filtered.map((comp) => {
          const { neededPositions, possessedPeople } = getUsage(comp);
          const isCore = comp.category === "管理職能";
          return (
            <div
              key={comp.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1.2fr 110px 2.5fr 140px 140px auto",
                alignItems: "center",
                padding: "14px 21px",
                borderTop: "1px solid var(--slate-100)",
                background: isCore ? "#fffdf5" : "#fff",
              }}
            >
              <div>
                <strong style={{ fontSize: "14px", color: "var(--navy-950)", display: "block" }}>
                  {comp.id} {comp.name}
                </strong>
              </div>
              <div>
                <span
                  style={{
                    display: "inline-block",
                    padding: "3px 8px",
                    borderRadius: "4px",
                    fontSize: "11px",
                    fontWeight: "800",
                    background: isCore ? "var(--amber-soft)" : "var(--blue-100)",
                    color: isCore ? "var(--amber)" : "var(--navy-800)",
                    border: `1px solid ${isCore ? "#f0d29f" : "#aac4d7"}`,
                  }}
                >
                  {comp.category}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: "12px", color: "var(--slate-700)", lineHeight: "1.5" }}>
                {comp.description || "尚無說明描述。"}
              </p>
              <div>
                <button
                  type="button"
                  style={{ background: "none", border: "none", color: "var(--navy-700)", fontWeight: "800", cursor: "pointer", textAlign: "left", padding: 0 }}
                  onClick={() => setSelectedComp(comp)}
                >
                  🏢 {neededPositions.length} 個職位需要 →
                </button>
              </div>
              <div>
                <button
                  type="button"
                  style={{ background: "none", border: "none", color: "var(--navy-700)", fontWeight: "800", cursor: "pointer", textAlign: "left", padding: 0 }}
                  onClick={() => setSelectedComp(comp)}
                >
                  👤 {possessedPeople.length} 位人員具備 →
                </button>
              </div>
              <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                <button className="button secondary" style={{ minHeight: "30px", padding: "0 10px", fontSize: "11px" }} onClick={() => setSelectedComp(comp)}>
                  查看
                </button>
                <button className="button secondary" style={{ minHeight: "30px", padding: "0 10px", fontSize: "11px" }} onClick={() => openEditModal(comp)}>
                  編輯
                </button>
                <button className="button danger" style={{ minHeight: "30px", padding: "0 8px", fontSize: "11px", background: "var(--red-soft)", color: "var(--red)", border: "1px solid #e6c2c6", borderRadius: "6px" }} onClick={() => handleDelete(comp)}>
                  刪除
                </button>
              </div>
            </div>
          );
        })}
        {!filtered.length && <div className="empty-state">沒有符合條件的職能項目。</div>}
      </section>

      {selectedComp && (
        <CompetencyDetailModal
          comp={selectedComp}
          usage={getUsage(selectedComp)}
          onClose={() => setSelectedComp(null)}
          onOpenPosition={(id) => { setSelectedComp(null); onOpenPosition(id); }}
          onOpenPerson={(id) => { setSelectedComp(null); onOpenPerson(id); }}
        />
      )}

      {(isAdding || editingComp) && (
        <Modal label={editingComp ? "編輯職能" : "新增職能"} onClose={() => { setIsAdding(false); setEditingComp(null); }}>
            <div className="modal-head">
              <div>
                <p className="eyebrow">{editingComp ? "EDIT COMPETENCY" : "NEW COMPETENCY"}</p>
                <h2>{editingComp ? `編輯職能：${editingComp.name}` : "新增職能項目"}</h2>
              </div>
              <button onClick={() => { setIsAdding(false); setEditingComp(null); }}>×</button>
            </div>
            <label>
              職能名稱 *
              <input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="例如：團隊合作、溝通協調"
              />
            </label>
            <label>
              職能類別
              <select value={formCategory} onChange={(e) => setFormCategory(e.target.value as CompetencyCategory)}>
                <option value="管理職能">管理職能（主管成果與帶領）</option>
                <option value="專業職能">專業職能（特定職位）</option>
                <option value="語言能力">語言能力（分語言記錄）</option>
              </select>
            </label>
            <label>
              職能說明與定義
              <textarea
                style={{ width: "100%", minHeight: "80px", marginTop: "5px", padding: "8px" }}
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="請輸入此能力之定義、衡量行為或說明..."
              />
            </label>
            <div className="modal-actions">
              <button className="button secondary" onClick={() => { setIsAdding(false); setEditingComp(null); }}>
                取消
              </button>
              <button className="button primary" disabled={busy || !formName.trim()} onClick={handleSave}>
                {busy ? "儲存中…" : editingComp ? "儲存變更" : "建立職能"}
              </button>
            </div>
        </Modal>
      )}
    </div>
  );
}

function CompetencyDetailModal({
  comp,
  usage,
  onClose,
  onOpenPosition,
  onOpenPerson,
}: {
  comp: CompetencyRecord;
  usage: { neededPositions: PositionRecord[]; possessedPeople: PersonRecord[] };
  onClose: () => void;
  onOpenPosition: (id: string) => void;
  onOpenPerson: (id: string) => void;
}) {
  const isCore = comp.category === "管理職能";
  return (
    <Modal label={`${comp.id} ${comp.name}`} onClose={onClose} style={{ width: "min(680px, 100%)", maxHeight: "85vh", overflowY: "auto" }}>
        <div className="modal-head" style={{ marginBottom: "16px" }}>
          <div>
            <span
              style={{
                display: "inline-block",
                padding: "2px 8px",
                borderRadius: "4px",
                fontSize: "11px",
                fontWeight: "800",
                background: isCore ? "var(--amber-soft)" : "var(--blue-100)",
                color: isCore ? "var(--amber)" : "var(--navy-800)",
                marginBottom: "6px",
              }}
            >
              {comp.category}
            </span>
            <h2 style={{ fontSize: "22px", margin: 0 }}>{comp.id} {comp.name}</h2>
            <p style={{ color: "var(--slate-500)", margin: "4px 0 0", fontSize: "12px" }}>{comp.description || "尚無說明"}</p>
          </div>
          <button onClick={onClose}>×</button>
        </div>

        <div style={{ display: "grid", gap: "20px" }}>
          <div>
            <h3 style={{ fontSize: "14px", color: "var(--navy-950)", marginBottom: "10px", display: "flex", justifyContent: "space-between" }}>
              <span>🏢 需求此能力的職位</span>
              <span style={{ color: "var(--navy-700)" }}>{usage.neededPositions.length} 個職位</span>
            </h3>
            {usage.neededPositions.length > 0 ? (
              <div style={{ display: "grid", gap: "6px" }}>
                {usage.neededPositions.map((pos) => (
                  <button
                    key={pos.id}
                    type="button"
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "10px 14px",
                      background: "var(--paper)",
                      border: "1px solid var(--slate-200)",
                      borderRadius: "8px",
                      textAlign: "left",
                      cursor: "pointer",
                    }}
                    onClick={() => onOpenPosition(pos.id)}
                  >
                    <div>
                      <strong style={{ color: "var(--navy-950)", fontSize: "13px" }}>{pos.name}</strong>
                      <small style={{ color: "var(--slate-500)", display: "block", fontSize: "10px" }}>
                        {[pos.department, pos.unit].filter(Boolean).join("／")} · {pos.grade || "職等待確認"}
                      </small>
                    </div>
                    <span style={{ color: "var(--navy-700)", fontWeight: "800", fontSize: "11px" }}>查看說明書 →</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="empty-inline">目前尚無職位登錄此項能力。</div>
            )}
          </div>

          <div>
            <h3 style={{ fontSize: "14px", color: "var(--navy-950)", marginBottom: "10px", display: "flex", justifyContent: "space-between" }}>
              <span>👤 具備或被評估此能力的人員</span>
              <span style={{ color: "var(--navy-700)" }}>{usage.possessedPeople.length} 位人員</span>
            </h3>
            {usage.possessedPeople.length > 0 ? (
              <div style={{ display: "grid", gap: "6px" }}>
                {usage.possessedPeople.map((person) => (
                  <button
                    key={person.id}
                    type="button"
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "10px 14px",
                      background: "var(--paper)",
                      border: "1px solid var(--slate-200)",
                      borderRadius: "8px",
                      textAlign: "left",
                      cursor: "pointer",
                    }}
                    onClick={() => onOpenPerson(person.id)}
                  >
                    <div>
                      <strong style={{ color: "var(--navy-950)", fontSize: "13px" }}>{person.name}</strong>
                      <small style={{ color: "var(--slate-500)", display: "block", fontSize: "10px" }}>
                        {person.nationality || "越籍"}／{person.gender || "女"}{person.employeeNo ? ` · 工號：${person.employeeNo}` : ""} · {person.confirmationStatus}
                      </small>
                    </div>
                    <span style={{ color: "var(--navy-700)", fontWeight: "800", fontSize: "11px" }}>人員明細 →</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="empty-inline">目前尚無人員連結此項能力。</div>
            )}
          </div>
        </div>

        <div className="modal-actions" style={{ marginTop: "24px" }}>
          <button className="button secondary" onClick={onClose}>
            關閉
          </button>
        </div>
    </Modal>
  );
}
