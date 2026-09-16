import type { Annotation, JobDocument, OrgNode, PositionRecord } from "./types";

const IMPORT_DATE = "2026-09-12";
const ORG_SOURCE = "海外人資/⭐工作說明書/已定稿/VT廠組織架構與單位主管職位簡表.md";

const departmentMetaByName: Record<string, { purpose: string; duties: string }> = {
  "VT廠": {
    purpose: "承接集團經營及訂單目標，整合廠區生產、支援與行政運作，達成品質、交期、產量、成本及整體營運目標。",
    duties: "R01 承接集團經營與訂單目標，統籌廠區生產、支援與行政運作。\nR02 廠區品質、交期、產量及成本目標管理。\nR03 廠區生產與支援資源管理。\nR04 廠區安全、法規及營運風險管理。\nR05 廠區重大營運異常處理與持續改善。\nR06 廠區相關之內外部協調。",
  },
  行政幕僚: {
    purpose: "整合廠區行政後勤服務、行政資源及相關風險管理，支援廠區日常營運。",
    duties: "R01 行政後勤服務規劃與執行。\nR02 行政資源與費用管理。\nR03 行政作業與風險管理。\nR04 行政異常與重大事項處理。\nR05 行政專案及對外事項辦理。\nR06 行政相關之跨部門協調。",
  },
  現場幕僚: {
    purpose: "整合訂單、物料、產能、生產進度及出貨等支援工作，維持生產支援流程順暢。",
    duties: "R01 生產支援計畫與執行。\nR02 生產支援流程整合。\nR03 生產支援資訊管理。\nR04 生產支援異常處理。\nR05 生產支援流程改善。\nR06 生產支援相關之跨部門協調。",
  },
  面部: {
    purpose: "依核定生產計畫及品質標準完成面部生產，達成交期與產量要求，並持續改善製程及生產效能。",
    duties: "R01 面部生產計畫與執行。\nR02 面部製程與生產進度管理。\nR03 面部生產資源與產能管理。\nR04 面部生產異常處理。\nR05 面部製程及生產效能改善。\nR06 面部生產相關之跨部門協調。",
  },
  底部: {
    purpose: "依核定生產計畫及品質標準完成底部生產，達成交期與產量要求，並持續改善製程及生產效能。",
    duties: "R01 底部生產計畫與執行。\nR02 底部製程與生產進度管理。\nR03 底部生產資源與產能管理。\nR04 底部生產異常處理。\nR05 底部製程及生產效能改善。\nR06 底部生產相關之跨部門協調。",
  },
  業務: {
    purpose: "負責訂單、生產排程、出貨與客戶資訊銜接，確保生產及出貨計畫符合交期要求。",
    duties: "R01 訂單與交期管理。\nR02 生產與出貨計畫管理。\nR03 生產與出貨進度管理。\nR04 交期異常與客戶需求處理。\nR05 客戶及生產資訊管理。\nR06 業務相關之跨部門協調。",
  },
  採購: {
    purpose: "負責量產材料採購與供應管理，使材料依生產需求到位，並維持採購相關流程順暢。",
    duties: "R01 量產材料採購計畫與執行。\nR02 供應商交期與材料供應管理。\nR03 材料供應異常處理。\nR04 採購作業與相關資料管理。\nR05 採購流程改善。\nR06 採購相關之跨部門協調。",
  },
  產效改善: {
    purpose: "整合 IE 與精實改善，提供生產效能分析並推動改善專案，支持生產及資源決策。",
    duties: "R01 生產效能分析與改善規劃。\nR02 IE 及精實改善工作整合。\nR03 生產資源評估與建議。\nR04 改善專案推動與追蹤。\nR05 改善效益確認與成果回報。\nR06 產效改善相關之跨部門協調。",
  },
  環安: {
    purpose: "負責廠區職業安全、消防、環境及客戶驗廠相關工作，降低合規與營運風險。",
    duties: "R01 環安法規與客戶要求管理。\nR02 環安巡檢與風險預防。\nR03 驗廠及外部查核應對。\nR04 環安申訴與異常處理。\nR05 環安改善追蹤。\nR06 環安相關之跨部門協調。",
  },
  IE: {
    purpose: "提供 IE 與精實改善的標準化支援，協助生產效能、資源配置與流程管理。",
    duties: "R01 標準工時與效率管理。\nR02 產能與人力分析。\nR03 生產資源評估。\nR04 IE 資料管理。\nR05 標準差異與生產改善分析。\nR06 IE 相關之跨部門協調。",
  },
  精實改善: {
    purpose: "將內部及客戶改善需求轉為可執行、可驗證的專案，完成推動、效益確認與成果回報。",
    duties: "R01 改善需求與專案管理。\nR02 改善資料與效益分析。\nR03 改善試驗與導入。\nR04 改善專案進度與異常追蹤。\nR05 改善成果確認與回報。\nR06 精實改善相關之跨部門協調。",
  },
};


export type SeedPosition = Omit<PositionRecord, "successors">;

export interface SeedJobDescription {
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
  confirmationStatus: PositionRecord["confirmationStatus"];
  confirmedBy: string;
  confirmedAt: string;
  confirmationNote: string;
  document: JobDocument;
}

function pendingDocument(positionName: string): JobDocument {
  return {
    summary: `${positionName}目前只建立已確認的組織位置與單位最高主管職位，完整工作說明書候補。`,
    managementUnit: "待確認",
    purpose: "🔴 待確認｜尚未提供完整工作說明書。",
    responsibilities: [{ code: "R01", text: "工作說明書候補；尚未提供詳細職責。", annotation: "待確認" }],
    authority: "🔴 待確認｜尚未提供決策與權限資料。",
    performance: [],
    competencies: [],
    requirements: [],
    languages: {
      mandarin: "🔴 待確認｜尚未提供中文／國語要求。",
      vietnamese: "🔴 待確認｜尚未提供越文要求。",
      english: "🔴 待確認｜尚未提供英文要求。",
    },
    successors: [],
    interviewQuestions: ["請後續補充本職位的完整工作說明書。"],
    sources: [ORG_SOURCE],
    annotations: [
      { type: "待確認", content: "目前僅確認組織位置與最高主管職位，完整工作說明書候補。" },
      { type: "待確認", content: "來源未提供編制人數；系統暫以 0 記錄，不代表確認無編制。" },
    ],
  };
}

function pendingPosition(id: string, name: string, department = "", unit = "", grade = "待確認", headcount = 0): SeedPosition {
  const document = pendingDocument(name);
  if (headcount > 0) document.annotations = document.annotations.filter((item) => !item.content.startsWith("來源未提供編制人數"));
  return {
    id, jobDescriptionId: null, name, site: "VT", department, unit, grade, reportsTo: department ? (unit ? `${department}最高主管` : "廠主管") : "待確認",
    status: "待建立", version: "0.1", effectiveDate: "", updatedAt: IMPORT_DATE, confidentiality: "人事機密",
    headcount, confirmationStatus: "待確認", confirmedBy: "", confirmedAt: "", confirmationNote: "",
    document, incumbents: [],
  };
}

function organizationPosition(id: string, name: string, department: string, unit: string, grade: string, reportsTo: string): SeedPosition {
  return { ...pendingPosition(id, name, department, unit, grade), reportsTo };
}

function language(listenSpeak: string, readWrite: string, context: string): string {
  const clean = (value: string) => value.replace(/[。；;]+$/u, "");
  return `聽、說：${clean(listenSpeak)}；讀、寫：${clean(readWrite)}；使用情境：${clean(context)}。`;
}

function finalizedPosition(base: {
  id: string; name: string; department: string; grade: string; version: string; status: string; source: string;
  summary: string; managementUnit: string; purpose: string; responsibilities: Array<[string, string]>; authority: string;
  performance: string[]; competencies: string[]; requirements: string[];
  languages: JobDocument["languages"]; questions: string[]; annotations?: Annotation[];
}): SeedPosition {
  return {
    id: base.id, jobDescriptionId: null, name: base.name, site: "VT", department: base.department, unit: "", grade: base.grade,
    reportsTo: "廠主管", status: base.status, version: base.version, effectiveDate: "", updatedAt: IMPORT_DATE,
    confidentiality: "人事機密", headcount: 1, confirmationStatus: "待確認", confirmedBy: "", confirmedAt: "",
    confirmationNote: "",
    document: {
      summary: base.summary,
      managementUnit: base.managementUnit,
      purpose: base.purpose,
      responsibilities: base.responsibilities.map(([code, text]) => ({ code, text })),
      authority: base.authority,
      performance: base.performance,
      competencies: base.competencies,
      requirements: base.requirements,
      languages: base.languages,
      successors: [],
      interviewQuestions: base.questions,
      sources: [base.source],
      annotations: [
        ...(base.annotations ?? []),
      ],
    },
    incumbents: [],
  };
}

