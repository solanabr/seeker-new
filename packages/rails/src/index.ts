/**
 * @seeker/rails — headless rails for shipping a Solana program on-chain.
 *
 * The last mile of the demo spine: take a program, fund a throwaway devnet
 * deployer from a built-in faucet, and deploy it to devnet — returning a real
 * program ID + deploy signature. Devnet only; a real-funds path is deliberately
 * absent (see `ClusterTarget`).
 */

export type { ClusterTarget, ClusterLabel } from './cluster/ClusterTarget.js';
export { devnet, resolveTarget, explorerUrl } from './cluster/ClusterTarget.js';

export type { DeployerKeypair } from './keypair/deployer.js';
export {
  loadOrCreateDeployer,
  deployerAddress,
  DEPLOYER_KEYPAIR_PATH,
  RAILS_DIR,
} from './keypair/deployer.js';

export type { FundOptions, FundResult } from './faucet/faucet.js';
export { fund, ensureFunded, getBalanceSol } from './faucet/faucet.js';

export type { DeployResult, DeployOptions } from './deploy/deploy.js';
export { deploy, FIXTURE_DIR } from './deploy/deploy.js';

export type { ShipResult, ShipOptions, PublishOutcome, PublishContext } from './ship.js';
export { ship, PUBLISH_PENDING } from './ship.js';

export type {
  ArchetypeRenderSpec,
  RenderResult,
  RenderIdentifiers,
  RailsProgramArchetype,
} from './program/renderArchetype.js';
export {
  renderArchetype,
  ARCHETYPES_DIR,
  RAILS_PROGRAM_ARCHETYPES,
  PROGRAM_ARTIFACT,
} from './program/renderArchetype.js';

export type { GenerateClientResult } from './program/generateClient.js';
export { generateClient } from './program/generateClient.js';
