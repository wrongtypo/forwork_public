import type { LocalePreset } from "opencc-js/core";

type PackedValue = number | PackedValue[] | { [key: string]: PackedValue };
export type PackedPreset = { dictionaries: string[]; preset: PackedValue };

// Preserve OpenCC's complete conversion chains, segmentation and normalization,
// while storing repeated dictionary strings only once in a cacheable data asset.
export function packChinesePreset(source: LocalePreset): PackedPreset {
  const dictionaries: string[] = [];
  const ids = new Map<string, number>();
  function encode(value: unknown): PackedValue {
    if (typeof value === "string") {
      if (!ids.has(value)) { ids.set(value, dictionaries.length); dictionaries.push(value); }
      return ids.get(value)!;
    }
    if (Array.isArray(value)) return value.map(encode);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, encode(entry)]));
    throw new Error("Unsupported Chinese dictionary format");
  }
  const preset = encode({
    from: { cn: source.from.cn, tw: source.from.tw },
    to: { cn: source.to.cn, tw: source.to.tw },
    configs: { s2tw: source.configs?.s2tw, tw2s: source.configs?.tw2s },
  });
  return { dictionaries, preset };
}

export function unpackChinesePreset(packed: PackedPreset): LocalePreset {
  function decode(value: PackedValue): unknown {
    if (typeof value === "number") {
      const dictionary = packed.dictionaries[value];
      if (!Number.isInteger(value) || typeof dictionary !== "string") throw new Error("Invalid Chinese dictionary reference");
      return dictionary;
    }
    if (Array.isArray(value)) return value.map(decode);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, decode(entry)]));
    throw new Error("Invalid Chinese dictionary format");
  }
  return decode(packed.preset) as LocalePreset;
}
