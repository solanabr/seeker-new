/**
 * Cluster/target abstraction.
 *
 * Every deploy / faucet / publish operation runs against a `ClusterTarget`
 * rather than a hardcoded cluster. This is the seam where a non-devnet target
 * can be added later WITHOUT rewriting callers — but see the safety note below.
 *
 * SAFETY: devnet is the only implemented target. A non-devnet target is
 * *representable* (so callers can be written against the abstraction today),
 * but constructing one is intentionally not supported: `resolveTarget` throws.
 * When a real-funds target is added later it must sit behind an explicit
 * confirmation gate (`requiresConfirmation: true`) and prominent "unaudited"
 * warnings. Nothing in this package may quietly reach a real-funds path.
 */

/** Labels the abstraction can represent. Only `devnet` is implemented. */
export type ClusterLabel = 'devnet' | 'mainnet';

export interface ClusterTarget {
  /** Human-readable cluster label. */
  readonly label: ClusterLabel;
  /** JSON-RPC endpoint used for balances, airdrops, and signature lookups. */
  readonly rpcUrl: string;
  /**
   * Whether operations against this target must be explicitly confirmed by a
   * human before any transaction is sent. Devnet = false (throwaway funds).
   * Any real-funds target = true.
   */
  readonly requiresConfirmation: boolean;
  /** Base URL for building explorer links (deep-linked to this cluster). */
  readonly explorerCluster: string;
}

/** Default public devnet RPC. Override via `SEEKER_RAILS_RPC_URL`. */
const DEFAULT_DEVNET_RPC = 'https://api.devnet.solana.com';

/**
 * The devnet target. Throwaway funds, no confirmation gate, no real money at
 * risk. This is the only target the rails will actually operate against.
 */
export function devnet(rpcUrl: string = process.env.SEEKER_RAILS_RPC_URL ?? DEFAULT_DEVNET_RPC): ClusterTarget {
  return {
    label: 'devnet',
    rpcUrl,
    requiresConfirmation: false,
    explorerCluster: 'devnet',
  };
}

/**
 * Resolve a label to a usable `ClusterTarget`.
 *
 * Only `devnet` resolves. Any other label is representable in the type system
 * but unimplemented on purpose — resolving it throws rather than silently
 * reaching a real-funds path. This is the hard guarantee behind "devnet only".
 */
export function resolveTarget(label: ClusterLabel): ClusterTarget {
  if (label === 'devnet') return devnet();
  throw new Error(
    `Cluster "${label}" is not implemented. The rails operate on devnet only. ` +
      `A real-funds target would require an explicit confirmation gate and ` +
      `"unaudited" warnings before it can be enabled — it is intentionally absent.`,
  );
}

/**
 * Runtime backstop for every exported operation that can touch an RPC endpoint.
 * Type-level representability is useful for future callers, but no function may
 * quietly use a non-devnet target until the mainnet confirmation flow exists.
 */
export function assertDevnetTarget(target: ClusterTarget, operation: string): void {
  if (target.label !== 'devnet' || target.requiresConfirmation) {
    throw new Error(
      `${operation} refuses target "${target.label}": the rails operate on devnet only. ` +
        `A real-funds path is not implemented and would require an explicit ` +
        `confirmation gate and "unaudited" warnings before any transaction.`,
    );
  }
}

/** Build a Solana Explorer URL for an address or signature on this target. */
export function explorerUrl(target: ClusterTarget, kind: 'address' | 'tx', value: string): string {
  return `https://explorer.solana.com/${kind}/${value}?cluster=${target.explorerCluster}`;
}
