"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  default: () => dvcPlugin
});
module.exports = __toCommonJS(index_exports);
var import_path3 = require("path");
var import_fs3 = require("fs");

// src/resolve.ts
var import_path = require("path");
var import_tinyglobby = require("tinyglobby");

// src/dvc-file.ts
var import_fs = require("fs");
var import_js_yaml = __toESM(require("js-yaml"), 1);
function parseDvcFile(filePath) {
  const text = (0, import_fs.readFileSync)(filePath, "utf-8");
  const doc = import_js_yaml.default.load(text);
  if (!doc?.outs) return [];
  return doc.outs.filter((out) => out.md5 && out.path && !out.md5.endsWith(".dir"));
}

// src/resolve.ts
async function resolveEntries(searchRoot, pattern = "**/*.dvc") {
  const dvcFiles = await (0, import_tinyglobby.glob)(pattern, { cwd: searchRoot, absolute: true });
  const entries = [];
  for (const dvcFile of dvcFiles) {
    const outs = parseDvcFile(dvcFile);
    const dvcFileDir = (0, import_path.dirname)(dvcFile);
    for (const out of outs) {
      const absPath = (0, import_path.join)(dvcFileDir, out.path);
      const relPath = (0, import_path.relative)(searchRoot, absPath);
      entries.push({
        path: relPath,
        md5: out.md5,
        size: out.size
      });
    }
  }
  return entries;
}

// src/config.ts
var import_fs2 = require("fs");
var import_path2 = require("path");
function parseDvcConfig(configPath) {
  const text = (0, import_fs2.readFileSync)(configPath, "utf-8");
  const sections = {};
  let currentSection = "";
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const sectionMatch = trimmed.match(/^\[(.+)]$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1];
      if (!sections[currentSection]) sections[currentSection] = {};
      continue;
    }
    const kvMatch = trimmed.match(/^(\w+)\s*=\s*(.+)$/);
    if (kvMatch) {
      const [, key, value] = kvMatch;
      if (!sections[currentSection]) sections[currentSection] = {};
      sections[currentSection][key] = value.trim();
    }
  }
  return sections;
}
function getRemote(dvcDir, remoteName) {
  const configPath = (0, import_path2.join)(dvcDir, "config");
  const config = parseDvcConfig(configPath);
  const name = remoteName ?? config["core"]?.remote;
  if (!name) throw new Error("No default remote found in .dvc/config [core] section");
  const sectionKey = `'remote "${name}"'`;
  const remoteSection = config[sectionKey];
  if (!remoteSection?.url) {
    throw new Error(`Remote "${name}" not found in .dvc/config (looked for section ${sectionKey})`);
  }
  return { name, url: remoteSection.url };
}

// src/s3-url.ts
function s3ToHttps(s3Url) {
  const match = s3Url.match(/^s3:\/\/([^/]+)\/?(.*?)$/);
  if (!match) throw new Error(`Invalid S3 URL: ${s3Url}`);
  const [, bucket, prefix] = match;
  const trimmed = prefix.replace(/\/$/, "");
  return trimmed ? `https://${bucket}.s3.amazonaws.com/${trimmed}` : `https://${bucket}.s3.amazonaws.com`;
}
function cacheUrl(remoteHttpsUrl, md5) {
  const xx = md5.slice(0, 2);
  const rest = md5.slice(2);
  return `${remoteHttpsUrl}/files/md5/${xx}/${rest}`;
}

// src/index.ts
var VIRTUAL_ID = "virtual:dvc-data";
var RESOLVED_VIRTUAL_ID = "\0" + VIRTUAL_ID;
function findDvcDir(startDir) {
  let dir = startDir;
  while (true) {
    const candidate = (0, import_path3.join)(dir, ".dvc");
    if ((0, import_fs3.existsSync)(candidate)) return candidate;
    const parent = (0, import_path3.resolve)(dir, "..");
    if (parent === dir) return null;
    dir = parent;
  }
}
function dvcPlugin(options = {}) {
  let config;
  let urlMap = {};
  return {
    name: "vite-plugin-dvc",
    async configResolved(resolvedConfig) {
      config = resolvedConfig;
      const viteRoot = config.root;
      const dvcDir = options.dvcDir ?? findDvcDir(viteRoot);
      if (!dvcDir) {
        config.logger.warn("[vite-plugin-dvc] No .dvc directory found");
        return;
      }
      const searchRoot = options.root ? (0, import_path3.resolve)(viteRoot, options.root) : viteRoot;
      const entries = await resolveEntries(searchRoot, options.glob);
      if (entries.length === 0) {
        config.logger.warn("[vite-plugin-dvc] No .dvc entries found");
        return;
      }
      const isDev = config.command === "serve";
      const devMode = process.env.VITE_PLUGIN_DVC_DEV ?? options.dev ?? "local";
      const useLocal = isDev && devMode === "local";
      if (useLocal) {
        for (const entry of entries) {
          urlMap[entry.path] = `/${entry.path}`;
        }
      } else {
        const remoteUrl = options.baseUrl ?? (() => {
          const remote = getRemote(dvcDir, options.remote);
          return s3ToHttps(remote.url);
        })();
        for (const entry of entries) {
          urlMap[entry.path] = cacheUrl(remoteUrl, entry.md5);
        }
      }
      config.logger.info(`[vite-plugin-dvc] Resolved ${entries.length} entries (${useLocal ? "local" : "s3"})`);
    },
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_VIRTUAL_ID;
    },
    load(id) {
      if (id !== RESOLVED_VIRTUAL_ID) return;
      return [
        `export const urls = ${JSON.stringify(urlMap, null, 2)};`,
        `export function resolve(path) {`,
        `  return urls[path] ?? path;`,
        `}`
      ].join("\n");
    }
  };
}
