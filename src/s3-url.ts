/**
 * Convert an s3:// URL to an HTTPS URL and build DVC cache URLs.
 *
 * DVC stores cached files at: {remote}/files/md5/{XX}/{rest}
 * where XX is the first 2 chars of the md5 hash, and rest is the remainder.
 */

export function s3ToHttps(s3Url: string): string {
  const match = s3Url.match(/^s3:\/\/([^/]+)\/?(.*?)$/)
  if (!match) throw new Error(`Invalid S3 URL: ${s3Url}`)
  const [, bucket, prefix] = match
  const trimmed = prefix.replace(/\/$/, '')
  return trimmed
    ? `https://${bucket}.s3.amazonaws.com/${trimmed}`
    : `https://${bucket}.s3.amazonaws.com`
}

export function cacheUrl(remoteHttpsUrl: string, md5: string): string {
  const xx = md5.slice(0, 2)
  const rest = md5.slice(2)
  return `${remoteHttpsUrl}/files/md5/${xx}/${rest}`
}
