/**
 * seeker-simulator/iframe — the react-native-web-free entry point.
 *
 * This is what a web host (the seeker.new builder) imports. It exposes only the
 * device-frame chrome (`<Simulator>`), the {@link IframeBackend} that frames a
 * preview URL, and the engine-agnostic {@link RenderingBackend} contract. None of
 * these statically reference react-native-web, so importing from
 * `seeker-simulator/iframe` keeps **react-native-web out of the consumer's
 * bundle** — the whole reason this entry exists.
 *
 * The full surface (the react-native-web `WebRenderBackend`, the mock wallet, the
 * approval sheet) lives behind the package root (`seeker-simulator`) and is meant
 * to run inside the WebContainer preview bundle, never in the host shell. Keep
 * those off this entry.
 */

// Device-frame component (host-side chrome). Its default react-native-web engine
// is loaded via a dynamic import, so it is code-split out of this entry's graph.
export { Simulator } from './Simulator';
export type { SimulatorProps } from './Simulator';

// The iframe engine + the contract it implements.
export { IframeBackend } from './backend/IframeBackend';
export type { IframeBackendOptions } from './backend/IframeBackend';

export type {
  RenderingBackend,
  BackendId,
  BackendEventMap,
  DeviceProfile,
  SafeAreaInsets,
  AppSource,
  Unsubscribe,
} from './backend/RenderingBackend';
export { SEEKER_DEVICE } from './backend/RenderingBackend';
