/**
 * Devnet program deploy.
 *
 * Builds the Anchor fixture and deploys it to devnet headlessly, returning its
 * on-chain identity. Deploy mechanism (see README "Deploy mechanism" for the
 * rationale): `anchor build` to produce the `.so` + program keypair, `anchor
 * keys sync` so the embedded `declare_id!` matches the deploy keypair, then a
 * headless `solana program deploy --output json` for the program ID. The
 * deploy signature comes from `solana program deploy --output json` and is
 * explorer-verifiable. A JSON-RPC signature lookup remains only as a fallback
 * for older CLI output shapes.
 *
 * SAFETY: devnet only. The deploy refuses any target that is not the
 * implemented, no-confirmation devnet target — there is no mainnet path here.
 */

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ClusterTarget } from '../cluster/ClusterTarget.js';
import { assertDevnetTarget, explorerUrl } from '../cluster/ClusterTarget.js';
import {
  DEPLOYER_KEYPAIR_PATH,
  deployerAddress,
  keypairAddressFromFile,
  loadOrCreateDeployer,
} from '../keypair/deployer.js';
import { ensureFunded } from '../faucet/faucet.js';
import { getLatestSignatureForAddress } from '../solana/rpc.js';

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** The vendored deploy fixture (a minimal Anchor counter). */
export const FIXTURE_DIR = resolve(PACKAGE_ROOT, 'fixtures', 'anchor-counter');

/** Program deploys cost rent for the program-data account; keep a buffer. */
const MIN_DEPLOYER_SOL = 3;
const TOP_UP_TO_SOL = 5;

/**
 * SBPF toolchain pinning. Devnet (Agave 4.x) currently requires SBPF **v3** for
 * new deploys and rejects older versions, so the deployable bytecode must be
 * built for v3. `cargo build-sbf` needs a platform-tools version that ships
 * BOTH a modern rustc (edition2024 deps) AND the `sbpfv3` target sysroot —
 * v1.54 is the first that has both. Overridable as devnet's enabled version
 * set evolves. (See README "Deploy mechanism".)
 */
const SBF_TOOLS_VERSION = process.env.SEEKER_RAILS_SBF_TOOLS_VERSION ?? 'v1.54';
const SBF_ARCH = process.env.SEEKER_RAILS_SBF_ARCH ?? 'v3';
const CLOSE_BUFFER_ATTEMPTS = 3;
const CLOSE_BUFFER_RETRY_DELAY_MS = 1_000;

const sleep = (ms: number) => new Promise<void>((resolvePromise) => setTimeout(resolvePromise, ms));

export interface DeployResult {
  programId: string;
  /** The on-chain signature of the most recent deploy/upgrade transaction. */
  signature: string;
  cluster: ClusterTarget['label'];
  /** Convenience explorer link for the deployed program. */
  explorer: string;
}

export interface DeployOptions {
  /** Override the fixture directory (defaults to the vendored counter). */
  fixtureDir?: string;
  /** Skip the automatic faucet top-up (assume the deployer is already funded). */
  skipAutoFund?: boolean;
  log?: (message: string) => void;
}

/** Spawn a command, stream its output to `log`, and resolve captured stdout. */
function run(
  command: string,
  args: string[],
  cwd: string,
  log: (m: string) => void,
): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    log(`$ ${command} ${args.join(' ')}`);
    const child = spawn(command, args, { cwd, env: process.env });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d: Buffer) => {
      const s = d.toString();
      stdout += s;
      log(s.trimEnd());
    });
    child.stderr.on('data', (d: Buffer) => {
      const s = d.toString();
      stderr += s;
      log(s.trimEnd());
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolvePromise(stdout);
      else reject(new Error(`${command} exited with code ${code}\n${stderr || stdout}`));
    });
  });
}

