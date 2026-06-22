/**
 * WebRenderBackend — the hackathon rendering engine.
 *
 * Renders an RN/Expo app in the browser via react-native-web. RN-web components
 * render through react-dom, so `AppRegistry.runApplication` mounts the app into a
 * plain DOM node — exactly how an Expo `index.js` boots on native, but targeting
 * a `<div>` instead of a native root view.
 *
 * This is *one* implementation of {@link RenderingBackend}. Nothing outside this
 * file should import it by type; callers depend on the interface so the future
 * cloud Android emulator engine can drop in unchanged.
 *
 * Scope note: T01 establishes the engine and an empty-screen mount. The full
 * react-native-web aliasing/polyfills needed to render the real beeman template
 * land in T02 — `loadApp` already accepts a `react-component` source today.
 */

/// <reference path="../types/react-native-web.d.ts" />

import { AppRegistry } from 'react-native-web';

import {
  SEEKER_DEVICE,
  type AppSource,
  type BackendEventMap,
  type BackendId,
  type DeviceProfile,
  type RenderingBackend,
  type Unsubscribe,
} from './RenderingBackend';

export interface WebRenderBackendOptions {
  /** Device profile to render at. Defaults to {@link SEEKER_DEVICE}. */
  device?: DeviceProfile;
}

type Listeners = {
  [E in keyof BackendEventMap]: Set<(payload: BackendEventMap[E]) => void>;
};

/** Monotonic key so each mounted app registers under a unique AppRegistry id. */
let appKeySeq = 0;

export class WebRenderBackend implements RenderingBackend {
  readonly id: BackendId = 'web-rn';

  private device: DeviceProfile;
  private host: HTMLElement | null = null;
  private rootTag: HTMLDivElement | null = null;
  private currentAppKey: string | null = null;
  private readonly listeners: Listeners = {
    mounted: new Set(),
    'app-loaded': new Set(),
    unmounted: new Set(),
    error: new Set(),
  };

  constructor(options: WebRenderBackendOptions = {}) {
    this.device = options.device ?? SEEKER_DEVICE;
  }

  getDevice(): DeviceProfile {
    return this.device;
  }

  setDevice(device: DeviceProfile): void {
    this.device = device;
  }

  mount(host: HTMLElement): void {
    if (this.host) {
      this.unmount();
    }
    this.host = host;

    const rootTag = host.ownerDocument.createElement('div');
    rootTag.style.width = '100%';
    rootTag.style.height = '100%';
    rootTag.style.overflow = 'hidden';
    host.appendChild(rootTag);
    this.rootTag = rootTag;

    // Show an empty screen until an app is loaded so the device frame is never
    // blank-with-nothing. T01's dev harness mounts the backend with no app.
    this.renderEmptyScreen();

    this.emit('mounted', { device: this.device });
  }

  loadApp(source: AppSource): void {
    if (!this.rootTag) {
      throw new Error('WebRenderBackend.loadApp called before mount().');
    }
    if (source.kind !== 'react-component') {
      throw new Error(
        `WebRenderBackend does not support app source kind "${source.kind}". ` +
          'The react-native-web engine renders "react-component"; "native-build" ' +
          'is for the cloud emulator backend.',
      );
    }

    try {
      const appKey = `${source.appKey || 'app'}-${appKeySeq++}`;
      AppRegistry.registerComponent(appKey, () => source.component);
      AppRegistry.runApplication(appKey, {
        rootTag: this.rootTag,
        initialProps: source.initialProps ?? {},
      });
      this.currentAppKey = appKey;
      this.emit('app-loaded', { source });
    } catch (error) {
      const wrapped = error instanceof Error ? error : new Error(String(error));
      this.emit('error', { error: wrapped });
      throw wrapped;
    }
  }

  unmount(): void {
    if (this.rootTag) {
      try {
        AppRegistry.unmountApplicationComponentAtRootTag(this.rootTag);
      } catch {
        // The empty-screen placeholder is not an AppRegistry app; ignore.
      }
      this.rootTag.remove();
    }
    this.rootTag = null;
    this.host = null;
    this.currentAppKey = null;
    this.emit('unmounted', undefined);
  }

  on<E extends keyof BackendEventMap>(
    event: E,
    handler: (payload: BackendEventMap[E]) => void,
  ): Unsubscribe {
    this.listeners[event].add(handler);
    return () => {
      this.listeners[event].delete(handler);
    };
  }

  private renderEmptyScreen(): void {
    if (!this.rootTag) {
      return;
    }
    this.rootTag.replaceChildren();
    this.rootTag.style.background = '#000';
  }

  private emit<E extends keyof BackendEventMap>(
    event: E,
    payload: BackendEventMap[E],
  ): void {
    for (const handler of this.listeners[event]) {
      handler(payload);
    }
  }
}
