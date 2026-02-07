// src/index.ts
import { join as join3, resolve as pathResolve } from "path";
import { existsSync } from "fs";

// src/resolve.ts
import { join, dirname, relative } from "path";
import { glob } from "tinyglobby";

// src/dvc-file.ts
import { readFileSync } from "fs";
import yaml from "js-yaml";
function parseDvcFile(filePath) {
  const text = readFileSync(filePath, "utf-8");
  const doc = yaml.load(text);
  if (!doc?.outs) return [];
  return doc.outs.filter((out) => out.md5 && out.path && !out.md5.endsWith(".dir"));
}

// src/resolve.ts
async function resolveEntries(searchRoot, pattern = "**/*.dvc") {
  const dvcFiles = await glob(pattern, { cwd: searchRoot, absolute: true });
  const entries = [];
  for (const dvcFile of dvcFiles) {
    const outs = parseDvcFile(dvcFile);
    const dvcFileDir = dirname(dvcFile);
    for (const out of outs) {
      const absPath = join(dvcFileDir, out.path);
      const relPath = relative(searchRoot, absPath);
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
import { readFileSync as readFileSync2 } from "fs";
import { join as join2 } from "path";
function parseDvcConfig(configPath) {
  const text = readFileSync2(configPath, "utf-8");
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
  const configPath = join2(dvcDir, "config");
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
    const candidate = join3(dir, ".dvc");
    if (existsSync(candidate)) return candidate;
    const parent = pathResolve(dir, "..");
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
      const searchRoot = options.root ? pathResolve(viteRoot, options.root) : viteRoot;
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
export {
  dvcPlugin as default
};
