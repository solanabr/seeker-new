# @seeker/rails

Headless rails for shipping a Solana program on-chain — the last mile of the
demo spine. Given a program, the rails fund a throwaway **devnet** deployer from
a built-in faucet and deploy it, returning a real program ID and deploy
signature.

> **Devnet only.** Everything here operates against devnet, where funds are
> throwaway. A real-funds (mainnet) target is *representable* in the cluster
> abstraction so callers can be written against it today, but it is
> **deliberately not implemented** — resolving or deploying to it throws. When a
> real-funds target is added later it must sit behind an explicit confirmation
> gate and prominent "unaudited" warnings.

## Layout

```
src/
  cluster/ClusterTarget.ts   # cluster/target abstraction (devnet impl; mainnet representable, unimplemented)
  keypair/deployer.ts        # throwaway deployer keypair, stored gitignored, secret never logged
  faucet/faucet.ts           # devnet airdrop with retry/backoff + auto-fund helper
  solana/rpc.ts              # minimal JSON-RPC helpers over native fetch (no runtime deps)
  deploy/deploy.ts           # build + deploy the fixture to devnet
  cli.ts                     # minimal headless CLI (address / fund / deploy)
  index.ts                   # public API
fixtures/
  anchor-counter/            # minimal Anchor counter — the deploy target
```

## Prerequisites

The deploy step shells out to the standard Solana toolchain (these are not npm
deps). The versions matter — see "SBPF version" below:

- `solana` (Agave) CLI **≥ 4.0.3** — older CLIs (e.g. 3.0.x) cannot deploy the
  SBPFv3 bytecode devnet now requires; their verifier rejects the ELF locally.
- `cargo` + the Solana platform-tools **v1.54+** (auto-downloaded by
  `cargo build-sbf --tools-version v1.54`) — the first platform-tools with both
  a modern rustc (for the `edition2024` dependencies) and the `sbpfv3` target.
