import { ConverterBuilder, type ConverterFunction } from "opencc-js/core";
import dictionaryUrl from "virtual:vt-chinese-dictionary";
import { unpackChinesePreset, type PackedPreset } from "./chinese-preset";

let converters: { simplified: ConverterFunction; traditional: ConverterFunction } | undefined;
let loading: Promise<void> | undefined;

export function loadChineseConverters(): Promise<void> {
  if (converters) return Promise.resolve();
  loading ??= (async () => {
    const response = await fetch(dictionaryUrl);
    if (!response.ok) throw new Error("繁簡字典載入失敗，請重新載入頁面。");
    const converter = ConverterBuilder(unpackChinesePreset(await response.json() as PackedPreset));
    converters = { simplified: converter({ from: "tw", to: "cn" }), traditional: converter({ from: "cn", to: "tw" }) };
  })().catch((error) => { loading = undefined; throw error; });
  return loading;
}

export function toSimplifiedChinese(value: string): string {
  if (!converters) throw new Error("繁簡字典尚未載入。");
  return converters.simplified(value);
}
export function toTraditionalChinese(value: string): string {
  if (!converters) throw new Error("繁簡字典尚未載入。");
  return converters.traditional(value);
}
