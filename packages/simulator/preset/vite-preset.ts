/**
 * Simulator preview preset — the reusable Vite (react-native-web) configuration.
 *
 * This is the bundler half of the preview preset: it turns a beeman-template-shaped
 * Expo project into a web-renderable bundle by carrying, at the bundler boundary,
 * exactly the aliasing the standalone simulator already proved out — so the
 * **trusted template is never edited** (PRD §7.1). The matching runtime half is
 * `./web-entry` (`mountSimulatorPreview`), and a project wires both plus a
 * `preview:simulator` script (see this directory's README) — the script bolt runs
 * inside the WebContainer to serve the preview URL the `<Simulator>` iframe frames.
 *
 * Aliases applied here:
 *  - `react-native`               → react-native-web        (the whole RN runtime)
 *  - `@wallet-ui/react-native-kit`→ the mock MWA kit         (the interception seam)
 *  - `heroui-native`             → shim (real one needs reanimated/uniwind Metro)
 *  - `@expo/vector-icons`        → shim (real one needs expo-font/Metro assets)
 *  - plus the caller's `appAliases` (e.g. the app's own `@/` / `@template/`)
 *
 * Defines (`__DEV__`, `global`) and the empty esbuild `tsconfigRaw` mirror what the
 * RN code and the template's `tsconfig` (which `extends "expo/tsconfig.base"`)
 * require under Vite. This file is build-time Node code consumed by a project's
 * Vite config; Vite transpiles it on load.
 */

import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import type { Alias, InlineConfig, PluginOption } from 'vite';

const require = createRequire(import.meta.url);
const PRESET_DIR = dirname(fileURLToPath(import.meta.url));

/** The simulator package `src` (mock kit + shims) ships alongside this preset. */
const DEFAULT_SIMULATOR_SRC = resolve(PRESET_DIR, '../src');

/**
 * Absolute react-native-web package root, resolved from the simulator package's
 * own dependency. An absolute replacement lets the `react-native` alias resolve
 * from ANY importer — including app/template files that live outside this
 * package's `node_modules`.
 */
const REACT_NATIVE_WEB = dirname(require.resolve('react-native-web/package.json'));

/**
 * `@solana/kit`'s browser-ESM dist directory. The generated app's feature files
 * and the generated program client import `@solana/kit` (and its
 * `program-client-core` subpath), but those files live OUTSIDE the preview root,
 * so Vite's resolver doesn't see the preview's `node_modules`. Alias both to the
 * resolved browser build (same idea as the `react-native` → react-native-web
 * alias) so on-chain reads/instruction-building resolve under react-native-web.
 */
const SOLANA_KIT_DIST = dirname(require.resolve('@solana/kit'));

export interface SimulatorPresetOptions {
  /** Vite `root` — the directory that holds the preview `index.html`. */
  root?: string;
  /**
   * Path to the simulator package `src` (where the mock kit + shims live).
   * Defaults to the `src` bundled with this preset; override only if relocating.
   */
  simulatorSrc?: string;
  /**
   * The app's own source aliases — map its import prefixes to its source root,
   * e.g. `{ '@/': '/abs/app/', '@template/': '/abs/app/' }`. Applied AFTER the
   * fixed simulator aliases so the scoped seams win over a broad `@/`.
   */
  appAliases?: Record<string, string>;
  /** Dev-server port. Defaults to 5273. */
  port?: number;
  /** Extra Vite plugins appended after `@vitejs/plugin-react`. */
  plugins?: PluginOption[];
}

/**
 * The alias list the preview bundle needs: the fixed simulator seams (RN-web,
 * mock kit, shims) plus the caller's app aliases. Exposed on its own so a project
 * with an existing Vite config can splice it into `resolve.alias`.
 */