function detailedOrganizationPosition(base: {
  id: string; name: string; department: string; unit: string; grade: string; reportsTo: string;
  status: string; updatedAt: string; source: string; summary: string; managementUnit: string; purpose: string;
  responsibilities: Array<[string, string]>; authority: string; performance: string[]; competencies: string[];
  requirements: string[]; languages: JobDocument["languages"]; questions: string[];
}): SeedPosition {
  const position = organizationPosition(base.id, base.name, base.department, base.unit, base.grade, base.reportsTo);
  return {
    ...position,
    status: base.status,
    version: "1.0",
    updatedAt: base.updatedAt,
    document: {
      summary: base.summary,
      managementUnit: base.managementUnit,
      purpose: base.purpose,
      responsibilities: base.responsibilities.map(([code, text]) => ({ code, text })),
      authority: base.authority,
      performance: base.performance,
      competencies: base.competencies,
      requirements: base.requirements,
      languages: base.languages,
      successors: [],
      interviewQuestions: base.questions,
      sources: [base.source],
      annotations: base.questions.map((content) => ({ type: "待確認" as const, content })),
    },
  };
}

const administrativeManager = finalizedPosition({
  id: "p-admin-staff-manager", name: "行政幕僚經理", department: "行政幕僚", grade: "經理", version: "1.0", status: "訪談後修訂",
  source: "海外人資/⭐工作說明書/已定稿/VT廠行政幕僚經理_工作說明書.md",
  summary: "核心成果：行政服務穩定、費用與風險受控、專案按計畫完成、團隊運作順暢。",
  managementUnit: "行政幕僚部門（秘書、總務、環安、人事）",
  purpose: "統籌廠區行政幕僚工作，確保行政服務穩定、費用合理、風險受控，並就重大行政及跨部門事項提出專業判斷與處理建議。",
  responsibilities: [
    ["R01", "統籌行政幕僚工作，規劃年度目標、預算與資源配置。"],
    ["R02", "督導各行政單位日常運作，維持服務品質。"],
    ["R03", "審核行政費用與重要作業，處理重大異常及風險。"],
    ["R04", "協調廠內外相關單位，推動跨單位行政事項與專案。"],
    ["R05", "督導所屬主管，辦理工作分配、績效考核及人員培育。"],
  ],
  authority: "可自行決定：所屬單位日常分工、例行行政安排及文件完整性要求。需協商／會簽：跨部門事項、行政採購、費用、專案方案及制度例外處理。需向上核定：重大費用、組織與人員異動、制度調整及重大行政異常。",
  performance: [
    "重要行政工作準時完成率。", "重大行政、費用或服務異常件數。", "預算差異及成本改善成果。",
    "行政專案進度、預算及效益達成情形。", "代理、交接及部屬培育完成情形。",
  ],
  competencies: ["M01", "M02", "M03", "M04", "M05", "M06", "P01", "P05"],
  requirements: ["學歷｜大學以上。", "工作年資｜相關工作經驗 10 年以上。", "管理歷練｜曾歷練或管理至少兩項幕僚職能。", "專案歷練｜具跨部門、成本改善或行政專案經驗。"],
  languages: {
    mandarin: language("必要；能完成工作溝通及向上報告。", "必要；能處理主要工作文件。", "會議、行政協調及向上報告。"),
    vietnamese: language("非必要。", "非必要。", "需要時由雙語人員協助。"),
    english: language("非必要。", "非必要。", "客戶接待、跨國溝通或環安驗廠時，由相關人員協作。"),
  },
  questions: ["行政幕僚經理的職務代理人及代理範圍。", "行政幕僚經理的費用、退件、對外代表及重大事項呈報權限。"],
  annotations: [
    { type: "待確認", content: "職務代理人及代理範圍。" },
    { type: "待確認", content: "費用、退件、對外代表及重大事項呈報權限。" },
    { type: "待確認", content: "工作說明書提及人事單位，但已確認組織簡表未列人事；本次未建立人事單位，待後續確認。" },
  ],
});

const factorySupervisor: SeedPosition = {
  ...finalizedPosition({
    id: "p-factory-supervisor", name: "廠主管", department: "", grade: "待確認", version: "1.0",
    status: "訪談後修訂_待主管校準",
    source: "海外人資/⭐工作說明書/已定稿/VT廠主管_工作說明書.md",
    summary: "核心成果：訂單與產能承諾可實現、品質交期與數量達成、成本與經營效益受控、營運風險受控、組織持續承擔經營責任。",
    managementUnit: "VT 廠各營運與支援單位",
    purpose: "承接集團經營與訂單目標，統籌廠區各單位及資源，在確認訂單組合、生產條件與可用產能後，對工廠承諾之品質、交期、數量、成本及整體營運結果負最終責任。",
    responsibilities: [
      ["R01", "統籌廠區整體經營，將集團方向與訂單需求轉化為廠區營運目標及可實現的承諾。"],
      ["R02", "領導各單位達成品質、交期、產量、成本及整體經營效益目標。"],
      ["R03", "依經營需要配置廠區資源，確保營運能力與所承擔的目標相符。"],
      ["R04", "建立廠區安全法遵、重大風險與跨單位責任機制，確保重大異常妥善處理並維持營運持續。"],
      ["R05", "建立廠區管理責任與主管團隊，推動營運改善、人才培育及接班安排。"],
    ],
    authority: "可自行決定：核定目標、預算及授權範圍內的廠區經營安排、資源配置、責任分工及異常處置。需協商／會簽：超出廠區單方權限，或涉及跨廠資源、集團共同標準及對外承諾之事項。需向上核定：新廠設置、重大投資或營運模式變更，超出核定預算、產能或授權的重大承諾，重大組織與關鍵人事決策，以及可能影響集團營運、法遵或聲譽的重大事項。",
    performance: [
      "在訂單組合及生產條件明確後，廠區承諾訂單量與品質、交期及數量的達成情形。",
      "工廠成本、生產力、資源運用及整體經營效益達成情形。",
      "重大品質、停線、缺料、交期、客戶及跨單位異常的預警、決策與處理結果。",
      "工安、法規、勞資及營運持續風險的預防、查核與改善情形。",
      "各模塊主管成果、跨單位改善、代理安排及接班人才培育進展。",
    ],
    competencies: ["M01", "M02", "M03", "M04", "M05", "M06", "M07"],
    requirements: [
      "學歷｜大學以上。",
      "工作年資｜具鞋廠相關經驗 20 年以上。",
      "管理歷練｜具大型製造現場及多職能單位統籌經驗，曾對訂單交付、成本與重大營運結果負責。",
      "專業歷練｜熟悉接單至出貨、生產、生產支援及行政後勤的主要運作，具重大異常決策與跨單位推動經驗。",
    ],
    languages: {
      mandarin: language("必要；能主持經營溝通及完成重大事項報告。", "必要；能審閱主要營運資料及正式文件。", "經營會議、向上呈報及跨單位決策。"),
      vietnamese: language("非必要。", "非必要。", "需要時由雙語人員協助。"),
      english: language("若直接對接客戶須能完成工作溝通。", "若直接處理客戶資料須能掌握重點。", "客戶會議、重大品質或交期說明。"),
    },
    questions: [
      "廠主管適用的正式職級，以及本職位是否為 VT 特有版本或集團海外鞋廠共用基準。",
      "直接主管、正式授權來源，以及與總業務、IE、財務、開發及其他總部專業單位的決策、會簽與結果責任界線。",
      "現行四大模塊、其他直接隸屬單位及各單位最高主管職位；自動化及其他未納入四大模塊職能的正式歸屬。",
      "前段提供訂單組合與產品難度、IE 評估產能、工廠提出交付承諾及上級核定配單的正式流程；不得在資訊不足時只以單一雙數承諾產能。",
      "廠主管對重大經營承諾、資源配置與異常處置的授權範圍，以及新廠設置、重大投資與營運模式變更的向上核定程序。",
      "品質、交期、數量、成本、利潤、生產力、安全、法規及人才等指標的定義、資料來源、目標值、權重與共同承擔方式。",
    ],
    annotations: [
      { type: "待確認", content: "廠主管適用的正式職級，以及本職位是否為 VT 特有版本或集團海外鞋廠共用基準。" },
      { type: "待確認", content: "直接主管、正式授權來源，以及與總業務、IE、財務、開發及其他總部專業單位的決策、會簽與結果責任界線。" },
      { type: "待確認", content: "現行四大模塊、其他直接隸屬單位及各單位最高主管職位；自動化及其他未納入四大模塊職能的正式歸屬。" },
      { type: "待確認", content: "前段提供訂單組合與產品難度、IE 評估產能、工廠提出交付承諾及上級核定配單的正式流程；不得在資訊不足時只以單一雙數承諾產能。" },
      { type: "待確認", content: "廠主管對重大經營承諾、資源配置與異常處置的授權範圍，以及新廠設置、重大投資與營運模式變更的向上核定程序。" },
      { type: "待確認", content: "品質、交期、數量、成本、利潤、生產力、安全、法規及人才等指標的定義、資料來源、目標值、權重與共同承擔方式。" },
    ],
  }),
  reportsTo: "鞋廠總經理",
  updatedAt: "2026-09-14",
};

