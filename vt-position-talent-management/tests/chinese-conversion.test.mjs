import assert from "node:assert/strict";
import test from "node:test";
import { Converter } from "opencc-js";
import { ConverterBuilder } from "opencc-js/core";
import * as original from "opencc-js/preset";
import { packChinesePreset, unpackChinesePreset } from "../lib/chinese-preset.ts";

test("cacheable Chinese dictionary preserves every requested OpenCC rule", () => {
  const packed = packChinesePreset(original);
  assert.equal(new Set(packed.dictionaries).size, packed.dictionaries.length);
  const restored = unpackChinesePreset(JSON.parse(JSON.stringify(packed)));
  assert.deepEqual(restored, { from: { cn: original.from.cn, tw: original.from.tw }, to: { cn: original.to.cn, tw: original.to.tw }, configs: { s2tw: original.configs.s2tw, tw2s: original.configs.tw2s } });
  const builder = ConverterBuilder(restored);
  for (const options of [{ from: "tw", to: "cn" }, { from: "cn", to: "tw" }]) {
    const convert = builder(options), reference = Converter(options);
    for (const text of ["工作說明書 審核者 石旻錡 覃秋玲 李紅星 2026/09/14 v1", "职务名称 现职者 接班者 历史版本", "头发发展 面条面部 干部干燥 重庆重复", "神福 臺灣 裏面 瞭解 計畫 滑鼠 軟體"]) assert.equal(convert(text), reference(text));
  }
});
