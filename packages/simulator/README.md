# seeker-simulator

A browser **device-frame simulator** for Solana Mobile (Expo / React Native) apps.

It renders an RN/Expo app inside a Seeker device frame in the browser and is built
to host an in-browser wallet flow (mock Mobile Wallet Adapter → approval sheet →
sign → tx result). The rendering engine sits behind a **swappable interface**, so
the same component works with the hackathon's react-native-web engine today and a
streamed cloud Android emulator later — without touching callers.

> Status: early but end-to-end. This package ships the rendering foundation (the
> backend interface, a react-native-web engine, the `<Simulator>` frame), a **mock
> Mobile Wallet Adapter** layer, and a **Seeker approval sheet**. The bundled dev
> harness renders the **real** beeman Solana-Mobile template app and runs the full
> wallet flow — connect → approval → sign → tx-result — entirely in the browser
> with no cluster and no real secrets.

MIT licensed.

## Usage (internal package)

This lives inside the seeker.new monorepo at `packages/simulator` and is consumed
**by source** — there is no build step and it is not published to npm. The builder
(`apps/builder`) links it with a `file:` dependency and imports the
react-native-web-free entry:

```ts
import { Simulator, IframeBackend } from 'seeker-simulator/iframe';
```

`react` and `react-dom` (>=18) are peer dependencies. `react-native-web` is a
direct dependency (used by the web rendering engine, loaded only inside the
preview bundle).

## Quick start

```tsx
import { Simulator } from 'seeker-simulator';

export function Preview() {
  // An empty device frame (no app loaded yet):
  return <Simulator onReady={(b) => console.log(b.id, b.getDevice())} />;
}
```

To render an app, pass an `AppSource` (the react-native-web engine renders the
`react-component` kind):

```tsx
import { Simulator } from 'seeker-simulator';
import App from './my-rn-app'; // RN/Expo root component

<Simulator app={{ kind: 'react-component', appKey: 'main', component: App }} />;
```

## Public API

Everything below is exported from the package root (`seeker-simulator`). Callers
should depend on the **`RenderingBackend` interface**, never on a concrete engine.

### `<Simulator>`

The device-frame component. It draws the chrome and drives a backend through its
lifecycle (mount → load app → unmount).

| Prop        | Type                                  | Description |
|-------------|---------------------------------------|-------------|
| `backend`   | `RenderingBackend`                    | Engine to host. Defaults to a new `WebRenderBackend`. |
| `app`       | `AppSource`                           | App to render. Omit for an empty device. |
| `device`    | `DeviceProfile`                       | Device/frame to draw. Defaults to `SEEKER_DEVICE`. |
| `wallet`    | `WalletBridge`                        | Mock-wallet layer (approval-sheet overlay + request hooks). |
| `scale`     | `number`                              | Uniform scale on the frame (e.g. `0.75` to fit a panel). |
| `onReady`   | `(backend: RenderingBackend) => void` | Fired once mounted (and app loaded, if provided). |
| `onError`   | `(error: Error) => void`              | Fired if mount/load throws. |

### `RenderingBackend`

The swappable rendering contract — the seam that lets the engine change without
touching callers.

```ts
interface RenderingBackend {
  readonly id: BackendId;
  getDevice(): DeviceProfile;
  setDevice(device: DeviceProfile): void;
  mount(host: HTMLElement): void | Promise<void>;
  loadApp(source: AppSource): void | Promise<void>;
  unmount(): void | Promise<void>;
  on<E extends keyof BackendEventMap>(event: E, handler: (p: BackendEventMap[E]) => void): Unsubscribe;
}
```

- **`AppSource`** — a backend-neutral description of *what* to render. The web
  engine handles `{ kind: 'react-component', ... }` (and, later, `bundle-url`); a
  cloud emulator engine would handle `{ kind: 'native-build', artifactUrl }`. A
  backend throws on a kind it does not support.
- **`BackendEventMap`** — lifecycle events: `mounted`, `app-loaded`, `unmounted`,
  `error`.
