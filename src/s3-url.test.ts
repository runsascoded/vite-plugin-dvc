import { describe, it, expect } from 'vitest'
import { s3ToHttps, cacheUrl } from './s3-url.js'

describe('s3ToHttps', () => {
  it('converts s3:// URL with prefix to HTTPS', () => {
    expect(s3ToHttps('s3://my-bucket/some/prefix')).toBe(
      'https://my-bucket.s3.amazonaws.com/some/prefix'
    )
  })
  it('converts s3:// URL with no prefix', () => {
    expect(s3ToHttps('s3://my-bucket')).toBe(
      'https://my-bucket.s3.amazonaws.com'
    )
  })
  it('strips trailing slash from prefix', () => {
    expect(s3ToHttps('s3://my-bucket/prefix/')).toBe(
      'https://my-bucket.s3.amazonaws.com/prefix'
    )
  })
  it('throws on invalid URL', () => {
    expect(() => s3ToHttps('https://not-s3.com')).toThrow('Invalid S3 URL')
  })
})

describe('cacheUrl', () => {
  it('builds DVC cache URL from base and md5', () => {
    expect(cacheUrl('https://my-bucket.s3.amazonaws.com', 'd1afd2d0abcdef1234567890')).toBe(
      'https://my-bucket.s3.amazonaws.com/files/md5/d1/afd2d0abcdef1234567890'
    )
  })
  it('works with a prefix in the base URL', () => {
    expect(cacheUrl('https://my-bucket.s3.amazonaws.com/data', 'abcdef1234567890')).toBe(
      'https://my-bucket.s3.amazonaws.com/data/files/md5/ab/cdef1234567890'
    )
  })
})
