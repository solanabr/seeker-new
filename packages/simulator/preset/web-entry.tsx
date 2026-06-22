/**
 * Simulator preview preset — the runtime (browser) half.
 *
 * `mountSimulatorPreview` is the web entry a previewed project boots from (its
 * `main.tsx`). It `AppRegistry`-registers the app root (via the react-native-web
 * {@link WebRenderBackend}) wrapped in the mock `MobileWalletProvider`, and renders
 * the Seeker {@link ApprovalSheet} as an overlay above it — so the full wallet flow
 * (connect → approval → sign → tx-result, approve and reject) runs entirely inside
 * this one bundle. No cross-frame messaging; the React-18-shell / React-19-app
 * split stays isolated because this whole tree lives inside the preview iframe.
 *
 * It renders **frameless** (the app fills the viewport): the Seeker device frame is
 * host-side chrome drawn by `<Simulator>` (the builder's `IframeBackend`, or the
 * standalone dev harness), which frames this page's URL. Putting the frame here too
 * would double it.
 *
 * The app-root entry contract: a previewed project provides a root React component
 * (the app's screen tree, composed from its own — aliased — modules). The preset
 * wraps it in the mock wallet and mounts it. By default it also wraps the root in
 * the mock `MobileWalletProvider`; pass `provideWallet: false` if the root already
 * mounts its own (aliased) provider.
 */

import { StrictMode, createElement, type ComponentType } from 'react';
import { createRoot } from 'react-dom/client';

import {
  ApprovalSheet,
  MobileWalletProvider,
  MockMwaProvider,
  WebRenderBackend,
  createSolanaDevnet,
  setActiveMockMwa,
  type AppIdentity,
  type MockMwaOptions,
  type SolanaCluster,
} from '../src/index';

const DEFAULT_IDENTITY: AppIdentity = {
  name: 'Seeker Preview',
  uri: 'https://solana.com',
  icon: 'favicon.png',
};

export interface MountSimulatorPreviewOptions {
  /** The app's root React component (its screen tree). */
  AppRoot: ComponentType;
  /** Mount target. Defaults to `#root`. */
  container?: HTMLElement | null;
  /** `AppRegistry` key for the registered app. Defaults to `seeker-preview`. */
  appKey?: string;
  /** Mock-wallet options (e.g. `accountLabel`, `autoApproveMs`). */
  wallet?: MockMwaOptions;
  /** Identity passed to the mock `MobileWalletProvider`. */
  identity?: AppIdentity;
  /** Cluster passed to the mock `MobileWalletProvider`. Defaults to devnet. */
  cluster?: Pick<SolanaCluster, 'id' | 'url' | 'urlWs'>;
  /**
   * Wrap `AppRoot` in the mock `MobileWalletProvider` (default `true`). Set
   * `false` when the root already mounts its own (aliased) provider.
   */
  provideWallet?: boolean;
}

export interface SimulatorPreviewHandle {
  /** The shared mock wallet controller (drive demo requests, inspect state). */
  controller: MockMwaProvider;
  /** The rendering engine hosting the app. */
  backend: WebRenderBackend;
}

/**
 * Boot a beeman-template-shaped app into the preview bundle with the mock wallet
 * wired in. Returns the shared controller + backend for any host-side control.
 */
export function mountSimulatorPreview(
  options: MountSimulatorPreviewOptions,
): SimulatorPreviewHandle {
  const container =
    options.container ?? document.getElementById('root');
  if (!container) {
    throw new Error(
      'seeker-simulator preset: preview container not found (expected #root).',
    );
  }

  // One shared controller: the in-app mock kit (via the active-controller
  // registry) and the approval sheet must drive the same instance.
  const controller = new MockMwaProvider(
    options.wallet ?? { accountLabel: 'Seeker (Simulated)' },
  );
  setActiveMockMwa(controller);

  // Full-bleed stage: the RN-web app fills it; the approval sheet overlays it.
  container.style.position = 'relative';
  container.style.width = '100%';
  container.style.height = '100%';
  container.style.overflow = 'hidden';

  const appHost = container.ownerDocument.createElement('div');
  appHost.style.width = '100%';
  appHost.style.height = '100%';
  container.appendChild(appHost);

  const AppRoot = options.AppRoot;
  const Root: ComponentType =
    options.provideWallet === false
      ? AppRoot
      : function PreviewRoot() {
          return (
            <MobileWalletProvider
              cluster={options.cluster ?? createSolanaDevnet()}
              identity={options.identity ?? DEFAULT_IDENTITY}
            >
              <AppRoot />
            </MobileWalletProvider>
          );
        };

  const backend = new WebRenderBackend();
  backend.mount(appHost);
  backend.loadApp({
    kind: 'react-component',
    appKey: options.appKey ?? 'seeker-preview',
    component: Root,
  });

  // Approval-sheet overlay (simulator chrome, in react-dom). It is empty/idle
  // until a wallet request arrives, so it passes pointer events through to the
  // app; the scrim turns interactive only while a request is pending.
  const overlayHost = container.ownerDocument.createElement('div');
  overlayHost.style.position = 'absolute';
  overlayHost.style.inset = '0';
  overlayHost.style.pointerEvents = 'none';
  container.appendChild(overlayHost);
  createRoot(overlayHost).render(
    createElement(
      StrictMode,
      null,
      createElement(ApprovalSheet, { controller }),
    ),
  );

  return { controller, backend };
}
