/**
 * IframeBackend — renders a preview *URL* in the device frame via an `<iframe>`.
 *
 * This is the web sibling of {@link WebRenderBackend}. Where `WebRenderBackend`
 * runs react-native-web *in this same document*, `IframeBackend` renders nothing
 * itself — it points an `<iframe>` at a URL that already hosts the app (the Vite
 * react-native-web dev server the simulator preview preset runs inside bolt's
 * WebContainer). The app, its react-native-web runtime, the mock wallet, and the
 * approval sheet all live *inside that iframe's bundle*; this backend only frames
 * it.
 *
 * Why this matters for the builder: importing `IframeBackend` (and `<Simulator>`)
 * pulls in **no react-native-web**. All the heavy RN-web rendering is isolated
 * behind the iframe boundary — which is also what isolates the React 18 (builder
 * shell) / React 19 (app bundle) split. The builder bundle stays RN-web-free; the
 * cost the architecture exists to avoid.
 *
 * It implements the same {@link RenderingBackend} contract as every other engine,
 * so `<Simulator backend={new IframeBackend()} app={{ kind: 'bundle-url', url }}>`
 * is the only change needed to swap rendering strategies. The future cloud
 * Android-emulator engine (`native-build`) slots in the same way.
 */

import {
  SEEKER_DEVICE,
  type AppSource,
  type BackendEventMap,
  type BackendId,
  type DeviceProfile,
  type RenderingBackend,
  type Unsubscribe,
} from './RenderingBackend';

export interface IframeBackendOptions {
  /** Device profile to render at. Defaults to {@link SEEKER_DEVICE}. */
  device?: DeviceProfile;
  /**
   * Extra `sandbox` tokens for the preview iframe. The preview is same-origin-ish
   * trusted dev content (bolt's WebContainer proxy), so by default the iframe is
   * left unsandboxed; pass tokens here to tighten it if a host requires it.
   */
  sandbox?: string;
  /** `allow` attribute (feature policy) for the preview iframe. */
  allow?: string;
  /** Accessible title for the preview iframe. */
  title?: string;
}

type Listeners = {
  [E in keyof BackendEventMap]: Set<(payload: BackendEventMap[E]) => void>;
};

export class IframeBackend implements RenderingBackend {
  readonly id: BackendId = 'web-iframe';

  private device: DeviceProfile;
  private readonly options: IframeBackendOptions;
  private host: HTMLElement | null = null;
  private iframe: HTMLIFrameElement | null = null;
  private currentSource: AppSource | null = null;
  private onLoad: (() => void) | null = null;
  private readonly listeners: Listeners = {
    mounted: new Set(),
    'app-loaded': new Set(),
    unmounted: new Set(),
    error: new Set(),
  };

  constructor(options: IframeBackendOptions = {}) {
    this.options = options;
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

    const iframe = host.ownerDocument.createElement('iframe');
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    iframe.style.background = '#000';
    iframe.title = this.options.title ?? `${this.device.name} preview`;
    if (this.options.sandbox != null) {
      iframe.setAttribute('sandbox', this.options.sandbox);
    }
    if (this.options.allow != null) {
      iframe.setAttribute('allow', this.options.allow);
    }
    host.appendChild(iframe);
    this.iframe = iframe;

    this.emit('mounted', { device: this.device });

    // If an app was queued before mount (it isn't, via <Simulator>, but the
    // contract allows loadApp-before-mount via re-mount), load it now.
    if (this.currentSource) {
      this.loadApp(this.currentSource);
    }
  }

  loadApp(source: AppSource): void {
    if (source.kind !== 'bundle-url') {
      throw new Error(
        `IframeBackend does not support app source kind "${source.kind}". ` +
          'The iframe engine renders "bundle-url" (a preview URL); ' +
          '"react-component" is for the react-native-web engine and ' +
          '"native-build" is for the cloud emulator backend.',
      );
    }
    this.currentSource = source;

    const iframe = this.iframe;
    if (!iframe) {
      // Not mounted yet — mount() will replay currentSource.
      return;
    }

    // Detach any prior load listener before re-pointing the frame.
    if (this.onLoad) {
      iframe.removeEventListener('load', this.onLoad);
    }
    const handleLoad = () => {
      this.emit('app-loaded', { source });
    };
    this.onLoad = handleLoad;
    iframe.addEventListener('load', handleLoad);

    try {
      iframe.src = source.url;
    } catch (error) {
      const wrapped = error instanceof Error ? error : new Error(String(error));
      this.emit('error', { error: wrapped });
      throw wrapped;
    }
  }

  unmount(): void {
    if (this.iframe) {
      if (this.onLoad) {
        this.iframe.removeEventListener('load', this.onLoad);
      }
      this.iframe.remove();
    }
    this.iframe = null;
    this.host = null;
    this.onLoad = null;
    this.currentSource = null;
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

  private emit<E extends keyof BackendEventMap>(
    event: E,
    payload: BackendEventMap[E],
  ): void {
    for (const handler of this.listeners[event]) {
      handler(payload);
    }
  }
}