const sharedProduction = {
  responsibilities: (area: "面部" | "底部") => [
    ["R01", `統籌所轄${area}生產，確保品質、交期及產量達成。`],
    ["R02", "規劃與調度人力、設備、材料及產能，維持生產順暢。"],
    ["R03", "掌握生產進度與製程狀況，處理重大異常並推動改善。"],
    ["R04", "協調現場幕僚部門及其他支援單位，排除生產問題。"],
    ["R05", "督導所屬主管及現場人員管理，辦理工作分配、績效考核及人員培育。"],
  ] as Array<[string, string]>,
  authority: "可自行決定：核定計畫內的工作安排、型體配置、資源調度、異常處置及主管分工。需協商／會簽：跨單位的生產計畫、材料、品質、資源調度及客戶或員工事項。需向上核定：重大計畫變更、停線或追產、人員異動、績效薪酬及重大品質、交期、客戶或勞資風險。",
  performance: (area: "面部" | "底部") => [
    `所轄${area}製程品質、重大異常及改善完成情形。`, "所轄現場的進度、交期與產量達成情形。",
    "缺料、換型、等待、停線及資源調度的處理結果。", "人力、機器與產能配置及生產效率改善情形。",
    "主管代理、人才培育、本土化及人才梯隊進展。",
  ],
  languages: {
    mandarin: language("必要；能完成工作溝通及異常報告。", "必要；能處理主要工作文件。", "管理會議、報表及跨單位協調。"),
    vietnamese: language("非必要。", "非必要。", "需要時由雙語人員協助。"),
    english: language("非必要。", "非必要。", "客戶或英文資料由相關單位協作。"),
  },
  questions: (area: "面部" | "底部", title: string) => [
    `${title}在各廠組織中的直接主管、所轄單位與下一層主管配置原則。`,
    `${title}對訂單與型體分配、跨單位人力／機器調度、缺料處置、停復線及重大工序異常的正式授權範圍。`,
    "與現場幕僚部門及其他支援單位在材料、客戶、品質、員工申訴與合規事項上的主責及升級界線。",
    "月考核的評分對象、證據、校準與核決流程，以及年度績效與薪酬建議權限。",
    "核心成果與績效衡量的資料來源、計算方式、目標值及不同廠區／產品條件的調整原則。",
    `最低學歷及鞋業、${area}製程與管理年資要求；是否以必要歷練及成果證據取代固定年資門檻。`,
    "日常代理人、重大事項代理人及職位空缺期間的決策安排。",
  ],
};

const upperDeputyDocument: JobDocument = {
  summary: "VT1、VT2、VT3、VT5 面部副理共用的職位基準；各廠區的編制、現任者、產線與管理幅度由組織資料分開維護。",
  managementUnit: "所轄廠區面部生產",
  purpose: "依核定生產計畫統籌所轄廠區的面部工藝與現場管理，維持製程品質、生產進度及產量達成，處理現場異常並帶領所屬主管。",
  responsibilities: [
    { code: "R01", text: "承接面部生產目標與計畫，安排所轄現場的工作重點及分工。" },
    { code: "R02", text: "配置所轄現場的人力、設備、材料與產能，維持生產順暢。" },
    { code: "R03", text: "掌握生產進度、工藝與品質狀況，確保交期、產量及品質要求達成。" },
    { code: "R04", text: "處理現場生產異常，協調相關支援單位並依風險及時向上呈報。" },
    { code: "R05", text: "督導所屬主管與現場人員，辦理工作分配、績效管理、代理安排及人員培育。" },
    { code: "R06", text: "推動面部製程與生產效能改善，追蹤改善結果。" },
  ],
  authority: "可自行決定：核定計畫與授權範圍內的現場分工、人力及設備安排、例行進度調整與一般異常處置。需協商／會簽：涉及材料、品質、生產計畫、跨單位資源與製程改善的事項。需向上核定：重大計畫變更、停線或追產、跨廠資源調度、人員異動，以及可能影響重大品質、交期、客戶或勞資風險的處理方案。",
  performance: [
    "所轄面部製程品質與品質異常改善情形。",
    "所轄現場的生產進度、交期與產量達成情形。",
    "缺料、換型、等待、停線及其他生產異常的處理結果。",
    "人力、設備與產能配置及生產效能改善情形。",
    "所屬主管的代理安排、人員培育及獨立承擔進展。",
  ],
  competencies: ["M01", "M02", "M03", "M04", "M05", "M06", "M07", "P02"],
  requirements: [
    "學歷｜🔴 待確認｜最低學歷及科系要求。",
    "工作年資｜🔴 待確認｜最低相關工作年資。",
    "管理歷練｜具單一廠區面部現場管理、工作分配及人員帶領經驗。",
    "專業歷練｜熟悉面部主要工序、材料、設備、品質標準與量產銜接，具生產異常處理經驗。",
  ],
  languages: {
    mandarin: language("待確認；須依實際管理與回報方式校準。", "待確認；須依主要工作文件校準。", "現場管理、報表、會議及向上呈報。"),
    vietnamese: language("待確認；須依現場人員溝通需求校準。", "待確認；須依現場文件需求校準。", "現場管理、人員溝通及異常確認。"),
    english: language("非必要。", "非必要。", "客戶或英文資料由相關單位協作。"),
  },
  successors: [],
  interviewQuestions: [
    "正式直接主管、所轄製程、下一層主管配置與各層責任界線。",
    "對排產調整、人力與設備安排、缺料、停復線及重大工藝或品質異常的正式授權範圍。",
    "與現場面部副協理、現場幕僚及其他支援單位在材料、品質、交期與人員事項上的主責及升級界線。",
    "核心成果與績效衡量的資料來源、計算方式、目標值及不同廠區條件的調整原則。",
    "最低學歷、年資、必要管理與專業歷練，以及中文／國語、越文的實際要求。",
    "日常代理人、重大事項代理人及職位空缺期間的決策安排。",
  ],
  sources: [
    "海外人資/⭐工作說明書/未定稿/面部副理_工作說明書.md",
    "海外人資/⭐工作說明書/職位與職務定義彙整.md",
  ],
  annotations: [
    { type: "待訪談", content: "本文件依現場面部副協理訪談及共用職位基準建立，尚未完成四個廠區面部副理本人訪談。" },
    { type: "待確認", content: "直接主管、所轄製程、下一層主管配置、正式授權、績效標準、任職條件、語言要求及代理安排。" },
  ],
};

const upperDeputyJobDescription: SeedJobDescription = {
  id: "jd-upper-deputy",
  code: "JD-VT-012",
  title: "面部副理",
  site: "VT",
  department: "面部",
  grade: "副理",
  reportsTo: "現場面部副協理",
  status: "訪談前初稿",
  version: "0.1",
  effectiveDate: "",
  updatedAt: "2026-09-14",
  confidentiality: "人事機密",
  confirmationStatus: "待確認",
  confirmedBy: "",
  confirmedAt: "",
  confirmationNote: "四個面部副理節點共用同一份工作說明書；內容待本人訪談及主管校準。",
  document: upperDeputyDocument,
};

function sharedUpperDeputyPosition(id: string, unit: string): SeedPosition {
  return {
    ...organizationPosition(id, "面部副理", "面部", unit, "副理", "現場面部副協理"),
    jobDescriptionId: "jd-upper-deputy",
    status: "訪談前初稿",
    version: "0.1",
    updatedAt: "2026-09-14",
    document: upperDeputyDocument,
  };
}