function findDevnetProgramArtifact(anchorToml: string): string | null {
  let inDevnetPrograms = false;

  for (const line of anchorToml.split(/\r?\n/)) {
    const section = line.match(/^\s*\[([^\]]+)\]\s*(?:#.*)?$/);
    if (section) {
      inDevnetPrograms = section[1]?.trim() === 'programs.devnet';
      continue;
    }

    if (!inDevnetPrograms) continue;

    const program = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/)?.[1];
    if (program) return program;
  }

  return null;
}

/** Derive the Anchor artifact name from the workspace's devnet program entry. */
export function readProgramArtifact(fixtureDir: string): string {
  const anchorTomlPath = resolve(fixtureDir, 'Anchor.toml');
  if (!existsSync(anchorTomlPath)) {
    throw new Error(`Anchor.toml not found at ${anchorTomlPath}`);
  }

  const anchorToml = readFileSync(anchorTomlPath, 'utf8');
  const program = findDevnetProgramArtifact(anchorToml);
  if (!program) {
    throw new Error(`No [programs.devnet] entry found in ${anchorTomlPath}`);
  }

  return program;
}

/** Derive the program ID (pubkey) from Anchor's generated program keypair. */
function readProgramId(fixtureDir: string, programArtifact: string): string {
  const keypairPath = resolve(fixtureDir, 'target', 'deploy', `${programArtifact}-keypair.json`);
  if (!existsSync(keypairPath)) {
    throw new Error(`Program keypair not found at ${keypairPath} — did 'anchor build' run?`);
  }
  return keypairAddressFromFile(keypairPath);
}

/**
 * Build + deploy the fixture to devnet. Auto-funds the deployer from the devnet
 * faucet when its balance is insufficient. Re-runnable: a second deploy with
 * the same program keypair upgrades the program in place.
 */
export async function deploy(target: ClusterTarget, opts: DeployOptions = {}): Promise<DeployResult> {
  assertDevnetTarget(target, 'deploy()');
  const { fixtureDir = FIXTURE_DIR, skipAutoFund = false, log = console.log } = opts;

  if (!existsSync(fixtureDir)) {
    throw new Error(`Deploy fixture not found at ${fixtureDir}`);
  }

  const programArtifact = readProgramArtifact(fixtureDir);
  const deployer = loadOrCreateDeployer();
  const payer = deployerAddress(deployer);
  log(`deployer address: ${payer}`);
  log(`program artifact: ${programArtifact}`);

  const programKeypairPath = resolve(fixtureDir, 'target', 'deploy', `${programArtifact}-keypair.json`);

  // 1) Ensure a program keypair exists at Anchor's expected location. This is
  //    the program's on-chain address; it persists across runs (under the
  //    gitignored target/), so re-runs upgrade the same program in place.
  if (!existsSync(programKeypairPath)) {
    mkdirSync(dirname(programKeypairPath), { recursive: true });
    await run('solana-keygen', ['new', '--no-bip39-passphrase', '--silent', '-o', programKeypairPath], fixtureDir, log);
  }
  // 2) Sync declare_id!/Anchor.toml to the program keypair so the deployed
  //    bytecode's program-id check matches the deploy address. Must run BEFORE
  //    the build so the synced id is embedded in the .so.
  await run('anchor', ['keys', 'sync'], fixtureDir, log);
  // 3) Build the deployable .so at the SBPF version devnet enables (see the
  //    SBF_* constants). `cargo build-sbf` is used directly (not `anchor build`)
  //    because anchor does not expose the `--arch` selector needed here.
  await run('cargo', ['build-sbf', '--tools-version', SBF_TOOLS_VERSION, '--arch', SBF_ARCH], fixtureDir, log);

  const programId = readProgramId(fixtureDir, programArtifact);
  log(`program id (from build keypair): ${programId}`);

  // 4) Ensure the deployer can pay rent + fees for the program account.
  if (!skipAutoFund) {
    await ensureFunded(target, payer, MIN_DEPLOYER_SOL, TOP_UP_TO_SOL, { log });
  }

  // 5) Deploy headlessly to devnet. `--output json` yields { programId }.
  const soPath = resolve(fixtureDir, 'target', 'deploy', `${programArtifact}.so`);
  const out = await run(
    'solana',
    [
      'program',
      'deploy',
      soPath,
      '--program-id',
      programKeypairPath,
      '--keypair',
      DEPLOYER_KEYPAIR_PATH,
      '--url',
      target.rpcUrl,
      '--commitment',
      'confirmed',
      // Send write/deploy transactions over JSON-RPC rather than the validator
      // TPU/QUIC path. Headless/CI environments (and the server-side Ship
      // pipeline) frequently can't reach the TPU's websocket slot-leader
      // endpoint; --use-rpc keeps the deploy on the same HTTP endpoint we
      // already target. Devnet only.
      '--use-rpc',
      '--output',
      'json',
    ],
    fixtureDir,
    log,
  );

  const deployOutput = parseDeployOutput(out);
  const deployedId = deployOutput.programId ?? programId;

  // 6) The Solana CLI can leave the intermediate upgrade buffer allocated after
  //    a successful deploy/upgrade. This rails deployer is throwaway/devnet-only,
  //    so any post-deploy buffer under its authority is cleanup noise; close it
  //    immediately and return the rent to the deployer.
  await closeUpgradeableBuffers(target, payer, fixtureDir, log);

  // 7) Use the exact deploy/upgrade signature from CLI JSON. Falling back to an
  // address lookup can race index freshness and return the previous upgrade.
  const signature = deployOutput.signature ?? (await fetchLatestSignature(target, deployedId));

  const result: DeployResult = {
    programId: deployedId,
    signature,
    cluster: target.label,
    explorer: explorerUrl(target, 'address', deployedId),
  };
  log(`deployed ${result.programId} on ${result.cluster}`);
  log(`explorer: ${result.explorer}`);
  return result;
}

