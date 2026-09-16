import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { registerHooks } from "node:module";
import test from "node:test";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Synthetic records only. No browser connector or real HR database access.
registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL?.endsWith(".tsx") && specifier.startsWith(".") && !/\.[a-z]+$/.test(specifier)) return next(`${specifier}.${existsSync(new URL(`${specifier}.tsx`, context.parentURL)) ? "tsx" : "ts"}`, context);
    return next(specifier, context);
  },
  load(url, context, next) {
    if (!url.endsWith(".tsx")) return next(url, context);
    return { format: "module", shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    }).outputText };
  },
});
const { default: View } = await import("../app/JobDescriptionsView.tsx");
const { CompetencyTags } = await import("../app/PositionDocument.tsx");
const record = {
  id: "synthetic", code: "TEST-001", title: "測試職務", site: "測試", department: "測試部門", grade: "測試", reportsTo: "待確認",
  status: "主管確認中", version: "2.0", reviewer: "測試審核者", effectiveDate: "2026-09-14", updatedAt: "2026-09-15", confidentiality: "測試",
  confirmationStatus: "待確認", confirmedBy: "", confirmedAt: "", confirmationNote: "", usageCount: 0,
  revisionId: "test-v2", revisionNumber: 2, revisionToken: "test-token",
  currentEffectiveVersion: "1.0", currentEffectiveRevisionId: "test-v1",
  document: { summary: "測試摘要", purpose: "測試目的", managementUnit: "測試", authority: "待確認", responsibilities: [],
    performance: [], competencies: [], requirements: [], languages: { mandarin: "待確認", vietnamese: "待確認", english: "待確認" },
    successors: [], interviewQuestions: ["隱藏訪談內容"], sources: ["隱藏來源"], annotations: [{ type: "待確認", content: "隱藏備註" }] },
};
const data = { positions: [], jobDescriptions: [{ ...record, versions: [{ id: "test-v2", revision: 2, status: record.status, version: record.version, effectiveDate: "", expiredDate: "", updatedAt: record.updatedAt, record }] }],
  orgNodes: [], people: [], assessments: [], competencies: [] };
const props = { data, busy: false, makeBlank: () => record, normalizeSearch: (value) => value, postAction: async () => null, onOpenPerson() {}, onOpenPosition() {}, onPrint() {} };

test("document competency tags distinguish M, P, L and unclassified items without changing their text", () => {
  const html = renderToStaticMarkup(React.createElement(CompetencyTags, {
    items: ["M01", "P14 行政事務管理", "L01", "測試專業能力", "待確認"],
    competencies: [{ id: "M01", name: "管理規劃", category: "管理職能" }, { id: "P02", name: "測試專業能力", category: "專業職能" }],
  }));
  assert.match(html, /competency-tag-M" title="管理職能">M01 管理規劃/);
  assert.match(html, /competency-tag-P" title="專業職能">P14 行政事務管理/);
  assert.match(html, /competency-tag-P" title="專業職能">P02 測試專業能力/);
  assert.match(html, /competency-tag-L" title="語言能力">L01/);
  assert.match(html, /competency-tag-unknown" title="未分類">待確認/);
});

test("overview restores the eight agreed columns with live relation counts", () => {
  const html = renderToStaticMarkup(React.createElement(View, props));
  assert.match(html, /<table class="jd-table jd-overview"/);
  assert.deepEqual([...html.matchAll(/<th scope="col">([^<]+)<\/th>/g)].map((match) => match[1]), ["代碼", "職務名稱", "已關聯", "現職者", "接班者", "最新版本", "狀態", "生效日"]);
  assert.doesNotMatch(html, /工作說明書庫|jd-library-index/);
  assert.match(html, /已關聯 0 職位/);
  assert.match(html, /現職者 0 人/);
  assert.match(html, /接班者 0 人/);
  assert.match(html, /TEST-001/);
  assert.match(html, /jd-status-review/);
  assert.match(html, /生效日：新到舊/);
});

test("overview shows deduplicated people, missing dates and empty results", () => {
  const person = { id: "test-person", name: "測試人員" };
  const populated = { ...data, people: [person], positions: [1, 2].map((id) => ({ id: `test-position-${id}`, jobDescriptionId: record.id, incumbents: [person], successors: [] })), jobDescriptions: [{ ...record, effectiveDate: "" }] };
  const html = renderToStaticMarkup(React.createElement(View, { ...props, data: populated }));
  assert.match(html, /已關聯 2 職位/);
  assert.match(html, /現職者 1 人/);
  assert.match(html, /接班者 0 人/);
  assert.match(html, /尚未生效/);
  const empty = renderToStaticMarkup(React.createElement(View, { ...props, data: { ...data, jobDescriptions: [] } }));
  assert.match(empty, /colSpan="8"/i);
  assert.match(empty, /沒有符合條件的工作說明書/);
});

test("opening a master defaults to the latest document with effective and history links", () => {
  const html = renderToStaticMarkup(React.createElement(View, { ...props, initialId: "synthetic" }));
  assert.match(html, /v2.0/);
  assert.match(html, /歷史版本/);
  assert.match(html, /此版本尚未生效/);
  assert.match(html, /v1.0/);
  assert.match(html, /測試目的/);
  assert.match(html, /編輯草稿/);
  assert.match(html, /正式生效/);
  assert.match(html, /position-detail print-document/);
  assert.match(html, /審核者：測試審核者/);
  assert.match(html, /2026\/09\/14/);
  assert.match(html, /列印／另存 PDF/);
  for (const text of ["資料來源", "備註與待確認事項", "主管訪談重點", "隱藏來源", "隱藏備註", "隱藏訪談內容", "測試摘要"]) assert.ok(!html.includes(text));
});
