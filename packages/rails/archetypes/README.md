# Anchor archetype library

Curated, known-good Anchor program skeletons. The plan's `programSpec` selects
one of these and fills a small set of **identifier slots** (account/struct name,
stored field, instruction names) — the program is **never free-form Rust**. The
fixed skeleton is the safety rail that keeps generated programs compiling and
correct.

## How customization works (the "no free-form Rust" guarantee)

Customization is **deterministic identifier substitution**, not code generation:

1. The orchestrator LLM produces a `programSpec` (which archetype + names) — it
   never emits Rust.
2. `renderArchetype` (in `../src/program/renderArchetype.ts`) copies the chosen
   skeleton, then substitutes only validated identifiers into `lib.rs`:
   - every name is sanitized to a strict Rust identifier (`snake_case` for
     fields/instructions/seeds, `PascalCase` for the account struct);
   - anything that fails validation falls back to the archetype default;
   - the only free text that reaches Rust is inside `#[msg("…")]` string
     literals, which are fixed in the skeleton (not spec-driven).

There is **no path** by which model output becomes arbitrary Rust. The structure
of every generated program is exactly the structure committed here.

## Layout

```
archetypes/
  <archetype>/
    Anchor.toml                       # [programs.devnet] seeker_program = <placeholder id>
    Cargo.toml                        # workspace
    codama.json                       # IDL -> @solana/kit client (Codama)
    package.json                      # codama devDeps + generate:client script
    clients/ts/package.json           # generated client package shell
    programs/seeker_program/
      Cargo.toml
      src/lib.rs.tmpl                 # tokenized skeleton ({{SLOT}} placeholders)
```

The crate/program name is **fixed** (`seeker_program`) across every generated
program so the IDL filename, deploy artifact, and Codama output paths are
deterministic; programs are distinguished on-chain by their program ID, not the
crate name.

## Archetypes

| Key       | Status   | Shape |
|-----------|----------|-------|
| `counter` | curated  | Per-authority PDA holding one `u64`, with initialize + increment (overflow-checked, authority-gated). Covers tallies, streaks, points, check-ins, vote counts. |
| `spl-token-mint` | reserved | (slot — not yet curated) |
| `escrow`  | reserved | (slot — not yet curated) |
| `vote`    | reserved | (slot — not yet curated) |

Adding the next archetype is mechanical: drop a sibling `<archetype>/` directory
in the same shape, add a `lib.rs.tmpl` with the slots it needs, and register it
in `renderArchetype`. Keep the supported set in sync with the builder's
`SUPPORTED_PROGRAM_ARCHETYPES`.

## Build / client toolchain

- Build: `cargo build-sbf --tools-version v1.54 --arch v3` (devnet SBPFv3).
- Client: Codama (`@codama/renderers-js`, `kitImportStrategy: rootOnly`) — emits
  a `@solana/kit`-only client, matching the `kit-expo-minimal` template. Codama
  is a **devDependency of the generated workspace**, never a production dep of
  `@seeker/rails`.