export function simulatorAliases(options: SimulatorPresetOptions = {}): Alias[] {
  const sim = options.simulatorSrc ?? DEFAULT_SIMULATOR_SRC;
  const appAliases: Alias[] = Object.entries(options.appAliases ?? {}).map(
    ([find, replacement]) => ({ find, replacement }),
  );
  return [
    {
      find: '@wallet-ui/react-native-kit',
      replacement: resolve(sim, 'wallet/mock-wallet-ui-kit.tsx'),
    },
    { find: 'heroui-native', replacement: resolve(sim, 'shims/heroui-native.tsx') },
    {
      find: '@expo/vector-icons',
      replacement: resolve(sim, 'shims/expo-vector-icons.tsx'),
    },
    // expo-router is Metro/native-only; the shim makes generated screens (which
    // import Link/useRouter/router, with Stack/Tabs in layouts) resolve and render.
    { find: /^expo-router$/, replacement: resolve(sim, 'shims/expo-router.tsx') },
    { find: /^react-native$/, replacement: REACT_NATIVE_WEB },
    // @solana/kit — the app calls its deployed program through this. Subpath first.
    {
      find: /^@solana\/kit\/program-client-core$/,
      replacement: resolve(SOLANA_KIT_DIST, 'program-client-core.browser.mjs'),
    },
    { find: /^@solana\/kit$/, replacement: resolve(SOLANA_KIT_DIST, 'index.browser.mjs') },
    // Data/auth layer: the generated app wires a real oRPC + better-auth + TanStack
    // Query stack against a Hono backend that can't run in the preview (and whose
    // workspace env package isn't installed). These shims mock the boundary so
    // screens render placeholder/empty state — the same "mock the boundary" idea as
    // the wallet seam above. Anchored regexes so each subpath maps exactly.
    { find: /^@tanstack\/react-query$/, replacement: resolve(sim, 'shims/tanstack-react-query.tsx') },
    { find: /^@orpc\/client\/fetch$/, replacement: resolve(sim, 'shims/orpc-client-fetch.ts') },
    { find: /^@orpc\/client$/, replacement: resolve(sim, 'shims/orpc-client.ts') },
    { find: /^@orpc\/tanstack-query$/, replacement: resolve(sim, 'shims/orpc-tanstack-query.ts') },
    { find: /^better-auth\/react$/, replacement: resolve(sim, 'shims/better-auth-react.ts') },
    { find: /^@better-auth\/expo\/client$/, replacement: resolve(sim, 'shims/better-auth-expo-client.ts') },
    { find: /^better-auth-solana\/client$/, replacement: resolve(sim, 'shims/better-auth-solana-client.ts') },
    { find: /^expo-secure-store$/, replacement: resolve(sim, 'shims/expo-secure-store.ts') },
    { find: /^expo-constants$/, replacement: resolve(sim, 'shims/expo-constants.ts') },
    // Kit-expo screens wrap content in SafeAreaView; the real package's web build is
    // fragile under plain RN-web + Vite, and the frameless preview needs no insets.
    {
      find: /^react-native-safe-area-context$/,
      replacement: resolve(sim, 'shims/react-native-safe-area-context.tsx'),
    },
    {
      find: /^@solana-mobile-monorepo\/env\/mobile$/,
      replacement: resolve(sim, 'shims/env-mobile.ts'),
    },
    // App-specific aliases last so a broad `@/` cannot shadow the scoped seams.
    ...appAliases,
  ];
}

/**
 * A complete Vite config for the simulator preview. Spread it into `defineConfig`
 * (optionally extending it). Renders a beeman-template-shaped app under
 * react-native-web with the mock wallet wired at the boundary.
 */
export function createSimulatorViteConfig(
  options: SimulatorPresetOptions = {},
): InlineConfig {
  // The preview's `index.html` lives in `root`, but the app it renders (and the
  // `@/`-aliased source + generated program client) sit in the project ROOT one
  // level up. Without an explicit allow list Vite restricts serving to `root`,
  // so those `../`-resolved files 403. Allow the project root plus the resolved
  // dependency dirs the aliases point at (covers npm-flat and pnpm layouts).
  const projectRoot = options.root ? resolve(options.root, '..') : undefined;
  const fsAllow = [
    projectRoot,
    options.simulatorSrc ?? DEFAULT_SIMULATOR_SRC,
    REACT_NATIVE_WEB,
    SOLANA_KIT_DIST,
  ].filter((entry): entry is string => Boolean(entry));

  return {
    root: options.root,
    plugins: [react(), ...(options.plugins ?? [])],
    resolve: { alias: simulatorAliases(options) },
    define: {
      // The template's RN code references __DEV__ and a Node-ish global.
      __DEV__: 'true',
      global: 'globalThis',
    },
    esbuild: {
      // Stop esbuild from auto-discovering the template's tsconfig.json, which
      // `extends "expo/tsconfig.base"` (not installed here). Path aliasing is
      // handled by `resolve.alias`, so an empty config is all the transform needs.
      tsconfigRaw: '{}',
    },
    optimizeDeps: {
      esbuildOptions: {
        // The dep scanner uses a SEPARATE esbuild pass from the transform above,
        // and without an explicit `tsconfigRaw` it walks up from the preview root
        // and tries to load the generated project's `tsconfig.json` — which
        // `extends` an uninstalled monorepo base, throwing TSConfckParseError and
        // killing the dev server right after it opens its port. Give the scanner
        // the same empty config so it never reads the parent tsconfig.
        tsconfigRaw: '{}',
      },
    },
    server: {
      port: options.port ?? 5273,
      host: true,
      fs: { allow: fsAllow },
    },
  };
}
