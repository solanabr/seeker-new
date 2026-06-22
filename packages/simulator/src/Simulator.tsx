/**
 * <Simulator> — the Seeker device-frame component that hosts a rendering backend.
 *
 * It draws the device chrome (bezel + screen) and drives a {@link RenderingBackend}
 * through its lifecycle: mount the backend into the screen node, load an app if
 * one is given, and clean up on unmount. The backend is injected (defaulting to
 * {@link WebRenderBackend}) so the component is identical whether the engine is
 * react-native-web today or a streamed cloud emulator later.
 *
 * The `wallet` prop is the seam for the mock-wallet layer (T03/T04): its overlay
 * (the approval sheet) renders above the screen. It is optional, so the frame is
 * fully usable with no wallet wired this sprint.
 *
 * Bundle note: this component does **not** statically import any concrete engine.
 * `WebRenderBackend` (which pulls in react-native-web) is loaded with a dynamic
 * `import()` *only* when no `backend` is supplied — so it is code-split into its
 * own chunk and never enters the eager import graph of a caller that injects its
 * own backend. That is what lets the builder import `<Simulator>` + the
 * `IframeBackend` with **no react-native-web in its bundle**.
 */

import { useEffect, useRef, type CSSProperties, type ReactElement } from 'react';

import type {
  AppSource,
  DeviceProfile,
  RenderingBackend,
} from './backend/RenderingBackend';
import { SEEKER_DEVICE } from './backend/RenderingBackend';
import type { WalletBridge } from './wallet/WalletBridge';

export interface SimulatorProps {
  /**
   * Rendering engine to host. When omitted, a react-native-web
   * {@link WebRenderBackend} is lazily imported and used (the zero-config
   * standalone path). Pass a different implementation (e.g. {@link IframeBackend}
   * or a future cloud emulator) without changing any other prop — that is the
   * whole point of the interface, and it keeps react-native-web out of the bundle
   * of any caller that supplies its own engine.
   */
  backend?: RenderingBackend;
  /** App to render in the frame. Optional — omit for an empty device. */
  app?: AppSource;
  /** Device profile / frame to draw. Defaults to {@link SEEKER_DEVICE}. */
  device?: DeviceProfile;
  /** Mock-wallet layer (approval sheet overlay + request hooks); wired in T03/T04. */
  wallet?: WalletBridge;
  /** Uniform scale applied to the device frame (e.g. 0.75 to fit a panel). */
  scale?: number;
  /** Called once the backend is mounted (and the app loaded, if provided). */
  onReady?: (backend: RenderingBackend) => void;
  /** Called if mounting or loading the app throws. */
  onError?: (error: Error) => void;
  className?: string;
  style?: CSSProperties;
}

const BEZEL = 12;

export function Simulator(props: SimulatorProps): ReactElement {
  const {
    backend,
    app,
    device = SEEKER_DEVICE,
    wallet,
    scale = 1,
    onReady,
    onError,
    className,
    style,
  } = props;

  const screenRef = useRef<HTMLDivElement>(null);
  // Latest-callback refs so the mount effect can run once without going stale.
  const onReadyRef = useRef(onReady);
  const onErrorRef = useRef(onError);
  onReadyRef.current = onReady;
  onErrorRef.current = onError;

  useEffect(() => {
    const host = screenRef.current;
    if (!host) {
      return;
    }

    let cancelled = false;
    let engine: RenderingBackend | undefined = backend;

    void (async () => {
      try {
        if (!engine) {
          // Lazy: only the default (react-native-web) path pulls the heavy engine
          // in, and it lands in its own chunk — callers that inject a backend
          // never load it.
          const { WebRenderBackend } = await import('./backend/WebRenderBackend');
          if (cancelled) {
            return;
          }
          engine = new WebRenderBackend({ device });
        }
        engine.setDevice(device);
        await engine.mount(host);
        // Bail if React already tore this effect down (e.g. StrictMode's
        // double-invoke, or a fast prop change) — the engine was unmounted in
        // cleanup, so loading an app into it would throw.
        if (cancelled) {
          return;
        }
        if (app) {
          await engine.loadApp(app);
        }
        if (!cancelled) {
          onReadyRef.current?.(engine);
        }
      } catch (error) {
        onErrorRef.current?.(
          error instanceof Error ? error : new Error(String(error)),
        );
      }
    })();

    return () => {
      cancelled = true;
      void engine?.unmount();
    };
    // Re-mount when the backend, app, or device identity changes.
  }, [backend, app, device]);

  const frameWidth = device.width + BEZEL * 2;
  const frameHeight = device.height + BEZEL * 2;
  const scaled = scale !== 1;

  const frameStyle: CSSProperties = {
    width: frameWidth,
    height: frameHeight,
    padding: BEZEL,
    boxSizing: 'border-box',
    background: '#0b0b0f',
    borderRadius: 44,
    boxShadow: '0 18px 50px rgba(0, 0, 0, 0.45), inset 0 0 0 2px #25252d',
    transform: scaled ? `scale(${scale})` : undefined,
    transformOrigin: 'top left',
    ...style,
  };

  // A CSS transform scales the frame visually but leaves its original
  // (unscaled) box in the layout flow, so the page reserves empty space to the
  // right and below the phone — that's the phantom scroll. Wrap the frame in a
  // container sized to the *scaled* dimensions so the footprint matches what's
  // actually drawn.
  const wrapperStyle: CSSProperties | undefined = scaled
    ? { width: frameWidth * scale, height: frameHeight * scale }
    : undefined;

  const screenStyle: CSSProperties = {
    position: 'relative',
    width: device.width,
    height: device.height,
    borderRadius: 32,
    overflow: 'hidden',
    background: '#000',
  };

  const overlayStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
  };

  const frame = (
    <div
      className={className}
      style={frameStyle}
      data-simulator-device={device.id}
      role="group"
      aria-label={`${device.name} simulator`}
    >
      <div style={screenStyle}>
        <div ref={screenRef} style={{ width: '100%', height: '100%' }} />
        {wallet?.renderOverlay ? (
          <div style={overlayStyle} data-simulator-overlay="wallet">
            {wallet.renderOverlay()}
          </div>
        ) : null}
      </div>
    </div>
  );

  return wrapperStyle ? <div style={wrapperStyle}>{frame}</div> : frame;
}
