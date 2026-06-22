/**
 * PayFriend preview Vite config — the preset, pointed at the GENERATED project.
 *
 * Identical in shape to examples/preview/vite.config.ts, except `appAliases`
 * point `@template/` + `@/` at `generated/payfriend/apps/mobile` instead of the
 * vendored template. This is exactly what a generated project's own preview
 * config would carry (the generation/template-engine track emits it); here it is
 * written by hand to prove a real generated app previews itself in the simulator.
 */

import { resolve } from 'node:path';

import { defineConfig } from 'vite';

import { createSimulatorViteConfig } from '../../preset';

const PAYFRIEND = resolve(
  __dirname,
  '../../../../generated/payfriend/apps/mobile',
);

const config = createSimulatorViteConfig({
  root: 'examples/preview-payfriend',
  appAliases: {
    '@template/': `${PAYFRIEND}/`,
    '@/': `${PAYFRIEND}/`,
  },
  port: 5275,
});

export default defineConfig({
  ...config,
  server: {
    ...config.server,
    // COEP/CORP so the standalone preview can be framed by the builder during
    // verification (the builder host is cross-origin isolated for the
    // WebContainer's SharedArrayBuffer). In the real flow the preview runs inside
    // the WebContainer and is served same-origin, so this does not apply there.
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Resource-Policy': 'cross-origin',
    },
  },
});
