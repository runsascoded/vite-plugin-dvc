import { readFileSync } from 'fs'
import yaml from 'js-yaml'

export interface DvcOut {
  md5: string
  size: number
  hash: string
  path: string
}

interface DvcFileContent {
  outs?: DvcOut[]
}

/**
 * Parse a .dvc file (YAML) and extract output entries.
 * Skips entries with `.dir` hashes (directory entries).
 */
export function parseDvcFile(filePath: string): DvcOut[] {
  const text = readFileSync(filePath, 'utf-8')
  const doc = yaml.load(text) as DvcFileContent | null
  if (!doc?.outs) return []
  return doc.outs.filter(out => out.md5 && out.path && !out.md5.endsWith('.dir'))
}
