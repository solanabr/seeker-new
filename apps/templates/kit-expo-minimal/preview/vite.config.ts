/**
 * Seeker preview — runs the generated kit-expo-minimal app under react-native-web
 * with the mock wallet, served at a URL the builder's device frame iframes. Generic:
 * the `@/` alias points at this project's own root (kit-expo-minimal uses `@/* → ./*`),
 * so it is identical for every generated app. The simulator preset + source live in
 * `./sim` (copied in at generation time). The preview runs as its own isolated package
 * (its own install) — it is not part of the monorepo workspace.
 */

import { resolve } from 'node:path';

import { defineConfig } from 'vite';

import { createSimulatorViteConfig } from './sim/preset';

// The flat Expo app lives one level up from this preview directory.
const ROOT = resolve(__dirname, '..');

export default defineConfig(
  createSimulatorViteConfig({
    root: __dirname,
    appAliases: {
      '@/': `${ROOT}/`,
    },
    port: 5275,
  }),
);
