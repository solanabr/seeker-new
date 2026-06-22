# Simulator preview preset

Turns a [beeman `solana-mobile-monorepo`][beeman]-shaped Expo project into a
**web-renderable preview bundle** with the mock Mobile Wallet Adapter wired in —
so the app, its react-native-web runtime, the mock wallet, and the Seeker approval
sheet all live inside **one bundle**, served at a URL that the `<Simulator>` device
frame frames in an `<iframe>`.

The preset is the reusable form of what the standalone dev harness proved out. It
keeps the **trusted-template principle**: every adaptation happens here, at the
bundler/runtime boundary — the template is never edited.

## Two halves

| Half | Export | Runs |
|---|---|---|
| Bundler | `createSimulatorViteConfig(opts)` / `simulatorAliases(opts)` | the previewed project's Vite config (Node; Vite transpiles it) |
| Runtime | `mountSimulatorPreview({ AppRoot })` | the previewed project's web entry (`main.tsx`, in the browser bundle) |

The bundler half aliases, at the boundary:

- `react-native` → `react-native-web`
- `@wallet-ui/react-native-kit` → the mock MWA kit (the interception seam)
- `heroui-native` → a shim (the real one needs reanimated/uniwind Metro)
- `@expo/vector-icons` → a shim (the real one needs expo-font/Metro assets)
- plus your `appAliases` (your app's own `@/` / `@template/` → its source)

…and sets `define: { __DEV__, global }` + an empty esbuild `tsconfigRaw`.

## App-root entry contract

A previewed project provides a **root React component** — its screen tree, composed
from its own (now aliased) modules. The preset wraps it in the mock
`MobileWalletProvider` and the `ApprovalSheet`, then `AppRegistry`-registers and
mounts it **frameless** (filling the iframe; the Seeker device frame is drawn
host-side). Pass `provideWallet: false` if your root already mounts its own
(aliased) provider.

> This sprint targets the vendored beeman template directly (see
> `examples/preview/`). The generation/template-engine track scaffolds this entry
> into generated projects later so they are simulator-ready by construction.

## Usage

`vite.config.ts`:

```ts
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { createSimulatorViteConfig } from 'seeker-simulator/preset';

export default defineConfig(
  createSimulatorViteConfig({
    root: '.',
    appAliases: { '@/': resolve(__dirname, 'src') + '/' },
  }),
);
```

`main.tsx`:

```tsx
// Browser entry — note the /web-entry subpath (kept separate from the Node-only
// Vite config above so it never drags Vite into the browser bundle).
import { mountSimulatorPreview } from 'seeker-simulator/preset/web-entry';
import { App } from './app-root';

mountSimulatorPreview({ AppRoot: App });
```

`index.html` needs a full-size `#root`:

```html
<style>html, body, #root { margin: 0; width: 100%; height: 100%; }</style>
<div id="root"></div>
<script type="module" src="./main.tsx"></script>
```

## `preview:simulator`

The script bolt runs inside the WebContainer to serve the preview URL:

```jsonc
{ "scripts": { "preview:simulator": "vite" } }
```

(or `vite --config <preview vite config>` when the preview lives beside the app).
Once it logs a server URL, bolt's `port` event surfaces it and the builder's
`<Simulator app={{ kind: 'bundle-url', url }}>` frames it. A working reference is
this repo's `examples/preview/` + the root `preview:simulator` script.

[beeman]: https://github.com/solana-mobile/solana-mobile-monorepo
