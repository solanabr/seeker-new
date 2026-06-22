/**
 * WalletBridge — the seam for the in-browser mock-wallet layer.
 *
 * The mock Mobile Wallet Adapter / Seed Vault provider (T03) and the Seeker
 * approval-sheet UI (T04) plug in through this interface. It is defined now,
 * empty of behaviour, so `<Simulator>` exposes the wallet props from day one and
 * the rendering track does not have to change shape when the wallet track lands.
 *
 * Nothing here touches a real cluster, real keys, or seed phrases — the mock
 * layer resolves requests locally against an ephemeral keypair (T03).
 */

import type { ReactNode } from 'react';

/** A wallet request surfaced by the rendered app's mock MWA layer (T03). */
export interface WalletRequest {
  /** Correlates the request with its approve/reject resolution. */
  id: string;
  /** MWA-style request type the mock provider intercepts. */
  type: 'authorize' | 'sign-message' | 'sign-transaction' | 'sign-and-send';
  /** Human-readable summary shown on the approval sheet (T04). */
  summary?: string;
  /** Raw request payload (message bytes, transaction, etc.). */
  payload?: unknown;
}

/**
 * Wallet layer handed to `<Simulator wallet>`. All members are optional so the
 * component renders with no wallet wired (T01) and gains behaviour incrementally
 * as T03/T04 fill it in.
 */
export interface WalletBridge {
  /**
   * Renders an overlay above the device screen — e.g. the Seeker approval sheet.
   * Implemented in T04.
   */
  renderOverlay?: () => ReactNode;

  /**
   * Notified when the rendered app makes a wallet request that needs user
   * approval. Implemented/raised by the mock MWA provider in T03.
   */
  onRequest?: (request: WalletRequest) => void;
}
