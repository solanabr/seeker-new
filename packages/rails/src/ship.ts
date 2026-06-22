/**
 * One-shot `ship` orchestration — the rails' demo segment.
 *
 * `ship(target)` runs the last mile end-to-end against devnet:
 *
 *     faucet (fund the deployer) → deploy (build + deploy the program)
 *       → [emit TS client] → publish
 *
 * and returns the program ID plus every signature it produced (airdrop +
 * deploy), and — when `emitClient` is set — the generated `@solana/kit` client. The publish step is a seam: when the dApp Store publish task lands it
 * plugs in via `opts.publish`; until then `ship` stops cleanly after deploy with
 * a "publish pending API confirmation" note (see `docs/publish-api.md`).
 *
 * SAFETY — devnet only. `ship` refuses any non-devnet target up front. This is
 * the orchestration-level backstop behind "devnet only" and the exact seam where
 * a future mainnet path must add an explicit confirmation gate + "unaudited"
 * warnings before any transaction is sent — it is intentionally NOT implemented.
 */

import type { ClusterTarget } from './cluster/ClusterTarget.js';
import { assertDevnetTarget } from './cluster/ClusterTarget.js';
import { deployerAddress, loadOrCreateDeployer } from './keypair/deployer.js';
import { deploy, type DeployResult } from './deploy/deploy.js';
import { fund, getBalanceSol } from './faucet/faucet.js';
import { generateClient, type GenerateClientResult } from './program/generateClient.js';

/** Deploy needs rent for the program-data account; keep a buffer (mirrors deploy). */
const MIN_DEPLOYER_SOL = 3;
const TOP_UP_TO_SOL = 5;

/** Outcome of the publish step. `pending` until the dApp Store publish lands. */
export type PublishOutcome =
  | { status: 'published'; publisher: string; app: string; release: string }
  | { status: 'pending'; note: string };

/** Default publish outcome while the dApp Store publish task is cut/carried. */
export const PUBLISH_PENDING: PublishOutcome = {
  status: 'pending',
  note:
    'publish pending API confirmation — the dApp Store publish path is cut this ' +
    'sprint and carried to the next rails sprint (see docs/publish-api.md).',
};

/** Context handed to a publish implementation once one is wired in (T05 seam). */
export interface PublishContext {
  target: ClusterTarget;
  deployer: string;
  deploy: DeployResult;
}

export interface ShipResult {
  cluster: ClusterTarget['label'];
  /** Public deployer address (never the secret). */
  deployer: string;
  programId: string;
  signatures: {
    /** Faucet airdrop signatures (empty if the deployer was already funded). */
    airdrop: string[];
    /** The program deploy/upgrade signature. */
    deploy: string;
  };
  /** Explorer link for the deployed program. */
  explorer: string;
  /**
   * Generated `@solana/kit` client artifacts (IDL + client dir), present when
   * `emitClient` is set and the generated workspace carries the Codama
   * toolchain. Injected into the app downstream (program ID + this client).
   */
  client?: GenerateClientResult;
  publish: PublishOutcome;
}

export interface ShipOptions {
  log?: (message: string) => void;
  /** Assume the deployer is already funded; skip the faucet step. */
  skipAutoFund?: boolean;
  /**
   * The generated Anchor workspace to build + deploy. Defaults to the vendored
   * fixture counter when omitted (Sprint 2 behavior). Point this at the program
   * the generator emitted for the current project.
   */
  workspace?: string;
  /** Emit a `@solana/kit` client from the built IDL after deploy (R3.2). */
  emitClient?: boolean;
  /** Skip `pnpm install` during client emission (deps already present). */
  skipClientInstall?: boolean;
  /**
   * Publish seam. Supplied when the dApp Store publish task lands; receives the
   * deploy result and returns the minted on-chain identities. When omitted,
   * `ship` returns `PUBLISH_PENDING` (the current, deliberately-cut state).
   */
  publish?: (ctx: PublishContext) => Promise<PublishOutcome>;
}

/**
 * Run faucet → deploy (→ publish if wired) end-to-end against devnet.
 * Returns the program ID and every signature produced. Idempotent: a re-run
 * upgrades the same program in place and tops the deployer up only if low.
 */
export async function ship(target: ClusterTarget, opts: ShipOptions = {}): Promise<ShipResult> {
  assertDevnetTarget(target, 'ship()');
  const { log = console.log, skipAutoFund = false, workspace, emitClient = false } = opts;

  const deployer = deployerAddress(loadOrCreateDeployer());
  log(`▶ ship → ${target.label}`);
  log(`  deployer: ${deployer}`);

  // 1) Faucet. Top the deployer up from the devnet faucet only when it is short,
  //    capturing the airdrop signatures for the transcript.
  let airdrop: string[] = [];
  if (!skipAutoFund) {
    const balance = await getBalanceSol(target, deployer);
    if (balance < MIN_DEPLOYER_SOL) {
      log(`  faucet: ${balance} SOL < ${MIN_DEPLOYER_SOL}; topping up to ${TOP_UP_TO_SOL}`);
      // Best-effort: the public devnet faucet is frequently dry/throttled (a
      // documented hazard). A dry faucet must not abort a ship when the deployer
      // already holds enough to (re)deploy — e.g. an in-place program upgrade
      // costs far less than a fresh deploy. Warn and continue; the deploy step
      // fails with a clear, specific error if the balance is genuinely too low.
      try {
        const funded = await fund(target, deployer, TOP_UP_TO_SOL - balance, { log });
        airdrop = funded.signatures;
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        log(`  faucet: top-up failed (${detail}); continuing with ${balance} SOL`);
      }
    } else {
      log(`  faucet: ${balance} SOL (>= ${MIN_DEPLOYER_SOL}); no airdrop needed`);
    }
  }

  // 2) Deploy. The faucet step already funded the deployer, so skip deploy's own
  //    auto-fund to avoid a redundant balance round-trip. `workspace` points the
  //    build+deploy at the generated program (default: the vendored fixture).
  const deployResult = await deploy(target, { skipAutoFund: true, fixtureDir: workspace, log });

  // 3) Client. Emit a @solana/kit client from the built IDL so the app can call
  //    the deployed program (R3.2). Off by default to preserve fixture behavior.
  let client: GenerateClientResult | undefined;
  if (emitClient) {
    if (!workspace) {
      throw new Error('ship({ emitClient: true }) requires a generated workspace');
    }
    client = await generateClient(workspace, { skipInstall: opts.skipClientInstall, log });
  }

  // 4) Publish. Wired in by the dApp Store publish task; pending until then.
  const publish = opts.publish
    ? await opts.publish({ target, deployer, deploy: deployResult })
    : PUBLISH_PENDING;

  if (publish.status === 'pending') {
    log(`  publish: ${publish.note}`);
  } else {
    log(`  publish: release ${publish.release} (app ${publish.app})`);
  }

  const result: ShipResult = {
    cluster: deployResult.cluster,
    deployer,
    programId: deployResult.programId,
    signatures: { airdrop, deploy: deployResult.signature },
    explorer: deployResult.explorer,
    client,
    publish,
  };
  log(`✔ shipped ${result.programId} on ${result.cluster}`);
  return result;
}