function productionManager(area: "面部" | "底部", code: "P02" | "P03", fileName: string): SeedPosition {
  const title = area === "面部" ? "現場面部副協理" : "現場底部經理";
  return finalizedPosition({
    id: area === "面部" ? "p-upper-manager" : "p-bottom-manager", name: title, department: area, grade: area === "面部" ? "副協理" : "經理",
    version: "1.0", status: "訪談後修訂_待主管校準", source: `海外人資/⭐工作說明書/已定稿/${fileName}`,
    summary: `來源為集團海外鞋廠共用基準，本次依 VT 已確認組織匯入；核心成果涵蓋${area}製程與品質、生產進度、資源配置、重大異常及主管梯隊。`,
    managementUnit: `所轄${area}生產`,
    purpose: `統籌所轄${area}生產與資源配置，維持所轄製程品質、交期及產量達成，處理重大異常，並建立可持續的現場主管梯隊。`,
    responsibilities: sharedProduction.responsibilities(area), authority: sharedProduction.authority,
    performance: sharedProduction.performance(area), competencies: ["M01", "M02", "M03", "M04", "M05", "M06", "M07", code],
    requirements: [
      "學歷｜無特別要求。", "工作年資｜相關工作經驗 10 年以上，須有足以支持獨立承擔本職位的製鞋與現場管理經驗。",
      `管理歷練｜具${area}工藝與現場管理經驗，能統籌多條產線並帶領現場主管。`,
      `專業歷練｜熟悉${area === "面部" ? "面部主要工序、型體難度、材料、設備、品質及量產銜接" : "成型、組底及相關底部工序、材料、設備、品質與量產銜接"}，具${area === "底部" ? "新型體試作及" : ""}重大生產異常處理經驗。`,
    ],
    languages: sharedProduction.languages, questions: sharedProduction.questions(area, title),
    annotations: sharedProduction.questions(area, title).map((content) => ({ type: "待確認", content })),
  });
}

const fieldStaffAssociate = finalizedPosition({
  id: "p-field-staff-manager", name: "現場幕僚副協理", department: "現場幕僚", grade: "副協理",
  version: "1.0", status: "訪談後修訂_待主管校準",
  source: "海外人資/⭐工作說明書/已定稿/VT廠現場幕僚副協理_工作說明書.md",
  summary: "核心成果：生產支援銜接順暢、材料與交期風險受控、資料與流程持續改善、重大異常公開透明、團隊能獨立運作。",
  managementUnit: "業務、採購、品管、資材、產效改善、倉儲、生管",
  purpose: "統籌與生產現場直接相關的幕僚及支援工作，整合訂單、物料、產能、進度與出貨資訊，及早排除異常並提出可執行方案，使各支援單位共同對廠區品質、交期、產量及效率負責。",
  responsibilities: [
    ["R01", "統籌現場幕僚工作，規劃年度目標、資源配置與責任分工。"],
    ["R02", "督導各專業單位運作，確保生產支援成果符合廠區品質、交期、產量及效率要求。"],
    ["R03", "審核重大異常與風險，作成處理判斷、及時呈報並追蹤結果。"],
    ["R04", "協調生產單位及其他支援單位，推動跨單位問題解決與流程改善。"],
    ["R05", "督導所屬主管，辦理工作分配、績效管理、授權代理及人員培育。"],
  ],
  authority: "可自行決定：核定目標內的單位分工、工作優先順序、資料與進度要求、例行資源安排及異常追蹤方式。需協商／會簽：跨單位排產與材料應變、IE 標準與人力配置、流程改善，以及涉及品質、客戶、法規或誠信之案件調查與處理方案。需向上核定：重大交期承諾、停工或追產、組織與人員異動、重大費用，以及重大違規、舞弊、客戶或營運風險的處分、對外說明與公告。",
  performance: [
    "訂單、物料、產能、生產進度與出貨計畫的銜接及達成情形。",
    "缺料、延誤、停工及重大生產支援異常的預警與處理結果。",
    "跨單位資料差異、重複作業及流程改善成果。",
    "重大風險、具名申訴與誠信案件的呈報時效、紀錄完整性及處理完成情形。",
    "所轄主管的專業成果、代理安排及人員培育進展。",
  ],
  competencies: ["M01", "M02", "M03", "M04", "M05", "M06", "M07", "P04"],
  requirements: [
    "學歷｜🔴 待確認｜最低學歷及科系要求。",
    "工作年資｜具鞋廠或製造業生產支援相關經驗；最低年資待確認。",
    "管理歷練｜具跨生產支援功能管理、重大異常處理及跨單位推動經驗。",
    "專業歷練｜熟悉從接單、採購與物料、產能與 IE、生產計畫至出貨的主要流程及相互影響。",
  ],
  languages: {
    mandarin: language("必要；能完成工作溝通及重大異常報告。", "必要；能處理主要報表及管理文件。", "管理會議、跨單位協調及向上呈報。"),
    vietnamese: language("非必要。", "非必要。", "需要時由雙語人員協助。"),
    english: language("待確認；若直接對接客戶須能完成工作溝通。", "待確認；若直接處理客戶資料須能掌握重點。", "客戶會議、Lean 專案或英文資料。"),
  },
  questions: [
    "現場幕僚副協理正式職稱，以及本職位屬 VT 特有組織設計或可作為集團海外鞋廠共用基準。",
    "業務、採購、品管、資材、IE＋Lean、倉儲及生管的正式單位名稱與組織生效文件。",
    "與廠主管、現場面部副協理及現場底部經理在接單、排產、材料、品質、交期與出貨上的主責及最終核決界線。",
    "對排產調整、供應商升級、IE 標準、人力配置、停工／追產、索賠及客戶交期承諾的正式授權範圍。",
    "具名申訴及涉及作弊、舞弊或其他誠信風險案件的受理、調查、呈報、處分、公告及紀錄保存分工。",
    "核心成果與績效衡量的資料來源、計算方式、目標值及與生產單位共同承擔的指標。",
    "學歷、最低年資、必要管理歷練，以及英文是否為本職位必要條件。",
    "日常代理人、重大事項代理人及職位空缺期間的決策安排。",
    "建議將現場幕僚副協理設定為廠主管代理的培養節點；代理順位、啟動條件、授權清單、補充歷練與回報界線待確認。",
  ],
  annotations: [
    { type: "待確認", content: "日常代理人、重大事項代理人及各自代理範圍。" },
    { type: "待確認", content: "最低學歷、科系、最低年資及英文必要程度。" },
    { type: "建議新增", content: "將現場幕僚副協理設定為廠主管代理的培養節點；代理順位、啟動條件、授權清單、補充歷練與回報界線待確認。" },
  ],
});

const purchasingDeputy = detailedOrganizationPosition({
  id: "p-purchasing-director", name: "採購副理", department: "現場幕僚", unit: "採購", grade: "副理", reportsTo: "現場幕僚副協理",
  status: "訪談後修訂_待主管校準", updatedAt: "2026-09-13",
  source: "海外人資/⭐工作說明書/已定稿/VT廠採購副理_工作說明書.md",
  summary: "核心成果：材料供應支持生產、供應異常受控、採購作業銜接順暢、採購資源合理運用、團隊能獨立運作。",
  managementUnit: "底料採購、面料採購",
  purpose: "建立採購及供應進度的管理標準，並覆核所屬單位的採購進度與供應資訊。發現可能影響材料到位或生產計畫的警訊與異常時，及時通知相關單位，並協調所屬單位調整採購及到料安排。",
  responsibilities: [
    ["R01", "統籌採購工作，設定單位目標、工作分工及優先順序。"],
    ["R02", "督導採購單、供應商交期與到料進度，確保材料供應符合生產計畫。"],
    ["R03", "判斷重大供應與來料異常對材料供應及生產計畫的影響，協調相關單位完成應變、升級及結果追蹤。"],
    ["R04", "督導採購、收貨、檢驗、驗收、帳單及付款作業的銜接，確保材料與相關資料正確完成交接。"],
    ["R05", "管理所屬主管與人員，辦理工作分配、進度覆核、授權代理及能力培育。"],
  ],
  authority: "可自行決定：核定目標內的採購分工、工作優先順序、進度追蹤、例行人力支援，以及既有授權內的供應異常初步處理。需協商／會簽：材料交期壓縮、排產與趕工配合、來料品質與驗收差異、付款資料，以及跨單位供應改善方案。需向上核定：供應商選擇與重大變更、價格與議價結果、替代材料、索賠、重大費用，以及可能影響停線、出貨或客戶承諾的處理方案。",
  performance: [
    "材料準時到位及對生產、停線與出貨的影響情形。", "供應商交期、數量與品質異常的預警、升級及處理結果。",
    "採購單、驗收、帳單及付款資料的正確與銜接情形。", "採購工作負荷、跨組支援及人力運用情形。",
    "所屬主管與人員的代理、異常獨立處理及能力培育進展。",
  ],
  competencies: ["M01", "M02", "M03", "M04", "M05", "M06", "M07", "P09"],
  requirements: [
    "學歷｜大學以上。", "工作年資｜相關工作經驗 5 年以上。",
    "管理歷練｜具採購團隊管理、工作調配、進度覆核及重大供應異常處理經驗。",
    "專業歷練｜熟悉量產採購、供應商交期、材料到貨與驗收、帳單付款及生產支援流程。",
  ],
  languages: {
    mandarin: language("必要；能完成管理溝通及重大異常報告。", "必要；能處理主要採購與管理文件。", "管理會議、跨單位協調及向上呈報。"),
    vietnamese: language("非必要。", "非必要。", "需要時由雙語人員協助。"),
    english: language("非必要。", "非必要。", "需要時由雙語人員協助。"),
  },
  questions: [
    "正式直接主管職稱，以及本職位是否屬 VT 特有組織設計或可作為集團海外鞋廠共用基準。",
    "底料採購、面料採購的正式名稱、編制、主任管理範圍及工作部署。",
    "與前段開發／議價、廠業務、現場、生管、資材、檢驗、倉儲及財務在採購、到料、驗收及付款上的責任界線。",
    "對供應商選擇、比價、議價、價格、替代材料、索賠、交期應變及重大費用的正式授權範圍。",
    "材料供應與異常處理的資料來源、計算方式、預警門檻及績效目標值。",
    "學歷、最低年資與必要管理歷練，以及中文／國語、越文、英文的實際要求。",
    "日常代理人、重大供應異常代理人及職位空缺期間的決策安排。",
  ],
});