interface SolanaProgramDeployOutput {
  programId?: string;
  signature?: string;
}

/** Parse `solana program deploy --output json`. */
function parseDeployOutput(stdout: string): SolanaProgramDeployOutput {
  const start = stdout.indexOf('{');
  if (start === -1) return {};
  try {
    return JSON.parse(stdout.slice(start)) as SolanaProgramDeployOutput;
  } catch {
    return {};
  }
}

/** Most recent transaction signature touching the program account. */
async function fetchLatestSignature(target: ClusterTarget, programId: string): Promise<string> {
  return getLatestSignatureForAddress(target, programId);
}

/** Close any deployer-owned upgrade buffers left by `solana program deploy`. */
async function closeUpgradeableBuffers(
  target: ClusterTarget,
  recipient: string,
  cwd: string,
  log: (m: string) => void,
): Promise<void> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= CLOSE_BUFFER_ATTEMPTS; attempt += 1) {
    try {
      const out = await run(
        'solana',
        [
          'program',
          'close',
          '--buffers',
          '--authority',
          DEPLOYER_KEYPAIR_PATH,
          '--recipient',
          recipient,
          '--url',
          target.rpcUrl,
          '--commitment',
          'confirmed',
          '--output',
          'json',
        ],
        cwd,
        log,
      );

      const closed = parseClosedBuffers(out);
      log(`closed ${closed.length} deploy buffer${closed.length === 1 ? '' : 's'}`);
      return;
    } catch (error) {
      lastError = error;
      const detail = error instanceof Error ? error.message : String(error);
      if (attempt === CLOSE_BUFFER_ATTEMPTS) break;
      log(`close deploy buffers failed (${detail}); retrying`);
      await sleep(CLOSE_BUFFER_RETRY_DELAY_MS * attempt);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

interface SolanaProgramCloseBuffersOutput {
  buffers?: Array<{ address?: string }>;
}

function parseClosedBuffers(stdout: string): string[] {
  const start = stdout.indexOf('{');
  if (start === -1) return [];
  try {
    const output = JSON.parse(stdout.slice(start)) as SolanaProgramCloseBuffersOutput;
    return output.buffers?.flatMap((buffer) => (buffer.address ? [buffer.address] : [])) ?? [];
  } catch {
    return [];
  }
}
