/**
 * SimulatorPreview — the Seeker device frame around a WebContainer preview URL.
 *
 * This is the builder-side mount of the `seeker-simulator` package
 * (packages/simulator in this monorepo). It draws
 * the Seeker phone chrome and frames the preview URL in an `<iframe>` (the
 * `bundle-url` rendering backend). All react-native-web rendering, the mock
 * wallet, and the approval sheet live **inside** that iframe's bundle (the Vite
 * react-native-web dev server the simulator preview preset runs in the
 * WebContainer) — so importing this component pulls **no react-native-web into
 * the builder bundle**, and the React 18 shell / React 19 app split is isolated
 * by the iframe boundary.
 *
 * `.client.tsx`: Remix empties this module on the server, and it is additionally
 * mounted behind a `<ClientOnly>` boundary in `Preview.tsx` — the device frame
 * touches the DOM (the backend appends the iframe to a host node) and must not
 * SSR (Cloudflare).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  SEEKER_DEVICE,
  Simulator,
  createPreviewBackend,
  type AppSource,
  type DeviceProfile,
  type SimulatorProps,
} from '~/lib/simulator-preview/backend';

interface SimulatorPreviewProps {
  /** The running preview URL to frame (the WebContainer dev-server URL). */
  url?: string;
  orientation?: 'portrait' | 'landscape';
  reloadKey?: number;
}

const PANEL_PADDING = 24;
const BEZEL = 12;

const LANDSCAPE_SEEKER_DEVICE: DeviceProfile = {
  ...SEEKER_DEVICE,
  id: `${SEEKER_DEVICE.id}-landscape`,
  width: SEEKER_DEVICE.height,
  height: SEEKER_DEVICE.width,
  safeAreaInsets: {
    top: 0,
    right: SEEKER_DEVICE.safeAreaInsets.top,
    bottom: 0,
    left: SEEKER_DEVICE.safeAreaInsets.bottom,
  },
};

export function SimulatorPreview({ url, orientation = 'portrait', reloadKey = 0 }: SimulatorPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const device = orientation === 'landscape' ? LANDSCAPE_SEEKER_DEVICE : SEEKER_DEVICE;
  const frameWidth = device.width + BEZEL * 2;
  const frameHeight = device.height + BEZEL * 2;

  // A fresh iframe backend per mounted preview; recreated only if the component
  // remounts. The device frame drives its lifecycle (mount → loadApp → unmount).
  const backend = useMemo(() => createPreviewBackend({ title: 'Seeker preview' }), []);

  // Memoize the app source by url so <Simulator> only re-points the iframe when
  // the preview URL actually changes (its mount effect keys on `app` identity).
  const app = useMemo<AppSource | undefined>(() => (url ? { kind: 'bundle-url', url } : undefined), [url, reloadKey]);

  const emptyDeviceOverlay = useMemo<NonNullable<SimulatorProps['wallet']>>(
    () => ({
      renderOverlay: () => (
        <div
          style={{
            alignItems: 'center',
            background:
              'linear-gradient(155deg, rgba(16, 18, 13, 0.94) 0%, rgba(13, 28, 32, 0.94) 38%, rgba(46, 33, 84, 0.94) 100%)',
            color: 'rgba(255, 255, 255, 0.58)',
            display: 'flex',
            flexDirection: 'column',
            fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
            fontSize: 16,
            fontWeight: 600,
            gap: 20,
            height: '100%',
            justifyContent: 'center',
            textAlign: 'center',
            width: '100%',
          }}
        >
          <span
            style={{
              background: 'rgba(255,255,255,0.62)',
              borderRadius: 999,
              display: 'block',
              height: 52,
              width: 52,
            }}
          />
          <span>Your app preview will appear here</span>
        </div>
      ),
    }),
    [],
  );

  // Scale the device frame to fit the available panel, without clipping.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const fit = () => {
      const availW = container.clientWidth - PANEL_PADDING;
      const availH = container.clientHeight - PANEL_PADDING;
      const next = Math.min(1, availW / frameWidth, availH / frameHeight);
      setScale(next > 0 ? next : 1);
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(container);

    return () => observer.disconnect();
  }, [frameHeight, frameWidth]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex items-center justify-center overflow-auto bg-bolt-elements-background-depth-1"
    >
      <Simulator backend={backend} app={app} device={device} scale={scale} wallet={url ? undefined : emptyDeviceOverlay} />
    </div>
  );
}
