/**
 * Seeker simulator — builder-side consumption seam.
 *
 * The builder hosts the Seeker device frame around a preview URL (the Vite
 * react-native-web dev server that the simulator preview preset runs inside the
 * WebContainer). It imports ONLY from `seeker-simulator/iframe` — the
 * react-native-web-free entry — so the device-frame chrome and the iframe
 * rendering backend come in, but **react-native-web never enters the builder
 * bundle**. All RN-web rendering, the mock wallet, and the approval sheet live
 * inside the previewed bundle, behind the iframe boundary (which also isolates
 * the React 18 shell / React 19 app split).
 *
 * This module is the single import point for that surface; the preview pane
 * mounts `<Simulator>` behind a client-only boundary (the device frame touches
 * the DOM and must not SSR).
 */

export {
  Simulator,
  IframeBackend,
  SEEKER_DEVICE,
} from 'seeker-simulator/iframe';

export type {
  SimulatorProps,
  IframeBackendOptions,
  RenderingBackend,
  AppSource,
  DeviceProfile,
} from 'seeker-simulator/iframe';

import { IframeBackend, type IframeBackendOptions } from 'seeker-simulator/iframe';

/**
 * Build a fresh iframe rendering backend for the preview pane. Each mounted
 * `<Simulator>` gets its own engine instance.
 */
export function createPreviewBackend(options?: IframeBackendOptions): IframeBackend {
  return new IframeBackend(options);
}
