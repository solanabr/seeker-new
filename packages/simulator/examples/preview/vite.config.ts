/**
 * Preview Vite config — the reference a generated/previewed project mirrors.
 *
 * It is just `createSimulatorViteConfig` from the preset, pointed at the vendored
 * beeman template via `appAliases` (`@template/` + the template's own internal
 * `@/`). All RN-web aliasing / defines / esbuild handling come from the preset;
 * nothing about the template is touched.
 */

import { resolve } from 'node:path';

import { defineConfig } from 'vite';

import { createSimulatorViteConfig } from '../../preset';

const TEMPLATE = resolve(
  __dirname,
  '../../../../apps/templates/solana-mobile/apps/mobile',
);

const config = createSimulatorViteConfig({
  root: 'examples/preview',
  appAliases: {
    '@template/': `${TEMPLATE}/`,
    '@/': `${TEMPLATE}/`,
  },
  port: 5274,
});

export default defineConfig({
  ...config,
  server: {
    ...config.server,
    // The builder host is cross-origin isolated (it sets COEP `require-corp` for
    // the WebContainer's SharedArrayBuffer). A cross-origin iframe is blocked
    // under that policy unless it opts in too. These headers let this standalone
    // preview be framed by the builder during local verification. In the real
    // flow the preview runs *inside* the WebContainer and bolt's proxy serves it
    // same-origin, so this config does not apply there.
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Resource-Policy': 'cross-origin',
    },
  },
});