const businessDeputy = detailedOrganizationPosition({
  id: "p-business-director", name: "業務副理", department: "現場幕僚", unit: "業務", grade: "副理", reportsTo: "現場幕僚副協理",
  status: "訪談後修訂_待主管校準", updatedAt: "2026-09-13",
  source: "海外人資/⭐工作說明書/已定稿/VT廠業務副理_工作說明書.md",
  summary: "核心成果：訂單與產能合理銜接、生產進度支持準時出貨、重大異常及早處理、客戶資訊正確及時、團隊能分層運作。",
  managementUnit: "業務",
  purpose: "依訂單需求建立生產與出貨計畫的編製標準，並覆核所屬單位編製的計畫與對外提供的資訊。發現可能影響交期的警訊或異常時，及時通知相關單位，必要時通知客戶，並協調所屬單位調整計畫。",
  responsibilities: [
    ["R01", "統籌業務工作，設定單位目標、工作分工及優先順序。"],
    ["R02", "建立排程標準並覆核業務單位制定的生產與出貨計畫，掌握執行偏差，協調調整並追蹤結果。"],
    ["R03", "判斷重大異常對生產與出貨計畫的影響，協調相關單位完成應變、升級及結果追蹤。"],
    ["R04", "督導訂單、排程、出貨及客戶資訊的銜接，確保進度與異常依權責正確回報。"],
    ["R05", "管理所屬主管與人員，辦理工作分配、進度覆核、授權代理及能力培育。"],
  ],
  authority: "可自行決定：核定目標內的業務分工、工作優先順序、排程標準、進度覆核、例行調整及異常追蹤方式。需協商／會簽：跨單位排產與物料應變、交期調整、包裝與模具採購、外包需求，以及涉及費用或索賠的處理方案。需向上核定：重大客戶交期承諾、停工或廠休、加班或追產、外包、重大費用，以及可能影響出貨、客戶或廠區營運的處理方案。",
  performance: [
    "生產與出貨計畫依既定標準完成編製、覆核及更新。", "影響排程之偏差、缺料及重大生產異常的預警、通知、計畫調整與升級時效。",
    "生產與出貨資訊對前段業務及客戶回報的時效與正確性。", "排程標準、文件覆核及跨單位流程的持續改善情形。",
    "所屬主管與人員的代理、獨立處理異常及能力移轉進展。",
  ],
  competencies: ["M01", "M03", "M04", "M05", "M06", "M07", "P10"],
  requirements: [
    "學歷｜大學以上。", "工作年資｜相關工作經驗 5 年以上。", "管理歷練｜具業務團隊管理、排程覆核、重大交期異常及跨單位協調經驗。",
    "專業歷練｜熟悉訂單、產能、物料、生產排程、進度追蹤、出貨及客戶溝通流程；具採購、生管歷練者優先。",
  ],
  languages: {
    mandarin: language("必要；能完成管理溝通及重大異常報告。", "必要；能處理主要進度與管理文件。", "管理會議、跨單位協調及向上呈報。"),
    vietnamese: language("非必要。", "非必要。", "需要時由雙語人員協助。"),
    english: language("必要；能參與客戶會議並說明生產與交期異常。", "必要；能閱讀及回覆客戶郵件與出貨資料。", "客戶會議、交期協調及異常回報。"),
  },
  questions: [
    "本職位屬 VT 特有組織設計或可作為集團海外鞋廠共用基準，以及正式直接主管職稱。", "兩名業務主管的正式職稱、分工、管理編制及日常／重大事項代理範圍。",
    "與前段業務、行政生管、現場生管、採購及生產主管在接單、排程、物料、交期與出貨上的主責及最終核決界線。",
    "對排程調整、客戶交期承諾、停工／廠休、加班／追產、外包及索賠的正式授權範圍。",
    "內盒、外箱及面部模具採購是否為業務正式職責，以及供應商、價格、費用與驗收的分工。",
    "核心成果與績效衡量的資料來源、計算方式、預警門檻、目標值及共同承擔指標。",
    "學歷、最低年資、必要輪調／專業歷練，以及中文／國語、越文、英文的實際要求。", "日常代理人、重大異常代理人及職位空缺期間的完整決策安排。",
  ],
});

const productivityImprovementDeputy = detailedOrganizationPosition({
  id: "p-productivity-improvement-deputy", name: "產效改善副理", department: "現場幕僚", unit: "產效改善", grade: "副理", reportsTo: "現場幕僚副協理",
  status: "訪談後修訂", updatedAt: "2026-09-14", source: "海外人資/⭐工作說明書/已定稿/VT廠產效改善副理_工作說明書.md",
  summary: "核心成果：標準與人力分析合理、改善專案成果可確認、團隊可分層運作。", managementUnit: "IE、精實改善",
  purpose: "統籌 IE 與精實改善，覆核錨值、產線人力及外包需求分析，提供相關單位決策依據，並協調改善專案的試驗、效益確認及成果回報。",
  responsibilities: [
    ["R01", "統籌 IE 與精實改善的目標、分工及優先順序。"], ["R02", "覆核錨值、產線人力及外包需求分析，確認依據並提出建議。"],
    ["R03", "統籌改善專案，協調相關單位完成試驗、效益確認及成果回報。"], ["R04", "管理所屬主管與人員，辦理工作覆核、代理及能力培育。"],
  ],
  authority: "🔴 待確認｜以下為目標職位的授權分層草案，須依正式簽核權限校準。可自行決定：核定目標與授權內的單位分工、優先順序、資料覆核及分析差異查核安排。需協商／會簽：錨值與實際作業差異、產線人力及針車外包需求評估，以及改善試驗、效益確認與客戶回覆內容。需向上核定：錨值調整及涉及獎金、人力、夜班、設備投資、外包或客戶承諾的建議，依正式流程呈權責主管核定；外包由業務提出申請。",
  performance: ["錨值、產線人力及外包需求分析的資料正確性、現場依據與覆核時效。", "錨值與實際作業不符、產能高估或低估等分析差異的查核、說明及修正情形。", "改善專案的進度、試驗與效益確認結果，以及成果回報品質。", "所屬團隊的工作覆核、代理及能力培育進展。"],
  competencies: ["M01", "M03", "M04", "M06", "M07", "P11", "P12"],
  requirements: ["學歷｜大學以上。", "工作年資｜相關工作經驗 5 年以上。", "管理歷練｜具 IE 與精實改善整合、跨單位推動及人員管理經驗。", "專業歷練｜熟悉標準工時、效率、產能、人力、設備、改善專案與現場生產條件的相互影響。"],
  languages: {
    mandarin: language("必要；能完成管理溝通及分析結果說明。", "必要；能處理主要分析及管理文件。", "管理會議、跨單位協調及向上呈報。"),
    vietnamese: language("非必要。", "非必要。", "需要時由雙語人員協助。"),
    english: language("必要；能參與客戶改善會議。", "必要；能閱讀及回覆客戶改善需求與資料。", "客戶改善專案、設備評估及成果回報。"),
  },
  questions: [
    "本版依 VT 將 IE 與精實改善合併管理的責任設計撰寫；實際編制、交接生效日及跨廠可共用範圍。", "副理與 IE／精實改善主任的資料簽出、例行回覆與分析建議覆核界線，避免所有日常資料均重複呈副理。",
    "與業務、生產、設備、技術及前段 IE 的專業責任；外包由業務申請，IE 提供評估，不由本職位取代業務申請或上級核准。",
    "錨值、獎金、人力、夜班、設備、外包及客戶承諾的正式授權與提報流程；對客效益資料涉及報價時的覆核安排。",
    "學歷、年資及管理／專業歷練門檻；語言要求依工作情境暫擬，中文讀寫、越文支援及英文參會／文件程度須逐項校準。", "績效資料、計算口徑、改善效益歸屬及代理人／代理範圍。",
  ],
});

