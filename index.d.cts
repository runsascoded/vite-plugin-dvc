import { Plugin } from 'vite';

interface DvcPluginOptions {
    /** Path to .dvc/ directory (default: auto-detect walking up from vite root) */
    dvcDir?: string;
    /** Glob pattern for .dvc files (default: '**\/*.dvc') */
    glob?: string;
    /** Search root for .dvc files, relative to vite root (default: '.') */
    root?: string;
    /** Remote name (default: default from .dvc/config) */
    remote?: string;
    /** Override base URL (e.g. CloudFront domain) */
    baseUrl?: string;
    /** Dev mode behavior: 'local' returns relative paths, 's3' returns S3 URLs (default: 'local'). Overridden by VITE_PLUGIN_DVC_DEV env var. */
    dev?: 'local' | 's3';
}
declare function dvcPlugin(options?: DvcPluginOptions): Plugin;

export { type DvcPluginOptions, dvcPlugin as default };
