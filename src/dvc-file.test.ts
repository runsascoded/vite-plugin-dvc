import { describe, it, expect } from 'vitest'
import { mkdtempSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { parseDvcFile } from './dvc-file.js'

function makeTempDvcFile(yamlContent: string): string {
  const tmp = mkdtempSync(join(tmpdir(), 'dvc-test-'))
  const filePath = join(tmp, 'data.dvc')
  writeFileSync(filePath, yamlContent)
  return filePath
}

describe('parseDvcFile', () => {
  it('parses a .dvc file with a single output', () => {
    const path = makeTempDvcFile([
      'outs:',
      '- md5: d1afd2d0abcdef1234567890',
      '  size: 12345',
      '  hash: md5',
      '  path: data.geojson',
    ].join('\n'))
    const outs = parseDvcFile(path)
    expect(outs).toEqual([{
      md5: 'd1afd2d0abcdef1234567890',
      size: 12345,
      hash: 'md5',
      path: 'data.geojson',
    }])
  })
  it('parses multiple outputs', () => {
    const path = makeTempDvcFile([
      'outs:',
      '- md5: aaa111',
      '  size: 100',
      '  hash: md5',
      '  path: a.csv',
      '- md5: bbb222',
      '  size: 200',
      '  hash: md5',
      '  path: b.csv',
    ].join('\n'))
    const outs = parseDvcFile(path)
    expect(outs).toHaveLength(2)
    expect(outs[0].path).toBe('a.csv')
    expect(outs[1].path).toBe('b.csv')
  })
  it('skips directory entries (md5 ending with .dir)', () => {
    const path = makeTempDvcFile([
      'outs:',
      '- md5: abc123.dir',
      '  size: 999',
      '  hash: md5',
      '  path: mydir',
      '- md5: def456',
      '  size: 500',
      '  hash: md5',
      '  path: file.txt',
    ].join('\n'))
    const outs = parseDvcFile(path)
    expect(outs).toEqual([{
      md5: 'def456',
      size: 500,
      hash: 'md5',
      path: 'file.txt',
    }])
  })
  it('returns empty array when no outs', () => {
    const path = makeTempDvcFile('md5: abc123\n')
    expect(parseDvcFile(path)).toEqual([])
  })
})