- **`DeviceProfile`** — logical screen size, pixel ratio, and safe-area insets.
  `SEEKER_DEVICE` is the bundled Solana Seeker profile.

### `WebRenderBackend`

The react-native-web engine — **one implementation** of `RenderingBackend`. It
boots an RN/Expo app into a DOM node via `AppRegistry.runApplication` (RN-web
renders through react-dom). Construct with an optional device override:

```ts
import { WebRenderBackend, SEEKER_DEVICE } from 'seeker-simulator';

const backend = new WebRenderBackend({ device: SEEKER_DEVICE });
```

Pass it to `<Simulator backend={backend} />`, or use it directly.

### Mock wallet layer (`createMockWallet`, `MockMwaProvider`, `ApprovalSheet`)

The in-browser mock Mobile Wallet Adapter. It lets a rendered app run a realistic
Seeker wallet interaction with **no cluster, no real keys, no seed phrases** — all
requests resolve locally against an **ephemeral `@solana/kit` keypair** (a
non-extractable `CryptoKeyPair`, never persisted, logged, or printed).

```tsx
import { Simulator, createMockWallet } from 'seeker-simulator';

// One call: a shared controller + a bridge that renders the approval sheet.
const { controller, bridge } = createMockWallet({ accountLabel: 'Seeker (Simulated)' });

<Simulator app={templateApp} wallet={bridge} />;
```

- **`MockMwaProvider`** — the framework-agnostic engine. It exposes an MWA-shaped
  surface (`connect`, `signMessage`, `signTransaction`, `signAndSendTransaction`),
  raises an approval request for each, and resolves it after the user approves /
  rejects in the sheet. Subscribe with `controller.subscribe(state => …)`.
- **`ApprovalSheet`** — the Seeker-style approval overlay (connect-approval →
  transaction approval → signing → tx-result; approve **and** reject paths). It is
  simulator chrome (react-dom), driven entirely by a `MockMwaProvider`.
- **The interception seam** — the mock is also exported as a drop-in
  `@wallet-ui/react-native-kit` (`MobileWalletProvider`, `useMobileWallet`,
  `createSolanaDevnet`). Alias that package name to
  `seeker-simulator/.../mock-wallet-ui-kit` in your bundler and an **unmodified**
  template's MWA calls route through the mock automatically (see the harness
  `vite.config.ts`).

The method/return shapes mirror the real `@wallet-ui/react-native-kit`, so a later
sprint can swap local resolution for real devnet signing without touching the
template or the approval UI.

### `WalletBridge`

The low-level seam `<Simulator wallet={...}>` consumes: `renderOverlay()` draws an
overlay above the screen, and `onRequest` receives `WalletRequest`s. `createMockWallet`
returns one of these wired to the approval sheet; you rarely build it by hand.

## Rendering the real beeman template (RN-web aliasing + shim list)

The simulator renders the **real, unmodified** beeman Solana-Mobile template
(`apps/templates/solana-mobile/apps/mobile`, Expo 55 / RN 0.83 / React 19). Per the
trusted-template principle, the template source is **never edited** — everything
that makes it boot under react-native-web is done at the bundler boundary via
aliases (see the harness `vite.config.ts`):

