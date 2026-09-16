import type { Plugin } from "vite";
import * as preset from "opencc-js/preset";
import { packChinesePreset } from "../lib/chinese-preset";

const moduleId = "virtual:vt-chinese-dictionary";
const resolvedId = `\0${moduleId}`;
const devPath = "/__vt_chinese_dictionary.json";

export function chineseDictionaryAsset(): Plugin {
  const json = JSON.stringify(packChinesePreset(preset));
  let isBuild = false;
  return {
    name: "vt-chinese-dictionary-asset",
    configResolved(config) { isBuild = config.command === "build"; },
    resolveId(id) { if (id === moduleId) return resolvedId; },
    load(id) {
      if (id !== resolvedId) return;
      if (!isBuild) return `export default ${JSON.stringify(devPath)};`;
      const reference = this.emitFile({ type: "asset", name: "chinese-dictionary.json", source: json });
      return `export default import.meta.ROLLUP_FILE_URL_${reference};`;
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.url?.split("?")[0] !== devPath) return next();
        response.setHeader("Content-Type", "application/json; charset=utf-8");
        response.setHeader("Cache-Control", "no-cache");
        response.end(json);
      });
    },
  };
}
