/**
 * Mock `@wallet-ui/react-native-kit` — the interception seam (T03).
 *
 * The beeman template talks to Mobile Wallet Adapter exclusively through
 * `@wallet-ui/react-native-kit` (`MobileWalletProvider`, `useMobileWallet`,
 * `createSolanaDevnet`). The simulator aliases that package name to THIS module
 * in its bundler config, so every MWA call the template makes is transparently
 * routed to a {@link MockMwaProvider} — the template source is never touched.
 *
 * Only the surface the template (and the simulator's demo controls) actually use
 * is implemented; the rest of the real kit's exports are provided as faithful
 * no-op/stub shapes so imports resolve. The method names and return shapes mirror
 * the real `useMobileWallet()` so swapping in real devnet signing later is a
 * drop-in.
 *
 * A single controller instance is shared between the app tree (this module) and
 * the simulator's `ApprovalSheet` chrome via the module-level active-controller
 * registry — they render in separate React roots and cannot share context.
 */

import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import type { Instruction } from '@solana/kit';
import { MockMwaProvider, type MockAccount } from './MockMwaProvider';

// ── shared controller registry ──────────────────────────────────────────────

let activeController: MockMwaProvider | null = null;

/** Register the controller the aliased kit should drive (called by the harness). */
export function setActiveMockMwa(controller: MockMwaProvider): void {
  activeController = controller;
}

/** The active controller, creating a default one on first use. */
export function getActiveMockMwa(): MockMwaProvider {
  if (!activeController) {
    activeController = new MockMwaProvider();
  }
  return activeController;
}

// ── cluster factories (mirror @wallet-ui/core) ───────────────────────────────

export interface SolanaCluster {
  id: `solana:${string}`;
  label: string;
  url: string;
  urlWs?: string;
}

type CreateSolanaProps =
  | string
  | (Partial<Pick<SolanaCluster, 'label' | 'url' | 'urlWs'>> & {
      cluster?: string;
    });

function makeCluster(
  id: SolanaCluster['id'],
  label: string,
  url: string,
  props?: CreateSolanaProps,
): SolanaCluster {
  if (typeof props === 'string') {
    return { id, label, url: props };
  }
  return {
    id,
    label: props?.label ?? label,
    url: props?.url ?? url,
    urlWs: props?.urlWs,
  };
}

// URLs are nominal-only — the mock never opens a connection to them.
export const createSolanaDevnet = (props?: CreateSolanaProps): SolanaCluster =>
  makeCluster('solana:devnet', 'Devnet', 'https://api.devnet.solana.com', props);
export const createSolanaTestnet = (props?: CreateSolanaProps): SolanaCluster =>
  makeCluster(
    'solana:testnet',
    'Testnet',
    'https://api.testnet.solana.com',
    props,
  );
export const createSolanaMainnet = (props?: CreateSolanaProps): SolanaCluster =>
  makeCluster(
    'solana:mainnet',
    'Mainnet',
    'https://api.mainnet-beta.solana.com',
    props,
  );
export const createSolanaLocalnet = (props?: CreateSolanaProps): SolanaCluster =>
  makeCluster('solana:localnet', 'Localnet', 'http://localhost:8899', props);

// ── provider + hook ──────────────────────────────────────────────────────────

export interface AppIdentity {
  name: string;
  uri?: string;
  icon?: string;
}

export interface MobileWalletProviderProps {
  children: ReactNode;
  cluster: Pick<SolanaCluster, 'id' | 'url' | 'urlWs'>;
  identity: AppIdentity;
  cache?: unknown;
  createClient?: unknown;
}

const MockWalletContext = createContext<MockMwaProvider | null>(null);

/**
 * Drop-in for the real `MobileWalletProvider`. It binds the rendered app tree to
 * the active mock controller (registered by the simulator) and exposes it via
 * context so `useMobileWallet()` can reach it.
 */
export function MobileWalletProvider(
  props: MobileWalletProviderProps,
): ReactNode {
  const controller = useMemo(() => getActiveMockMwa(), []);
  useEffect(() => {
    controller.setCluster(props.cluster);
  }, [controller, props.cluster]);

  return createElement(
    MockWalletContext.Provider,
    { value: controller },
    props.children,
  );
}

/** Reactive snapshot of the shared controller. */
function useControllerState(controller: MockMwaProvider) {
  const [state, setState] = useState(() => controller.getState());
  useEffect(() => controller.subscribe(setState), [controller]);
  return state;
}

/**
 * Mock `useMobileWallet()` — mirrors the real return surface the template reads.
 * Connect/disconnect/sign* route through the shared controller (and thus the
 * approval sheet); the rest are faithful stubs so the template type-checks and
 * runs without modification.
 */
export function useMobileWallet() {
  const ctxController = useContext(MockWalletContext);
  const controller = ctxController ?? getActiveMockMwa();
  const state = useControllerState(controller);

  return useMemo(() => {
    const account = state.account ?? undefined;
    return {
      account,
      accounts: account ? [account] : null,
      connect: () => controller.connect(),
      disconnect: () => controller.disconnect(),
      signMessage: <K extends Uint8Array | Uint8Array[]>(message: K) =>
        controller.signMessage(message),
      signMessages: <K extends Uint8Array | Uint8Array[]>(message: K) =>
        controller.signMessage(message),
      signTransaction: <T,>(transaction: T) =>
        controller.signTransaction(transaction),
      signTransactions: <T,>(transaction: T) =>
        controller.signTransaction(transaction),
      signAndSendTransaction: (summary?: string, details?: string[]) =>
        controller.signAndSendTransaction(summary, details),
      signAndSendTransactions: (summary?: string, details?: string[]) =>
        controller.signAndSendTransaction(summary, details),
      sendTransaction: (instruction?: Instruction) =>
        controller.sendInstructions(instruction ? [instruction] : []),
      sendTransactions: (instructions?: readonly Instruction[]) =>
        controller.sendInstructions(instructions ?? []),
      // SIWS sign-in needs a backend in the real template; surface a clear error
      // rather than silently faking an auth session.
      signIn: async (): Promise<never> => {
        throw new Error(
          'Mock MWA: Sign-In-With-Solana requires the template backend, which is ' +
            'out of scope for the simulator sprint (no real network).',
        );
      },
      connectAnd: async (cb: (wallet: unknown) => Promise<unknown>) => {
        await controller.connect();
        return cb({});
      },
      deauthorizeSession: () => controller.disconnect(),
      getTransactionSigner: () => {
        throw new Error('Mock MWA: getTransactionSigner is not implemented.');
      },
      client: undefined as unknown,
      store: undefined as unknown,
      cache: undefined as unknown,
      chain: 'solana:devnet',
      identity: { name: 'Seeker Simulator' },
    };
  }, [controller, state.account]);
}

export type { MockAccount };
