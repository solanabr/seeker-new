/**
 * RenderingBackend — the contract every simulator rendering engine implements.
 *
 * This interface is the single seam the rest of the simulator depends on.
 * Callers (the `<Simulator>` component, the builder preview pane, tests) talk to
 * a `RenderingBackend`, never to a concrete engine. That is deliberate: the
 * hackathon ships a react-native-web engine (`WebRenderBackend`), but the
 * production target is a streamed cloud Android emulator. Swapping engines must
 * not touch a single caller — only the object handed to `<Simulator backend>`.
 *
 * Keep this file engine-agnostic: nothing here may import react-native-web,
 * react-dom, or any web-only API.
 */

import type { ComponentType } from 'react';

/** Stable identifier for a backend implementation. */
export type BackendId = 'web-rn' | 'cloud-emulator' | (string & {});

/** Safe-area insets in logical (CSS) pixels. */
export interface SafeAreaInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** Physical/logical description of the simulated device screen. */
export interface DeviceProfile {
  /** Stable id, e.g. `"seeker"`. */
  id: string;
  /** Display name, e.g. `"Solana Seeker"`. */
  name: string;
  /** Logical screen width in CSS pixels. */
  width: number;
  /** Logical screen height in CSS pixels. */
  height: number;
  /** Device pixel ratio of the simulated screen. */
  pixelRatio: number;
  /** Safe-area insets (status bar / nav bar / cutout) in logical pixels. */
  safeAreaInsets: SafeAreaInsets;
}

/**
 * What to render, described in a backend-neutral way.
 *
 * Each backend supports a subset of `kind`s and throws on the rest. This union
 * is the extension point for the emulator swap: `WebRenderBackend` handles
 * `react-component`, `IframeBackend` handles `bundle-url` (a preview URL), and a
 * future cloud emulator handles `native-build`. New kinds can be added without
 * breaking existing callers.
 */
export type AppSource =
  | {
      kind: 'react-component';
      /** App key used by RN `AppRegistry.registerComponent`. */
      appKey: string;
      /** Root component of the RN/Expo app to render. */
      component: ComponentType<Record<string, unknown>>;
      /** Initial props passed to the root component. */
      initialProps?: Record<string, unknown>;
    }
  | {
      kind: 'bundle-url';
      /**
       * URL of an already-running preview to frame in an `<iframe>` — e.g. the
       * Vite react-native-web dev server the preview preset serves inside bolt's
       * WebContainer. Rendered by {@link IframeBackend}.
       */
      url: string;
      appKey?: string;
    }
  | {
      kind: 'native-build';
      /** URL of a native build artifact (APK) for the cloud emulator backend. */
      artifactUrl: string;
    };

/** Events a backend can emit over its lifecycle. */
export interface BackendEventMap {
  mounted: { device: DeviceProfile };
  'app-loaded': { source: AppSource };
  unmounted: void;
  error: { error: Error };
}

/** Unsubscribe handle returned by {@link RenderingBackend.on}. */
export type Unsubscribe = () => void;

/**
 * The swappable rendering engine contract.
 *
 * Lifecycle: `mount(host)` → `loadApp(source)` (optional, repeatable) →
 * `unmount()`. Implementations may be async; callers always `await` the result.
 */
export interface RenderingBackend {
  /** Which engine this is — for diagnostics and feature detection. */
  readonly id: BackendId;

  /** Current device profile the backend renders at. */
  getDevice(): DeviceProfile;

  /** Change the simulated device. May be ignored until the next `mount`. */
  setDevice(device: DeviceProfile): void;

  /** Attach the backend to a DOM host node and show an (empty) screen. */
  mount(host: HTMLElement): void | Promise<void>;

  /** Load (or replace) the app being rendered. Throws on an unsupported kind. */
  loadApp(source: AppSource): void | Promise<void>;

  /** Detach and release all resources. Safe to call more than once. */
  unmount(): void | Promise<void>;

  /** Subscribe to a lifecycle event; returns an unsubscribe handle. */
  on<E extends keyof BackendEventMap>(
    event: E,
    handler: (payload: BackendEventMap[E]) => void,
  ): Unsubscribe;
}

/**
 * Solana Seeker device profile (approximate: 6.36" FHD+, 1080×2400, 20:9).
 * Logical pixels are derived from the physical resolution and pixel ratio.
 */
export const SEEKER_DEVICE: DeviceProfile = {
  id: 'seeker',
  name: 'Solana Seeker',
  width: 424,
  height: 942,
  pixelRatio: 2.55,
  safeAreaInsets: { top: 28, right: 0, bottom: 20, left: 0 },
};
