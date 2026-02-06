import { readFileSync } from 'fs'
import { join } from 'path'

/**
 * Parse .dvc/config (INI-like format with special section syntax like ['remote "name"']).
 * Returns a map of sections to key-value pairs.
 */
export function parseDvcConfig(configPath: string): Record<string, Record<string, string>> {
  const text = readFileSync(configPath, 'utf-8')
  const sections: Record<string, Record<string, string>> = {}
  let currentSection = ''

  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const sectionMatch = trimmed.match(/^\[(.+)]$/)
    if (sectionMatch) {
      currentSection = sectionMatch[1]
      if (!sections[currentSection]) sections[currentSection] = {}
      continue
    }

    const kvMatch = trimmed.match(/^(\w+)\s*=\s*(.+)$/)
    if (kvMatch) {
      const [, key, value] = kvMatch
      if (!sections[currentSection]) sections[currentSection] = {}
      sections[currentSection][key] = value.trim()
    }
  }

  return sections
}

export interface DvcRemote {
  name: string
  url: string
}

/**
 * Read .dvc/config and extract the remote URL.
 * If `remoteName` is provided, use that; otherwise use the default remote from [core].
 */
export function getRemote(dvcDir: string, remoteName?: string): DvcRemote {
  const configPath = join(dvcDir, 'config')
  const config = parseDvcConfig(configPath)

  const name = remoteName ?? config['core']?.remote
  if (!name) throw new Error('No default remote found in .dvc/config [core] section')

  const sectionKey = `'remote "${name}"'`
  const remoteSection = config[sectionKey]
  if (!remoteSection?.url) {
    throw new Error(`Remote "${name}" not found in .dvc/config (looked for section ${sectionKey})`)
  }

  return { name, url: remoteSection.url }
}
