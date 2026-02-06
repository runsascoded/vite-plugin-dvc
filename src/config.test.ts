import { describe, it, expect } from 'vitest'
import { mkdtempSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { parseDvcConfig, getRemote } from './config.js'

function makeTempDvcDir(configContent: string): string {
  const tmp = mkdtempSync(join(tmpdir(), 'dvc-test-'))
  const dvcDir = join(tmp, '.dvc')
  mkdirSync(dvcDir)
  writeFileSync(join(dvcDir, 'config'), configContent)
  return dvcDir
}

describe('parseDvcConfig', () => {
  it('parses core section and remote sections', () => {
    const dvcDir = makeTempDvcDir([
      '[core]',
      '    remote = myremote',
      "['remote \"myremote\"']",
      '    url = s3://my-bucket/data',
    ].join('\n'))
    const config = parseDvcConfig(join(dvcDir, 'config'))
    expect(config['core']).toEqual({ remote: 'myremote' })
    expect(config["'remote \"myremote\"'"]).toEqual({ url: 's3://my-bucket/data' })
  })
  it('skips comments and blank lines', () => {
    const dvcDir = makeTempDvcDir([
      '# a comment',
      '',
      '[core]',
      '    remote = r',
    ].join('\n'))
    const config = parseDvcConfig(join(dvcDir, 'config'))
    expect(config['core']).toEqual({ remote: 'r' })
  })
})

describe('getRemote', () => {
  it('returns the default remote', () => {
    const dvcDir = makeTempDvcDir([
      '[core]',
      '    remote = storage',
      "['remote \"storage\"']",
      '    url = s3://bucket/prefix',
    ].join('\n'))
    const remote = getRemote(dvcDir)
    expect(remote).toEqual({ name: 'storage', url: 's3://bucket/prefix' })
  })
  it('returns a named remote', () => {
    const dvcDir = makeTempDvcDir([
      '[core]',
      '    remote = default',
      "['remote \"default\"']",
      '    url = s3://default-bucket',
      "['remote \"other\"']",
      '    url = s3://other-bucket/path',
    ].join('\n'))
    const remote = getRemote(dvcDir, 'other')
    expect(remote).toEqual({ name: 'other', url: 's3://other-bucket/path' })
  })
  it('throws when no default remote is configured', () => {
    const dvcDir = makeTempDvcDir('[core]\n')
    expect(() => getRemote(dvcDir)).toThrow('No default remote')
  })
  it('throws when named remote is missing', () => {
    const dvcDir = makeTempDvcDir([
      '[core]',
      '    remote = exists',
      "['remote \"exists\"']",
      '    url = s3://bucket',
    ].join('\n'))
    expect(() => getRemote(dvcDir, 'missing')).toThrow('Remote "missing" not found')
  })
})