| Import the template uses        | Aliased to                          | Why |
|---------------------------------|-------------------------------------|-----|
| `react-native`                  | `react-native-web`                  | RN runtime in the browser |
| `@wallet-ui/react-native-kit`   | the mock MWA kit (above)            | the wallet interception seam |
| `heroui-native`                 | `src/shims/heroui-native.tsx`       | real one needs reanimated worklets + the uniwind Metro transform |
| `@expo/vector-icons`            | `src/shims/expo-vector-icons.tsx`   | real one needs `expo-font` / Metro asset resolution |
| `expo-router`                   | `src/shims/expo-router.tsx`         | Metro/native-only file-based routing; shim makes `Link`/`useRouter`/`Stack`/`Tabs` resolve |
| `@tanstack/react-query`         | `src/shims/tanstack-react-query.tsx`| provider-less, network-less query/mutation hooks (preview renders the entry screen without the app's `QueryClientProvider`) |
| `@orpc/client` · `@orpc/client/fetch` · `@orpc/tanstack-query` | `src/shims/orpc-*.ts` | no backend in the preview; produce placeholder query/mutation options |
| `better-auth/react` · `@better-auth/expo/client` · `better-auth-solana/client` | `src/shims/better-auth-*.ts` | signed-out session + inert auth actions; `createSIWSInput` for the mock sign-in |
| `expo-secure-store` · `expo-constants` | `src/shims/expo-secure-store.ts` · `expo-constants.ts` | native modules absent under RN-web; in-memory store + minimal `Constants` |
| `@solana-mobile-monorepo/env/mobile` | `src/shims/env-mobile.ts`     | workspace package not installed in the isolated preview; supplies a configured API URL so `getApiUrl()` doesn't throw |
| `@/*`                           | the template's app root             | the template's internal path alias |

**Documented shims** (web stand-ins for native/Metro-only modules; structurally
faithful, not pixel-perfect):

- **`heroui-native`** → a react-native(-web) reimplementation of the surface the
  rendered components use (`Card` + slots, `Button` + `Label`, `Spinner`,
  `useThemeColor`, `cn`) with a dark Seeker theme.
- **`@expo/vector-icons`** → maps the Ionicons glyph names the template uses to
  Unicode symbols.
- **data/auth layer** (`@tanstack/react-query`, `@orpc/*`, `better-auth/*`,
  `expo-secure-store`, `expo-constants`, `@solana-mobile-monorepo/env/mobile`) →
  inert, network-less stand-ins so generated entry screens that wire the real
  oRPC + better-auth + TanStack stack against a Hono backend still render their
  placeholder/empty state. Queries/mutations resolve to placeholder data and the
  auth client reports a signed-out session; nothing reaches the (absent) backend.
  This is the same "mock the boundary" idea as the wallet seam — see
  `preset/vite-preset.ts` for the alias list.

**Native-only / out-of-scope this sprint** (not shimmed): `react-native-quick-crypto`
and `uniwind`'s Metro `className` transform. The data layer above is *mocked*, not
backed by a server, so SIWS sign-in and todos exercise the UI flow against the mock
wallet but do not perform real network calls.

## Architecture: built for the engine swap

The PRD calls for a v2 cloud Android emulator backend. To make that a drop-in
swap, the rule is: **callers depend on `RenderingBackend`, never on
`WebRenderBackend`.** A new engine implements the interface, supports the relevant
`AppSource` kinds, and is passed via `<Simulator backend>`. Nothing else changes.

```
<Simulator>  ──uses──▶  RenderingBackend (interface)
                              ▲              ▲
                     WebRenderBackend   CloudEmulatorBackend
                     (react-native-web)  (future, streamed)
```

`RenderingBackend.ts` is deliberately engine-agnostic — it imports no web-only or
react-native-web APIs.

## Dev harness

A standalone harness (`examples/dev-harness`) mounts `<Simulator>` rendering the
real beeman template home screen wired to the mock wallet — no builder needed:

```bash
pnpm dev          # serve at http://localhost:5273
```

Exercise the full flow in the browser:

1. Tap **Connect** → approve in the Seeker sheet → the template card shows the
   authorized account.
2. Use the dashed **Simulator demo** row to sign a message or send a (mock)
   transaction → approval sheet → signing → tx-result (a real ed25519 signature
   from the ephemeral keypair).
3. Try **Reject** — the app receives a user-rejection.

## Scripts

| Script               | What it does |
|----------------------|--------------|
| `typecheck`          | `tsc --noEmit` over `src` + `examples`. |
| `dev`                | Vite dev server for the harness. |
| `preview:simulator`  | Serve the frameless preview entry the builder iframes. |

## License & lineage

MIT. Kept clean on the bolt.diy MIT lineage — **no GPL/AGPL dependencies** — so it
can be released as standalone ecosystem OSS.
