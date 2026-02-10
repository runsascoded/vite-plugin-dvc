declare module 'virtual:dvc-data' {
  /** Map of file path → resolved URL (local path in dev, S3 URL in build) */
  export const urls: Record<string, string>
  /** Look up a path in the URL map; returns the input path if not found */
  export function resolve(path: string): string
}
