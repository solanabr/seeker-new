/**
 * Safe deployer keypair handling.
 *
 * The deployer is a THROWAWAY devnet keypair. It is generated on first use and
 * stored at a gitignored path (`.rails/deployer.json`) in the Solana CLI
 * `id.json` format (a JSON array of the 64 secret-key bytes), so the exact same
 * file is usable directly by `solana --keypair` for the deploy step.
 *
 * Hard rules enforced here:
 *   - The secret key is NEVER logged, printed, or returned in a public shape.
 *     Only the public key (an address — safe to print) is ever surfaced.
 *   - The store directory is created with owner-only permissions (0700) and the
 *     key file with 0600.
 *   - This is a devnet-only throwaway. Do not fund it from a real wallet.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, chmodSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Package root (…/packages/rails), independent of the caller's cwd. */
const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Gitignored store for the throwaway deployer keypair. */
export const RAILS_DIR = resolve(PACKAGE_ROOT, '.rails');
export const DEPLOYER_KEYPAIR_PATH = resolve(RAILS_DIR, 'deployer.json');

export interface DeployerKeypair {
  /** Path to the gitignored Solana CLI keypair file. */
  readonly keypairPath: string;
  /** Public address only. Safe to log/return. */
  readonly publicKey: string;
}

function runKeygen(args: string[]): string {
  const result = spawnSync('solana-keygen', args, { encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`solana-keygen ${args.join(' ')} failed: ${result.stderr || result.stdout}`);
  }
  return result.stdout.trim();
}

export function keypairAddressFromFile(keypairPath: string): string {
  return runKeygen(['pubkey', keypairPath]);
}

/**
 * Load the deployer keypair, generating + persisting a fresh one if none
 * exists. Returns only the keypair path and public address; the secret bytes are
 * never returned to callers.
 */
export function loadOrCreateDeployer(keypairPath: string = DEPLOYER_KEYPAIR_PATH): DeployerKeypair {
  if (!existsSync(keypairPath)) {
    persistKeypair(keypairPath);
  }

  return { keypairPath, publicKey: keypairAddressFromFile(keypairPath) };
}

/** Write a keypair to disk in the Solana CLI `id.json` format, locked down. */
function persistKeypair(keypairPath: string): void {
  const dir = dirname(keypairPath);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  runKeygen(['new', '--no-bip39-passphrase', '--silent', '-o', keypairPath]);
  // Re-assert perms in case the file already existed with a looser mode.
  try {
    chmodSync(keypairPath, 0o600);
    chmodSync(dir, 0o700);
  } catch {
    // Best-effort on platforms without POSIX perms.
  }
}

/**
 * Public-key-only view of the deployer. The ONLY identity detail safe to log,
 * return to callers, or surface in a CLI — the secret never leaves this module.
 */
export function deployerAddress(keypair: DeployerKeypair): string {
  return keypair.publicKey;
}
