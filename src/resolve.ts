import { join, dirname, relative } from 'path'
import { glob } from 'tinyglobby'
import { parseDvcFile, type DvcOut } from './dvc-file.js'

export interface ResolvedEntry {
  /** Relative path from searchRoot to the tracked file */
  path: string
  /** MD5 hash from the .dvc file */
  md5: string
  /** File size in bytes */
  size: number
}

/**
 * Glob for .dvc files under `searchRoot`, parse each, and return resolved entries
 * with paths relative to `searchRoot`.
 */
export async function resolveEntries(
  searchRoot: string,
  pattern: string = '**/*.dvc',
): Promise<ResolvedEntry[]> {
  const dvcFiles = await glob(pattern, { cwd: searchRoot, absolute: true })
  const entries: ResolvedEntry[] = []

  for (const dvcFile of dvcFiles) {
    const outs: DvcOut[] = parseDvcFile(dvcFile)
    const dvcFileDir = dirname(dvcFile)
    for (const out of outs) {
      const absPath = join(dvcFileDir, out.path)
      const relPath = relative(searchRoot, absPath)
      entries.push({
        path: relPath,
        md5: out.md5,
        size: out.size,
      })
    }
  }

  return entries
}
