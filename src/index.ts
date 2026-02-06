import { join, resolve as pathResolve } from 'path'
import { existsSync } from 'fs'
import type { Plugin, ResolvedConfig } from 'vite'
import { resolveEntries } from './resolve.js'
import { getRemote } from './config.js'
import { s3ToHttps, cacheUrl } from './s3-url.js'

export interface DvcPluginOptions {
  /** Path to .dvc/ directory (default: auto-detect walking up from vite root) */
  dvcDir?: string
  /** Glob pattern for .dvc files (default: '**\/*.dvc') */
  glob?: string
  /** Search root for .dvc files, relative to vite root (default: '.') */
  root?: string
  /** Remote name (default: default from .dvc/config) */
  remote?: string
  /** Override base URL (e.g. CloudFront domain) */
  baseUrl?: string
  /** Dev mode behavior: 'local' returns relative paths, 's3' returns S3 URLs (default: 'local') */
  dev?: 'local' | 's3'
}

const VIRTUAL_ID = 'virtual:dvc-data'
const RESOLVED_VIRTUAL_ID = '\0' + VIRTUAL_ID

/**
 * Walk up from `startDir` looking for a `.dvc` directory.
 */
function findDvcDir(startDir: string): string | null {
  let dir = startDir
  while (true) {
    const candidate = join(dir, '.dvc')
    if (existsSync(candidate)) return candidate
    const parent = pathResolve(dir, '..')
    if (parent === dir) return null
    dir = parent
  }
}

export default function dvcPlugin(options: DvcPluginOptions = {}): Plugin {
  let config: ResolvedConfig
  let urlMap: Record<string, string> = {}

  return {
    name: 'vite-plugin-dvc',
    async configResolved(resolvedConfig) {
      config = resolvedConfig
      const viteRoot = config.root

      const dvcDir = options.dvcDir ?? findDvcDir(viteRoot)
      if (!dvcDir) {
        config.logger.warn('[vite-plugin-dvc] No .dvc directory found')
        return
      }

      const searchRoot = options.root
        ? pathResolve(viteRoot, options.root)
        : viteRoot

      const entries = await resolveEntries(searchRoot, options.glob)
      if (entries.length === 0) {
        config.logger.warn('[vite-plugin-dvc] No .dvc entries found')
        return
      }

      const isDev = config.command === 'serve'
      const useLocal = isDev && (options.dev ?? 'local') === 'local'

      if (useLocal) {
        for (const entry of entries) {
          urlMap[entry.path] = `/${entry.path}`
        }
      } else {
        const remoteUrl = options.baseUrl ?? (() => {
          const remote = getRemote(dvcDir, options.remote)
          return s3ToHttps(remote.url)
        })()

        for (const entry of entries) {
          urlMap[entry.path] = cacheUrl(remoteUrl, entry.md5)
        }
      }

      config.logger.info(`[vite-plugin-dvc] Resolved ${entries.length} entries (${useLocal ? 'local' : 's3'})`)
    },
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_VIRTUAL_ID
    },
    load(id) {
      if (id !== RESOLVED_VIRTUAL_ID) return
      return [
        `export const urls = ${JSON.stringify(urlMap, null, 2)};`,
        `export function resolve(path) {`,
        `  return urls[path] ?? path;`,
        `}`,
      ].join('\n')
    },
  }
}
