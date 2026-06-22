import { resolve } from 'node:path';

import { defineConfig } from 'vite';

import { createSimulatorViteConfig } from './preset';

/**
 * Dev-harness bundling config. Serves examples/dev-harness so the simulator
 * renders the REAL beeman template app standalone in a browser (the rich,
 * device-framed interactive demo), with no builder dependency.
 *
 * It dogfoods the reusable **simulator preview preset** (`./preset`): all the
 * react-native-web aliasing, `__DEV__`/`global` defines, and empty esbuild
 * tsconfig come from `createSimulatorViteConfig`. The only harness-specific input
 * is `appAliases`, pointing the template's `@template/` + internal `@/` imports at
 * the vendored mobile-app source — rendered unmodified (trusted-template
 * principle, PRD §7.1). The shim list is documented in preset/README.md.
 *
 * The frameless preview entry the builder iframes lives in examples/preview/
 * (`pnpm preview:simulator`); this harness keeps the in-page `<Simulator>` device
 * frame for standalone visual development.
 */

const TEMPLATE = resolve(
  __dirname,
  '../../apps/templates/solana-mobile/apps/mobile',
);

export default defineConfig(
  createSimulatorViteConfig({
    root: 'examples/dev-harness',
    appAliases: {
      '@template/': `${TEMPLATE}/`,
      '@/': `${TEMPLATE}/`,
    },
    port: 5273,
  }),
);
