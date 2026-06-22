/**
 * Devnet faucet.
 *
 * Funds an address with devnet SOL via the RPC `requestAirdrop`, with
 * retry/backoff for the (frequent) devnet rate-limiting. Devnet only — there is
 * no mainnet faucet and this module must never be pointed at a real-funds
 * cluster (callers pass a `ClusterTarget`, and only devnet ever resolves).
 *
 * Rate-limit fallback: when the public devnet RPC throttles airdrops, point the
 * rails at an alternate devnet RPC via `SEEKER_RAILS_RPC_URL`, or use the web
 * faucet at https://faucet.solana.com for the deployer address. See README.
 */

import type { ClusterTarget } from '../cluster/ClusterTarget.js';
import { assertDevnetTarget } from '../cluster/ClusterTarget.js';
import {
  confirmSignature,
  getBalanceLamports,
  LAMPORTS_PER_SOL,
  requestAirdropLamports,
} from '../solana/rpc.js';

/** Devnet caps a single airdrop request; request in <=1 SOL chunks to be safe. */
const MAX_AIRDROP_SOL_PER_REQUEST = 1;

export interface FundOptions {
  /** Max retry attempts per airdrop chunk before giving up. */
  maxRetries?: number;
  /** Base backoff in ms; grows exponentially with jitter. */
  baseDelayMs?: number;
  /** Optional progress sink (defaults to console.log). Never receives secrets. */
  log?: (message: string) => void;
}

export interface FundResult {
  address: string;
  /** Balance in SOL after funding. */
  balanceSol: number;
  /** Airdrop signatures collected (explorer-verifiable). */
  signatures: string[];
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function isRateLimited(err: unknown): boolean {
  const msg = String((err as Error)?.message ?? err).toLowerCase();
  return (
    msg.includes('429') ||
    msg.includes('rate') ||
    msg.includes('limit') ||
    msg.includes('too many') ||
    msg.includes('airdrop')
  );
}

/** Current balance of an address, in SOL. */
export async function getBalanceSol(target: ClusterTarget, address: string): Promise<number> {
  assertDevnetTarget(target, 'getBalanceSol()');
  const lamports = await getBalanceLamports(target, address);
  return lamports / LAMPORTS_PER_SOL;
}

/**
 * Airdrop `sol` devnet SOL to `address`, in rate-limit-friendly chunks with
 * exponential backoff. Returns the post-funding balance and the airdrop
 * signatures. Throws (with a clear, actionable message) only if every retry of
 * a chunk is exhausted.
 */
export async function fund(
  target: ClusterTarget,
  address: string,
  sol: number,
  opts: FundOptions = {},
): Promise<FundResult> {
  assertDevnetTarget(target, 'fund()');
  const { maxRetries = 6, baseDelayMs = 1000, log = console.log } = opts;
  const signatures: string[] = [];

  if (sol < 0) throw new Error(`fund() amount must be non-negative, got ${sol}`);

  let remaining = sol;
  while (remaining > 0) {
    const chunk = Math.min(remaining, MAX_AIRDROP_SOL_PER_REQUEST);
    const lamports = Math.floor(chunk * LAMPORTS_PER_SOL);

    let attempt = 0;
    for (;;) {
      try {
        const signature = await requestAirdropLamports(target, address, lamports);
        await confirmSignature(target, signature);
        signatures.push(signature);
        log(`airdropped ${chunk} SOL to ${address} (${target.label})`);
        break;
      } catch (err) {
        attempt += 1;
        if (attempt > maxRetries) {
          throw new Error(
            `Devnet airdrop failed after ${maxRetries} retries for ${address}. ` +
              `The public devnet faucet is likely rate-limiting. Try again shortly, ` +
              `set SEEKER_RAILS_RPC_URL to an alternate devnet RPC, or use ` +
              `https://faucet.solana.com for this address. Last error: ${(err as Error).message}`,
          );
        }
        if (!isRateLimited(err)) {
          // Non-rate-limit error: still back off once, but surface the real cause if it repeats.
          log(`airdrop attempt ${attempt} failed (${(err as Error).message}); retrying`);
        }
        const delay = baseDelayMs * 2 ** (attempt - 1) + Math.floor(Math.random() * 250);
        log(`devnet faucet throttled; backing off ${delay}ms (attempt ${attempt}/${maxRetries})`);
        await sleep(delay);
      }
    }

    remaining -= chunk;
  }

  const balanceSol = await getBalanceSol(target, address);
  return { address, balanceSol, signatures };
}

/**
 * Ensure `address` holds at least `minSol`. If it is short, top it up to
 * `topUpToSol` via the faucet. Returns the resulting balance. Used by the
 * deploy path to auto-fund the deployer when its balance is insufficient.
 */
export async function ensureFunded(
  target: ClusterTarget,
  address: string,
  minSol: number,
  topUpToSol: number = minSol,
  opts: FundOptions = {},
): Promise<number> {
  assertDevnetTarget(target, 'ensureFunded()');
  const { log = console.log } = opts;
  const balance = await getBalanceSol(target, address);
  if (balance >= minSol) {
    log(`deployer ${address} has ${balance} SOL (>= ${minSol}); no airdrop needed`);
    return balance;
  }
  const deficit = Math.max(topUpToSol - balance, minSol - balance);
  log(`deployer ${address} has ${balance} SOL (< ${minSol}); requesting ${deficit} SOL from the devnet faucet`);
  const result = await fund(target, address, deficit, opts);
  return result.balanceSol;
}