const ehsDirector = detailedOrganizationPosition({
  id: "p-ehs-director", name: "環安主任", department: "行政幕僚", unit: "環安", grade: "主任", reportsTo: "行政幕僚經理",
  status: "訪談後修訂", updatedAt: "2026-09-14", source: "海外人資/⭐工作說明書/已定稿/VT廠環安主任_工作說明書.md",
  summary: "核心成果：環安日常風險受控、驗廠與法規要求可因應、改善事項有效結案、重大事項妥善升級、團隊工作穩定。", managementUnit: "環安",
  purpose: "督導廠區環安日常運作、法規與客戶驗廠應對，管理異常調查與改善追蹤，使工作環境、相關文件及改善行動符合適用要求並降低營運風險。",
  responsibilities: [
    ["R01", "覆核環安適用法規與客戶要求，向主管說明依據、風險及需改善事項。"], ["R02", "督導日常巡檢、員工意見蒐集及例行報告，掌握工作環境異常。"],
    ["R03", "統籌驗廠資料與現場準備，完成查核配合及英文改善報告。"], ["R04", "管理環安受理的申訴與重大異常，呈報主管並依核定分工辦理調查與追蹤。"],
    ["R05", "推動查核、5S及作業環境改善，協調責任單位提出改善方案並追蹤處理結果。"], ["R06", "管理環安人員，辦理工作分配、文件覆核、代理及專業培育。"],
  ],
  authority: "可自行決定：既定要求內的巡檢、文件檢核、部門分工及例行改善追蹤安排。需協商／會簽：查核資料取得、現場改善、薪資或制度改善方案試算，以及申訴調查分工與報告內容。需向上核定：重大安全與合規異常、申訴調查及處分、薪資或制度變更、重大費用與對外承諾，經行政幕僚經理呈權責主管處理。",
  performance: ["日常巡檢、申訴、資料及例行報告的完成與覆核情形。", "驗廠資料整備、查核結果、改善時效及改善有效性。", "重大環安或合規異常的呈報時效、紀錄完整性及處理結果。", "跨單位改善的主責、方案與結案追蹤情形。", "環安人員的分工、代理及專業能力培育進展。"],
  competencies: ["M03", "M04", "M05", "M06", "M07", "P13"],
  requirements: ["學歷｜大學畢業。", "工作年資｜相關工作經驗 3 年以上。", "管理歷練｜具環安人員管理、跨單位協調及完整驗廠流程經驗。", "專業歷練｜熟悉職安、消防、環境、勞動及客戶驗廠的資料整備、查核與改善追蹤。"],
  languages: {
    mandarin: language("必要；能完成向上呈報及管理溝通。", "必要；能處理主要環安與管理文件。", "管理會議、重大異常及跨單位協調。"),
    vietnamese: language("必要；能完成現場查核與工作溝通。", "必要；能閱讀當地法規與相管函文。", "巡檢、當地驗廠與部屬協作。"),
    english: language("非必要；年度會議報告由主管協助。", "必要；能閱讀要求並撰寫改善報告。", "客戶驗廠改善；年度會議代表另確認。"),
  },
  questions: [
    "環安歸行政幕僚經理管理依 Ivy 指定；實際交接、編制、部屬職稱、法定責任人及外部專業支援仍待確認。", "環安、總務、人事及財務在消防、環境、職安、勞動與查核資料上的責任；不得因總務人員熟悉法規即認定其管轄環安。",
    "具名申訴的受理、呈報、調查授權、處分與資料保存分工，以及重大危害的即時處置與停工通報權限。", "法規與客戶要求的版本查核、專業覆核及更新方式；本文件未設定工時上限、法定資格或津貼標準。",
    "年度客戶環安會議是否由行政幕僚經理代表出席；主任英文以讀寫為明確需求，聽說及中文／越文程度須依分工校準。", "學歷、年資、必要專業資格與歷練、績效及代理安排。",
  ],
});

const ieDirector = detailedOrganizationPosition({
  id: "p-ie-director", name: "IE主任", department: "現場幕僚", unit: "IE", grade: "主任", reportsTo: "產效改善副理",
  status: "訪談後修訂", updatedAt: "2026-09-14", source: "海外人資/⭐工作說明書/已定稿/VT廠IE主任_工作說明書.md",
  summary: "核心成果：IE 標準具可用性、產能與人力分析合理、IE 資料正確及時、標準異常及早處理、團隊工作可承接。", managementUnit: "IE",
  purpose: "管理 IE 標準工時、效率、產能、人力與設備分析，提出具現場可行性的標準及資源建議，支持生產計畫、改善及用人效率判斷。",
  responsibilities: [
    ["R01", "督導工時、錨值及效率測量，提出附現場依據與影響試算的標準調整建議。"], ["R02", "依生產形體評估產能、人力、設備、夜班及外包需求，說明瓶頸與可行方案。"],
    ["R03", "管理技術力考試安排與結果登記，以及毒害繁重津貼的機台與人力配置資料。"], ["R04", "覆核 IE 報表及送出資料，完成前段 IE 的工時與產能資料銜接。"],
    ["R05", "配合工序標準化、換線效率及設備試驗，驗證現場差異並追蹤改善結果。"], ["R06", "管理 IE 人員，辦理工作分配、專業覆核、代理及能力培育。"],
  ],
  authority: "可自行決定：既定計畫內的 IE 分工、測量與複測安排、資料檢核及例行分析。需協商／會簽：與現場核對標準可達成條件，與業務及前段 IE 比對產能／外包資料，並協調考試、津貼與改善試驗資料。需向上核定：標準與錨值變更、人力／夜班、設備與外包建議及影響獎金津貼的事項，先呈產效改善副理覆核，再依正式權限核定。",
  performance: ["標準工時、錨值、效率及現場測量資料的合理性、覆核與更新時效。", "產能、人力、設備、夜班及外包分析對生產決策的支持情形。", "IE 對內外資料、技術力考試及津貼資料的正確性與完成時效。", "效率、標準及資源異常的分析、升級、改善與追蹤結果。", "IE 人員的資料判讀、代理及專業能力培育進展。"],
  competencies: ["M03", "M04", "M05", "M06", "M07", "P11"],
  requirements: ["學歷｜大學畢業。", "工作年資｜相關工作經驗 3 年以上。", "管理歷練｜具 IE 資料覆核、人員帶領及跨單位溝通經驗。", "專業歷練｜熟悉標準工時、效率、產能、人力、設備、外包及現場測量。"],
  languages: {
    mandarin: language("必要；能完成管理溝通及標準調整說明。", "必要；能處理主要分析與管理文件。", "管理會議、標準調整及向上呈報。"),
    vietnamese: language("必要；能完成現場測量與人員溝通。", "必要；能處理 IE 日常資料。", "現場測量、資料確認及人員帶領。"),
    english: language("非必要。", "非必要。", "前段 IE 或客戶專案資料。"),
  },
  questions: [
    "直接主管依 Ivy 指定為產效改善副理；IE 實際負責人的職稱、編制、部屬及代理仍待訪談核對。", "IE 主任與副理的資料簽出層級、前段 IE 報表名稱，以及工時／錨值的測量與調整規則。",
    "IE 提供外包評估、業務提出申請的正式流程，以及人力、夜班、設備與外包的最終核決權。", "技術力考試的評分與加給核定、毒害繁重津貼資格與發放標準；本職位管理資料，不據此取得薪酬制度或法定資格決定權。",
    "學歷、年資與必要歷練；中文與越文要求暫依工作情境擬定，應確認實際聽說讀寫及可支援範圍，英文需求亦待核對。", "成果與績效指標、標準異常升級條件及代理範圍。",
  ],
});