- `anchor` (Anchor CLI) — used only for `anchor keys sync` (to align the
  program's `declare_id!` with its deploy keypair).
- `solana-keygen` — generates the program keypair on first deploy.

## Usage

```bash
pnpm --dir packages/rails install
pnpm --dir packages/rails typecheck

# Inspect the deployer (creates a throwaway keypair on first run). Prints the
# public address and balance — never the secret.
pnpm --dir packages/rails address

# Airdrop devnet SOL to the deployer (retries/backs off through rate-limits).
pnpm --dir packages/rails fund 2

# Build + deploy the fixture to devnet. Auto-funds the deployer if its balance
# is low, then prints { programId, signature, cluster, explorer } as JSON.
pnpm --dir packages/rails deploy

# One-shot ship: faucet → deploy (→ publish when wired) end-to-end. Prints
# { cluster, deployer, programId, signatures, explorer, publish } as JSON.
pnpm --dir packages/rails ship
```

Programmatic:

```ts
import { devnet, deploy, ship, deployerAddress, loadOrCreateDeployer } from '@seeker/rails';

const target = devnet();
const result = await ship(target); // faucet → deploy → publish-seam, one call
```

## One-shot `ship`

`ship(target)` is the rails' demo segment — the "one-click ship" the product
promises. It runs the last mile end-to-end against devnet:

```
faucet (top up the deployer if low) → deploy (build + deploy the program) → publish
```

and returns the program ID plus every signature it produced:

```jsonc
{
  "cluster": "devnet",
  "deployer": "<public address only>",
  "programId": "<deployed program id>",
  "signatures": { "airdrop": ["…"], "deploy": "…" },
  "explorer": "https://explorer.solana.com/address/<id>?cluster=devnet",
  "publish": { "status": "pending", "note": "publish pending API confirmation …" }
}
```

The **publish** step is a seam (`ShipOptions.publish`). The dApp Store publish
path is **cut this sprint** (see [`docs/publish-api.md`](./docs/publish-api.md)
for the go/no-go), so `ship` stops cleanly after deploy with a `pending` note.
When the publish task lands, a publish implementation plugs into the seam without
changing callers.

**Devnet only.** `ship` refuses any non-devnet target up front — the
orchestration-level backstop behind "devnet only", and the exact seam where a
future mainnet ship must add an explicit confirmation gate + "unaudited"
warnings. Mainnet is deliberately not implemented.

## Deploy mechanism (and why)

The deploy path is: **ensure program keypair → `anchor keys sync` →
`cargo build-sbf --arch v3` → `solana program deploy --output json` → return the
deploy signature from the CLI JSON.**

- A program keypair (the program's on-chain address) is generated with
  `solana-keygen` on first run, under the gitignored `target/deploy/`, and
  persists across runs.
- `anchor keys sync` rewrites the `declare_id!` in the program (and
  `Anchor.toml`) to match that keypair, so the deployed bytecode's program-id
  check matches the deploy address. This runs **before** the build so the synced
  id is embedded.
- `cargo build-sbf --tools-version v1.54 --arch v3` builds the deployable `.so`.
  We call `cargo build-sbf` directly rather than `anchor build` because Anchor
  does not expose the `--arch` selector, and the arch is load-bearing (below).
- `solana program deploy ... --output json` is the most reliable **headless**
  path (vs. interactive `anchor deploy`): it targets devnet explicitly via
  `--url`, pays with our gitignored deployer keypair via `--keypair`, deploys to
  the program keypair via `--program-id`, and emits the program ID + deploy
  signature as JSON.
- The explorer-verifiable **signature** is taken from that CLI JSON output. A
  JSON-RPC signature lookup exists only as a fallback for older CLI output
  shapes, because address lookups can race index freshness and return the prior
  upgrade.

Re-running `deploy()` with the same program keypair **upgrades** the program in
place (the program keypair persists under the gitignored `target/deploy/`).

### SBPF version (the load-bearing detail)

devnet (Agave 4.x) currently requires **SBPFv3** for new program deployments and
rejects older versions at deploy time (`Detected sbpf_version required by the
executable which are not enabled`). So:

- the bytecode is built with `--arch v3` (overridable via
  `SEEKER_RAILS_SBF_ARCH` / `SEEKER_RAILS_SBF_TOOLS_VERSION` as the enabled
  version set evolves), and
- the **CLI must be ≥ 4.0.3** — a 3.0.x CLI's verifier doesn't enable v3 and
  fails the ELF locally before it ever reaches the network.

Building v3 also needs platform-tools **v1.54+** (older v1.5x either lacks the
`sbpfv3` sysroot or has a rustc too old for the `edition2024` deps).

### Runtime dependencies

This package has **no production npm dependencies**. It uses the already-required
Solana CLI tools for keypair files / program deploys, and a tiny local JSON-RPC
helper (`src/solana/rpc.ts`) over Node's native `fetch` for balances, airdrops,
signature confirmation, and signature lookup. That keeps the rails package
license-clean for later standalone OSS extraction.

## Safety

- **No mainnet path.** `resolveTarget` only resolves `devnet`; every exported
  RPC-touching operation (`getBalanceSol`, `fund`, `ensureFunded`, `deploy`,
  `ship`) asserts the target is devnet. A real-funds path is absent by
  construction.
- **No secrets logged or committed.** The deployer is a throwaway devnet keypair
  at `.rails/deployer.json` (gitignored, `0600`). Only its **public address** is
  ever printed or returned — the secret key never leaves `keypair/deployer.ts`.
- **MIT-compatible deps only**, so this package stays cheap to extract to a
  standalone OSS dependency later.

## Devnet faucet rate-limits

The public devnet faucet (`requestAirdrop`) throttles aggressively and is
frequently fully exhausted (HTTP 429 / "airdrop limit reached"). The faucet
retries with exponential backoff and a clear message. If it stays throttled:

- set `SEEKER_RAILS_RPC_URL` to an alternate devnet RPC, or
- fund the deployer address manually at <https://faucet.solana.com>, or
- transfer devnet SOL from an existing devnet wallet:
  `solana transfer <deployer-address> 5 --url https://api.devnet.solana.com --allow-unfunded-recipient`.

Get the address to fund with `pnpm --dir packages/rails address`.
