# vite-plugin-dvc

Vite plugin that reads [DVC] `.dvc` files at build time and exposes a `virtual:dvc-data` module mapping tracked file paths to their resolved URLs.

- **Dev mode** (`vite serve`): returns local relative paths (e.g. `/data.geojson`)
- **Build mode** (`vite build`): returns S3 HTTPS URLs pointing at the DVC cache

## Install

```bash
pnpm add vite-plugin-dvc
```

## Usage

```ts
// vite.config.ts
import dvc from 'vite-plugin-dvc'

export default defineConfig({
  plugins: [dvc({ root: 'public' })],
})
```

```ts
// app code
import { resolve } from 'virtual:dvc-data'

fetch(resolve('my-data.geojson'))
```

### TypeScript

Add a reference to `vite-plugin-dvc/client` in your `env.d.ts` (or any `.d.ts` file included by your `tsconfig.json`):

```ts
/// <reference types="vite-plugin-dvc/client" />
```

This provides type declarations for the `virtual:dvc-data` module.

## Options

```ts
interface DvcPluginOptions {
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
```

## Virtual module API

The `virtual:dvc-data` module exports:

- **`urls`**: `Record<string, string>` — map of file path to resolved URL
- **`resolve(path: string): string`** — look up a path in the URL map; returns the input path unchanged if not found

## How it works

1. The plugin walks up from the Vite root to find a `.dvc/` directory
2. Reads `.dvc/config` to get the S3 remote URL
3. Globs for `*.dvc` files, parses their YAML to extract `md5` hashes and file paths
4. In dev mode (default), maps each file to a local relative path (`/filename.ext`)
5. In build mode, maps each file to its S3 DVC cache URL (`https://{bucket}.s3.amazonaws.com/.../files/md5/{xx}/{rest}`)

[DVC]: https://dvc.org