const leanDirector = detailedOrganizationPosition({
  id: "p-lean-section-chief", name: "精實改善主任", department: "現場幕僚", unit: "精實改善", grade: "主任", reportsTo: "產效改善副理",
  status: "訪談後修訂", updatedAt: "2026-09-14", source: "海外人資/⭐工作說明書/已定稿/VT廠精實改善主任_工作說明書.md",
  summary: "核心成果：改善需求可管理、專案依計畫推進、改善效益可驗證、客戶溝通適當、團隊能獨立承接。", managementUnit: "精實改善",
  purpose: "承接客戶及廠內改善需求，管理效益資料、試驗導入、跨單位追蹤與成果回報，推動可驗證的改善行動，支持品質、交期、產量、成本及作業環境改善。",
  responsibilities: [
    ["R01", "整理客戶及廠內改善需求，提出工作範圍、主責與時程供確認。"], ["R02", "分析 MLT,PPH,Downtime,FTT等資料，提出改善或試驗所需依據。"],
    ["R03", "協調跨完成設備與流程試驗，追蹤導入進度及效益驗證。"], ["R04", "覆核客戶改善報告與準備會議資料，回報進度並將重大障礙呈產效改善副理處理。"],
    ["R05", "管理精實改善人員，辦理工作分配、進度覆核、代理及改善方法培育。"],
  ],
  authority: "可自行決定：已確認專案內的部門分工、資料整理、例行追蹤與一般進度回覆。需協商／會簽：跨單位專案範圍、試驗時程、效益資料與對客回覆內容。需向上核定：超出既定範圍的需求、主責或資源爭議、設備投資、重大客戶承諾及涉及成本報價的方案，先呈產效改善副理整合，再依正式權限核定。",
  performance: ["改善需求的受理、主責、時程與資料完整性。", "專案試驗、導入、跨單位待辦及客戶回覆的推進時效。", "改善前後資料、效益驗證及持續追蹤結果。", "重大專案風險的預警、升級與處理結果。", "精實改善人員的專案管理、英文溝通、代理及能力移轉進展。"],
  competencies: ["M03", "M04", "M05", "M06", "M07", "P12"],
  requirements: ["學歷｜大學畢業。", "工作年資｜相關工作經驗 3 年以上。", "管理歷練｜具改善專案管理、跨單位推動及人員帶領經驗。", "專業歷練｜熟悉效益資料分析、試驗導入、設備或流程改善及客戶改善專案回報。"],
  languages: {
    mandarin: language("必要；能完成管理溝通及重大專案報告。", "必要；能處理主要專案與管理文件。", "管理會議、跨單位協調及向上呈報。"),
    vietnamese: language("必要；能完成團隊溝通及現場資料確認。", "必要；能處理日常專案資料。", "現場改善、資料蒐集及人員帶領。"),
    english: language("必要；能參與客戶改善會議並說明進度。", "必要；能閱讀及回覆客戶改善需求與報告。", "客戶改善專案、會議及成果回報。"),
  },
  questions: [
    "本職位尚未完成實際負責人獨立訪談；現行課長與目標主任的責任、編制、部屬及代理安排。", "專案範圍、優先順序、主責與結案標準的確認權；設備採購、技術測試及現場執行責任不因催辦而移入精實改善。",
    "5S 目前由精實改善推動；其巡查與改善範圍、現場維持責任，以及與環安的交界仍待核對。", "對客效益資料、價格敏感內容及承諾的覆核權；本職位不因提供 PPH 或人力試算而取得報價權。",
    "客戶會議的主講與主管代表安排；客戶要求外籍主管參會的現況，不作為本職位國籍條件。", "學歷、年資、必要歷練與績效；中英越文能力要求須依實際任務逐項校準，不直接以現任課長能力作為門檻。",
  ],
});

export const seedPositions: SeedPosition[] = [
  factorySupervisor,
  administrativeManager,
  fieldStaffAssociate,
  productionManager("面部", "P02", "VT現場面部副協理_工作說明書.md"),
  productionManager("底部", "P03", "VT現場底部經理_工作說明書.md"),
  organizationPosition("p-general-affairs-deputy", "總務副理", "行政幕僚", "總務", "副理", "行政幕僚經理"),
  organizationPosition("p-general-affairs-section-chief", "總務課長", "行政幕僚", "總務組", "課長", "總務副理"),
  organizationPosition("p-hr-section-chief", "人事課長", "行政幕僚", "人事組", "課長", "總務副理"),
  organizationPosition("p-engineering-section-chief", "工程課長", "行政幕僚", "工程組", "課長", "總務副理"),
  organizationPosition("p-cleaning-section-chief", "清潔課長", "行政幕僚", "清潔班", "課長", "總務副理"),
  organizationPosition("p-secretariat-director", "秘書室主任", "行政幕僚", "秘書室", "主任", "行政幕僚經理"),
  ehsDirector,
  businessDeputy,
  purchasingDeputy,
  organizationPosition("p-bottom-material-purchasing-director", "底料採購主任", "現場幕僚", "底料採購", "主任", "採購副理"),
  organizationPosition("p-upper-material-purchasing-director", "面料採購主任", "現場幕僚", "面料採購", "主任", "採購副理"),
  organizationPosition("p-quality-deputy", "品管副理", "現場幕僚", "品管", "副理", "現場幕僚副協理"),
  organizationPosition("p-floor-quality-director", "現場品管主任", "現場幕僚", "現場品管", "主任", "品管副理"),
  organizationPosition("p-staff-quality-section-chief", "幕僚品管課長", "現場幕僚", "幕僚品管", "課長", "品管副理"),
  organizationPosition("p-materials-deputy", "資材副理", "現場幕僚", "資材", "副理", "現場幕僚副協理"),
  organizationPosition("p-laboratory-director", "實驗室主任", "現場幕僚", "實驗室", "主任", "資材副理"),
  organizationPosition("p-upper-inspection-director", "面檢課主任", "現場幕僚", "面檢課", "主任", "資材副理"),
  organizationPosition("p-materials-logistics-director", "資材物流主任", "現場幕僚", "資材物流課", "主任", "資材副理"),
  organizationPosition("p-materials-staff-director", "資材幕僚主任", "現場幕僚", "資材幕僚課", "主任", "資材副理"),
  productivityImprovementDeputy,
  ieDirector,
  leanDirector,
  organizationPosition("p-warehouse-director", "倉儲主任", "現場幕僚", "倉儲", "主任", "現場幕僚副協理"),
  organizationPosition("p-production-control-director", "生管主任", "現場幕僚", "生管", "主任", "現場幕僚副協理"),
  sharedUpperDeputyPosition("p-vt1-upper-deputy", "VT1面部"),
  sharedUpperDeputyPosition("p-vt2-upper-deputy", "VT2面部"),
  sharedUpperDeputyPosition("p-vt3-upper-deputy", "VT3面部"),
  sharedUpperDeputyPosition("p-vt5-upper-deputy", "VT5面部"),
  organizationPosition("p-bottom-assembly-deputy", "組底副理", "底部", "組底", "副理", "現場底部經理"),
  organizationPosition("p-lasting-deputy", "成型副理", "底部", "成型", "副理", "現場底部經理"),
  organizationPosition("p-automation-deputy", "自動化副理", "自動化", "", "副理", "廠主管"),
];

const importedJobDescriptionCodes: Record<string, { id: string; code: string }> = {
  "p-factory-supervisor": { id: "jd-factory-supervisor", code: "JD-VT-001" },
  "p-admin-staff-manager": { id: "jd-admin-staff-manager", code: "JD-VT-002" },
  "p-field-staff-manager": { id: "jd-field-staff-manager", code: "JD-VT-003" },
  "p-upper-manager": { id: "jd-upper-manager", code: "JD-VT-004" },
  "p-bottom-manager": { id: "jd-bottom-manager", code: "JD-VT-005" },
  "p-purchasing-director": { id: "jd-purchasing-deputy", code: "JD-VT-006" },
  "p-business-director": { id: "jd-business-deputy", code: "JD-VT-007" },
  "p-productivity-improvement-deputy": { id: "jd-productivity-improvement-deputy", code: "JD-VT-008" },
  "p-ehs-director": { id: "jd-ehs-director", code: "JD-VT-009" },
  "p-ie-director": { id: "jd-ie-director", code: "JD-VT-010" },
  "p-lean-section-chief": { id: "jd-lean-director", code: "JD-VT-011" },
};

export const seedJobDescriptions: SeedJobDescription[] = [
  ...seedPositions.flatMap((position) => {
    const identity = importedJobDescriptionCodes[position.id];
    if (!identity) return [];
    position.jobDescriptionId = identity.id;
    return [{
      id: identity.id,
      code: identity.code,
      title: position.name,
      site: position.site,
      department: position.department,
      grade: position.grade,
      reportsTo: position.reportsTo,
      status: position.status,
      version: position.version,
      effectiveDate: position.effectiveDate,
      updatedAt: position.updatedAt,
      confidentiality: position.confidentiality,
      confirmationStatus: position.confirmationStatus,
      confirmedBy: position.confirmedBy,
      confirmedAt: position.confirmedAt,
      confirmationNote: position.confirmationNote,
      document: position.document,
    }];
  }),
  upperDeputyJobDescription,
];

function unit(
  id: string,
  parentId: string | null,
  name: string,
  sortOrder: number,
  supervisorTitle: string,
  supervisorName = "",
  organizationStatus: OrgNode["organizationStatus"] = "已確認",
): OrgNode {
  const reference = departmentMetaByName[name];
  return {
    id, parentId, name, type: "unit", positionId: null, sortOrder,
    duties: reference?.duties ?? "組織位置及最高主管職位依 Ivy 2026-09-12 組織簡表建立；單位詳細執掌尚未提供。",
    purpose: reference?.purpose ?? "",
    supervisorName, supervisorTitle, organizationStatus,
  };
}

