#!/usr/bin/env -S npx tsx
/**
 * Minimal headless CLI for the rails. Devnet only.
 *
 *   tsx src/cli.ts address                 # print the deployer address (never the secret)
 *   tsx src/cli.ts fund [sol]              # airdrop devnet SOL to the deployer (default 2)
 *   tsx src/cli.ts render <destDir>        # render the counter archetype (customized) into destDir
 *   tsx src/cli.ts deploy [workspace]      # build + deploy a workspace to devnet (default: fixture)
 *   tsx src/cli.ts ship [workspace] [--emit-client]   # faucet → deploy (→ client → publish)
 *
 * Output is JSON on the final line so it is easy to capture headlessly.
 */

import { devnet } from './cluster/ClusterTarget.js';
import { deployerAddress, loadOrCreateDeployer } from './keypair/deployer.js';
import { deploy } from './deploy/deploy.js';
import { fund, getBalanceSol } from './faucet/faucet.js';
import { ship } from './ship.js';
import { renderArchetype } from './program/renderArchetype.js';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const [command, arg] = args;
  const flags = new Set(args.filter((a) => a.startsWith('--')));
  const positionals = args.slice(1).filter((a) => !a.startsWith('--'));
  const target = devnet();

  switch (command) {
    case 'render': {
      const destDir = positionals[0];
      if (!destDir) {
        console.error('usage: rails render <destDir> [archetype]');
        process.exitCode = 1;
        return;
      }
      const archetype = positionals[1] ?? 'counter';
      // A representative *customized* spec so `render` exercises substitution,
      // not just the defaults (proves the no-free-form-Rust slot path builds).
      const result = renderArchetype(
        {
          archetype,
          state: { name: 'Tally', field: 'tally' },
          instructions: ['initialize', 'bump'],
        },
        destDir,
      );
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    case 'address': {
      const address = deployerAddress(loadOrCreateDeployer());
      const balanceSol = await getBalanceSol(target, address);
      console.log(JSON.stringify({ address, balanceSol, cluster: target.label }, null, 2));
      return;
    }
    case 'fund': {
      const address = deployerAddress(loadOrCreateDeployer());
      const sol = arg ? Number(arg) : 2;
      const result = await fund(target, address, sol);
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    case 'deploy': {
      const workspace = positionals[0];
      const result = await deploy(target, { fixtureDir: workspace });
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    case 'ship': {
      const workspace = positionals[0];
      const result = await ship(target, {
        workspace,
        emitClient: flags.has('--emit-client'),
        skipClientInstall: flags.has('--skip-client-install'),
      });
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    default:
      console.error('usage: rails <address|fund [sol]|render <destDir>|deploy [workspace]|ship [workspace] [--emit-client]>');
      process.exitCode = 1;
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
