/**
 * createMockWallet — wires the mock wallet layer into `<Simulator>` (T03 + T04).
 *
 * One call produces the shared {@link MockMwaProvider} controller, registers it
 * as the active controller the aliased `@wallet-ui/react-native-kit` will drive
 * (so the rendered template's MWA calls route through it), and returns a
 * {@link WalletBridge} whose overlay is the {@link ApprovalSheet}. Hand the
 * `bridge` to `<Simulator wallet>` and the `controller` to any simulator-side
 * demo controls.
 */

import { createElement } from 'react';

import { ApprovalSheet } from './ApprovalSheet';
import { MockMwaProvider, type MockMwaOptions } from './MockMwaProvider';
import { setActiveMockMwa } from './mock-wallet-ui-kit';
import type { WalletBridge } from './WalletBridge';

export interface MockWallet {
  /** The shared controller (drive demo transactions, inspect state, etc.). */
  controller: MockMwaProvider;
  /** Pass to `<Simulator wallet={bridge}>` to render the approval sheet. */
  bridge: WalletBridge;
}

export function createMockWallet(options: MockMwaOptions = {}): MockWallet {
  const controller = new MockMwaProvider(options);
  setActiveMockMwa(controller);

  const bridge: WalletBridge = {
    renderOverlay: () => createElement(ApprovalSheet, { controller }),
    onRequest: undefined,
  };

  return { controller, bridge };
}