function positionNode(id: string, parentId: string, name: string, positionId: string, sortOrder = 0): OrgNode {
  return { id, parentId, name, type: "position", positionId, sortOrder, duties: "", purpose: "", organizationStatus: "已確認" };
}

export const seedOrgNodes: OrgNode[] = [
  unit("node-factory-manager", null, "VT廠", 1, "廠主管"),
  positionNode("node-factory-supervisor", "node-factory-manager", "廠主管", "p-factory-supervisor"),
  unit("unit-admin-staff", "node-factory-manager", "行政幕僚", 1, "行政幕僚經理", "楊旻軒"),
  positionNode("node-admin-staff-manager", "unit-admin-staff", "行政幕僚經理", "p-admin-staff-manager"),
  unit("unit-general-affairs", "unit-admin-staff", "總務", 1, "總務副理", "劉氏芯"),
  positionNode("node-general-affairs-deputy", "unit-general-affairs", "總務副理", "p-general-affairs-deputy"),
  unit("unit-general-affairs-section", "unit-general-affairs", "總務組", 1, "總務課長"),
  positionNode("node-general-affairs-section-chief", "unit-general-affairs-section", "總務課長", "p-general-affairs-section-chief"),
  unit("unit-hr-section", "unit-general-affairs", "人事組", 2, "人事課長"),
  positionNode("node-hr-section-chief", "unit-hr-section", "人事課長", "p-hr-section-chief"),
  unit("unit-engineering-section", "unit-general-affairs", "工程組", 3, "工程課長"),
  positionNode("node-engineering-section-chief", "unit-engineering-section", "工程課長", "p-engineering-section-chief"),
  unit("unit-cleaning-team", "unit-general-affairs", "清潔班", 4, "清潔課長"),
  positionNode("node-cleaning-section-chief", "unit-cleaning-team", "清潔課長", "p-cleaning-section-chief"),
  unit("unit-secretariat", "unit-admin-staff", "秘書室", 2, "秘書室主任", "阮氏李"),
  positionNode("node-secretariat-director", "unit-secretariat", "秘書室主任", "p-secretariat-director"),
  unit("unit-ehs", "unit-admin-staff", "環安", 3, "環安主任", "石旻錡(兼)", "待確認"),
  positionNode("node-ehs-director", "unit-ehs", "環安主任", "p-ehs-director"),
  unit("unit-field-staff", "node-factory-manager", "現場幕僚", 2, "現場幕僚副協理", "徐季瑋", "待確認"),
  positionNode("node-field-staff-manager", "unit-field-staff", "現場幕僚副協理", "p-field-staff-manager"),
  unit("unit-business", "unit-field-staff", "業務", 1, "業務副理", "潘姵如"),
  positionNode("node-business-director", "unit-business", "業務副理", "p-business-director"),
  unit("unit-purchasing", "unit-field-staff", "採購", 2, "採購副理", "覃秋玲"),
  positionNode("node-purchasing-director", "unit-purchasing", "採購副理", "p-purchasing-director"),
  unit("unit-bottom-material-purchasing", "unit-field-staff", "底料採購", 3, "底料採購主任", "宋承浩"),
  positionNode("node-bottom-material-purchasing-director", "unit-bottom-material-purchasing", "底料採購主任", "p-bottom-material-purchasing-director"),
  unit("unit-upper-material-purchasing", "unit-field-staff", "面料採購", 4, "面料採購主任", "湛鳳娟"),
  positionNode("node-upper-material-purchasing-director", "unit-upper-material-purchasing", "面料採購主任", "p-upper-material-purchasing-director"),
  unit("unit-quality", "unit-field-staff", "品管", 5, "品管副理", "姚金鳳(兼)"),
  positionNode("node-quality-deputy", "unit-quality", "品管副理", "p-quality-deputy"),
  unit("unit-floor-quality", "unit-quality", "現場品管", 1, "現場品管主任", "范氏惠"),
  positionNode("node-floor-quality-director", "unit-floor-quality", "現場品管主任", "p-floor-quality-director"),
  unit("unit-staff-quality", "unit-quality", "幕僚品管", 2, "幕僚品管課長", "李彩平"),
  positionNode("node-staff-quality-section-chief", "unit-staff-quality", "幕僚品管課長", "p-staff-quality-section-chief"),
  unit("unit-materials", "unit-field-staff", "資材", 6, "資材副理", "姚金鳳"),
  positionNode("node-materials-deputy", "unit-materials", "資材副理", "p-materials-deputy"),
  unit("unit-laboratory", "unit-field-staff", "實驗室", 7, "實驗室主任", "阮氏梅", "待確認"),
  positionNode("node-laboratory-director", "unit-laboratory", "實驗室主任", "p-laboratory-director"),
  unit("unit-upper-inspection", "unit-field-staff", "面檢課", 8, "面檢課主任", "汪慶文", "待確認"),
  positionNode("node-upper-inspection-director", "unit-upper-inspection", "面檢課主任", "p-upper-inspection-director"),
  unit("unit-materials-logistics", "unit-field-staff", "資材物流課", 9, "資材物流主任", "余光輝", "待確認"),
  positionNode("node-materials-logistics-director", "unit-materials-logistics", "資材物流主任", "p-materials-logistics-director"),
  unit("unit-materials-staff", "unit-field-staff", "資材幕僚課", 10, "資材幕僚主任", "黃氏話", "待確認"),
  positionNode("node-materials-staff-director", "unit-materials-staff", "資材幕僚主任", "p-materials-staff-director"),
  unit("unit-productivity-improvement", "unit-field-staff", "產效改善", 11, "產效改善副理", "石旻錡"),
  positionNode("node-productivity-improvement-deputy", "unit-productivity-improvement", "產效改善副理", "p-productivity-improvement-deputy"),
  unit("unit-ie", "unit-productivity-improvement", "IE", 1, "IE主任", "", "待確認"),
  positionNode("node-ie-director", "unit-ie", "IE主任", "p-ie-director"),
  unit("unit-lean", "unit-productivity-improvement", "精實改善", 2, "精實改善主任"),
  positionNode("node-lean-section-chief", "unit-lean", "精實改善主任", "p-lean-section-chief"),
  unit("unit-warehouse", "unit-field-staff", "倉儲", 12, "倉儲主任", "李恆", "待確認"),
  positionNode("node-warehouse-director", "unit-warehouse", "倉儲主任", "p-warehouse-director"),
  unit("unit-production-control", "unit-field-staff", "生管", 13, "生管主任", "李才亮", "待確認"),
  positionNode("node-production-control-director", "unit-production-control", "生管主任", "p-production-control-director"),
  unit("unit-upper", "node-factory-manager", "面部", 3, "現場面部副協理", "李紅星", "待確認"),
  positionNode("node-upper-manager", "unit-upper", "現場面部副協理", "p-upper-manager"),
  unit("unit-vt1-upper", "unit-upper", "VT1面部", 1, "面部副理", "覃文剛", "待確認"),
  positionNode("node-vt1-upper-deputy", "unit-vt1-upper", "面部副理", "p-vt1-upper-deputy"),
  unit("unit-vt2-upper", "unit-upper", "VT2面部", 2, "面部副理", "吳春蘭", "待確認"),
  positionNode("node-vt2-upper-deputy", "unit-vt2-upper", "面部副理", "p-vt2-upper-deputy"),
  unit("unit-vt3-upper", "unit-upper", "VT3面部", 3, "面部副理", "肖海榮", "待確認"),
  positionNode("node-vt3-upper-deputy", "unit-vt3-upper", "面部副理", "p-vt3-upper-deputy"),
  unit("unit-vt5-upper", "unit-upper", "VT5面部", 4, "面部副理", "李玉珍", "待確認"),
  positionNode("node-vt5-upper-deputy", "unit-vt5-upper", "面部副理", "p-vt5-upper-deputy"),
  unit("unit-bottom", "node-factory-manager", "底部", 4, "現場底部經理", "曾建兵"),
  positionNode("node-bottom-manager", "unit-bottom", "現場底部經理", "p-bottom-manager"),
  unit("unit-bottom-assembly", "unit-bottom", "組底", 1, "組底副理", "劉永華"),
  positionNode("node-bottom-assembly-deputy", "unit-bottom-assembly", "組底副理", "p-bottom-assembly-deputy"),
  unit("unit-lasting", "unit-bottom", "成型", 2, "成型副理", "侯懷玉"),
  positionNode("node-lasting-deputy", "unit-lasting", "成型副理", "p-lasting-deputy"),
  unit("unit-automation", "node-factory-manager", "自動化", 5, "自動化副理", "洪碩亨", "待確認"),
  positionNode("node-automation-deputy", "unit-automation", "自動化副理", "p-automation-deputy"),
];
