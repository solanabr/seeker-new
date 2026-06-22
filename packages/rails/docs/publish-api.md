# Solana dApp Store publish — API surface spike

**Question:** what is the exact, automatable surface for minting the
publisher/app/release NFTs so the rails can publish a deployed app — and can it
run on devnet/testnet? (PRD §17 Q2; this is the gate for the publish task.)

**Verdict: NO-GO for an automated devnet/testnet publish in this window → publish
is cut and carried.** The deploy + faucet spine ships without it. Details below.

## What the publishing flow actually is

Publisher, app, and release records are minted as **standard Metaplex NFTs** with
dApp-Store-specific metadata, in a fixed hierarchy:

- **Publisher NFT** — your identity; minted once, reused across all your apps.
- **App NFT** — one per application, linked to the Publisher NFT via the Metaplex
  Certified Collection standard.
- **Release NFT** — immutable, one per version; a new version = a new release NFT.

Two generations of tooling exist:

1. **Portal-based CLI (current / supported)** — `@solana-mobile/dapp-store-cli`,
   invoked as `dapp-store --apk-file <apk> --keypair <id.json> --whats-new "…"`.
   It uploads to the **Publisher Portal**, which reads the Android package name
   from the **APK**, matches it to an app already registered in the portal, and
   submits the on-chain release transaction. Requires a **portal API key**
   (`DAPP_STORE_API_KEY`) and an app/App-NFT already created in the portal.
2. **Direct-mint CLI (legacy)** — the `dapp-publishing` repo's
   `npx dapp-store create publisher | app | release` commands minted the NFTs
   directly against an RPC you pass; the well-known footgun was "forgetting to
   change `cluster` from `devnet` to `mainnet-beta` before release," i.e. it
   *could* be pointed at devnet to exercise the mint mechanics.

## Why this is a no-go for the sprint (devnet-only, 1-day window)

- **The dApp Store is a mainnet-beta product.** The store users browse, and the
  supported portal publish path, are mainnet. There is no devnet/testnet store to
  publish *into*; a devnet mint via the legacy CLI produces throwaway NFTs wired
  to nothing. R4.2's "mint on devnet/testnet, return on-chain identities" is only
  literally satisfiable by the deprecated direct-mint path, and even then it does
  not produce a *published* app.
- **Publish needs a signed release APK**, not a program. The rails deploy a
  program; turning a generated app into a store-ready, release-key-signed APK is
  a **cross-track dependency on the builder's app output** — explicitly out of
  scope this sprint (spec "Gray areas / deploy fixture vs. real generated
  program").
- **The supported path is portal + API-key + mainnet** — confirming the exact
  automatable portal API surface (and obtaining a key) is the concrete
  **beeman / IslandDAO ask** (PRD §14) and was not closed in the window.
- **This sprint is devnet-only behind a hard mainnet gate** (PRD §7.6/§15). A real
  mainnet publish is exactly what the gate forbids without explicit confirmation +
  "unaudited" warnings.

## Go/no-go

**NO-GO** — cut the publish task (scope cut #1). Ship the deploy + faucet spine;
`ship()` stops cleanly after deploy with a "publish pending API confirmation"
note (the publish seam is architected, not implemented). Carry publish to the
next rails sprint, where it can be paired with (a) a builder-produced signed APK
and (b) a confirmed portal API key + the mainnet confirmation gate.

## Update — automatable-surface narrowing

Building on the verdict above, this pass pins down exactly *what would have to be
automatable* and confirms the blockers are unchanged. **Verdict still NO-GO for a
headless publish in this window; the deploy + client spine ships without it.**

### Can the Publisher-Portal API key run headlessly?

- The portal CLI authenticates with a `DAPP_STORE_API_KEY` passed via env — that
  part *is* headless-friendly.
- **But the key is not self-serve.** It is issued through the Publisher Portal
  after a manual onboarding/eligibility step; there is no documented API to mint a
  key programmatically. So the *first* publish for any publisher requires a human,
  out-of-band step. After that, release submission with an existing key/app could
  run headless.
- Net: **partially automatable** — release submission yes, initial key + app
  registration no. This is the concrete external dependency.

### Exact release-APK requirement

- The portal path keys off a **signed release APK**: it reads the Android package
  name and version from the APK and matches it to a portal-registered app.
- That means publish needs (a) a real **built, release-key-signed Android binary**
  of the generated app, and (b) a stable applicationId. Our generated app today is
  an Expo/`kit-expo-minimal` source tree — **producing a signed release APK is a
  builder-track build step we do not have** (EAS build or local Gradle release
  signing). This is the cross-track dependency, and it is the gating item, not the
  on-chain mint.
- A program (what these rails deploy) is **not** what publish consumes — the two
  are independent artifacts. The deployed program ID can be referenced from the
  app, but publish needs the APK, not the program.

### Devnet vs mainnet

- Unchanged and decisive: **the dApp Store is mainnet-beta only.** There is no
  devnet/testnet store to publish into. The legacy direct-mint CLI can be pointed
  at devnet to exercise mint *mechanics*, but it produces throwaway NFTs wired to
  nothing and does not yield a published app. This sprint is devnet-only behind a
  hard mainnet gate, so a real publish is out of scope by policy as well as by
  external blocker.

### GO/NO-GO

**NO-GO** for an automated publish this sprint. The seam stays architected
(`ship({ publish })` → `PUBLISH_PENDING`); nothing minted, no mainnet path added.

### Concrete next steps (carry to a publish sprint)

1. **Builder track:** add a release-APK build step (EAS build or Gradle release
   signing) for the generated app + a stable `applicationId`. This unblocks
   everything else and is the long pole.
2. **The beeman / IslandDAO ask (PRD §14):** confirm how to obtain a
   Publisher-Portal API key for an automated/agent flow, whether app registration
   can be scripted, and the minimum viable mainnet release path for a hackathon
   demo (or whether a sanctioned devnet demo mint is acceptable).
3. **Rails track (when 1+2 land):** implement an `opts.publish` provider that
   shells the portal CLI (`dapp-store ... --apk-file <signed.apk> --keypair ...`)
   behind the **mainnet confirmation gate + "unaudited" warnings** required by the
   safety model, and return the minted publisher/app/release identities.

## Sources

- dApp Publishing CLI — Solana Mobile Docs: <https://docs.solanamobile.com/dapp-store/publishing-cli>
- Submit your dApp release — Solana Mobile Docs: <https://docs.solanamobile.com/dapp-publishing/submit>
- Publishing overview — Solana Mobile Docs: <https://docs.solanamobile.com/dapp-publishing/overview>
- Publishing spec (NFT hierarchy) — `solana-mobile/dapp-publishing` SPEC.md: <https://github.com/solana-mobile/dapp-publishing/blob/main/publishing-spec/SPEC.md>
- Blueshift course — Publishing to the Solana dApp Store (devnet→mainnet-beta pitfall): <https://learn.blueshift.gg/en/courses/dapp-store-publishing/solana-dapp-store>
