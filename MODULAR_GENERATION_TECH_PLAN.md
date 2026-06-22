# Modular Generation Tech Plan

## Purpose

Turn the architecture from `MODULAR_GENERATION_ARCHITECTURE.md` into an executable refactor plan for the current `seeker.new` codebase.

This document focuses on:

- exact folder changes
- which current files should move where
- which packages need new responsibilities
- what the migration order should be

## Current State

The current system still assumes one full template:

- `apps/templates/solana-mobile`

And one main generation engine:

- `packages/template-engine`

The builder then:

1. creates a plan
2. copies the whole template
3. rewrites a subset of files
4. streams the result into the workbench

That is enough for a starter MVP, but it is not the right long-term generation model.

## Target State

The generator should move to:

- `base scaffold`
- `module composition`
- `reference template`
- `AI plan -> deterministic compose -> AI adapt`

## Proposed Directory Refactor

### Current

```text
apps/templates/
  solana-mobile/
```

### Target

```text
apps/templates/
  base/
    solana-mobile-base/
  modules/
    auth-wallet/
    auth-email/
    profile/
    solana-balance/
    ai-chat/
    todos/
    dashboard/
    airdrops/
    payments-send/
  reference/
    solana-mobile-full/
```

## What To Do With The Current Template

The current `apps/templates/solana-mobile` should not be deleted.

It should be split into three destinations:

### 1. `reference/solana-mobile-full`

This should be a near-direct preservation of the current full template.

Use:

- internal implementation reference
- source for extracting modules
- source for future AI adaptation

### 2. `base/solana-mobile-base`

This should become the minimal scaffold used by default for generation.

### 3. `modules/*`

Feature-specific slices extracted from the current template.

## Folder-Level Migration Plan

### A. Create `apps/templates/reference/solana-mobile-full`

Action:

- copy the current `apps/templates/solana-mobile` to `apps/templates/reference/solana-mobile-full`

Why:

- preserve the current full starter
- avoid blocking the refactor
- keep a stable implementation reference while extracting pieces

### B. Create `apps/templates/base/solana-mobile-base`

This is the first high-value extraction.

Keep:

- root workspace files
- minimal `apps/mobile`
- minimal `apps/api`
- minimal `apps/web` if web is always part of the product
- `packages/config`
- `packages/env`
- `packages/api` core router shell
- `packages/auth` only if auth is treated as core base
- `packages/db` minimal schema shell
- `packages/solana-client` core utilities

Remove from base:

- todos
- ai screens
- dashboard feature content
- example tabs
- example routes
- rich sample screens
- non-essential demo flows

### C. Create `apps/templates/modules/*`

Each module should become an isolated mergeable slice.

## Suggested Initial Module Extraction

Use the current full template to extract these first:

### `auth-wallet`

Likely source areas:

- `apps/mobile/features/auth/*`
- auth-related providers and wallet sign-in pieces
- `packages/auth/*`
- relevant API wiring

### `profile`

Likely source areas:

- `apps/mobile/features/profile/*`
- profile tab / route wiring

### `solana-balance`

Likely source areas:

- `packages/solana-client/*`
- `packages/api/src/routers/solana.ts`
- `apps/mobile/features/solana/*`
- `apps/web/src/features/solana/*` if web support is selected

### `ai-chat`

Likely source areas:

- `apps/mobile/features/ai/*`
- `apps/web/src/features/ai/*`
- `/ai` handler pieces already present in the API

### `todos`

Likely source areas:

- `packages/db/src/schema/todo.ts`
- `packages/api/src/routers/todo.ts`
- mobile todo feature files
- web todo feature files

### `dashboard`

Likely source areas:

- `apps/web/src/features/dashboard/*`
- dashboard routes

### Future modules

- `airdrops`
- `payments-send`
- `activity-feed`
- `portfolio`

These may not exist yet in the template and can start as module specs before implementation exists.

## Module Format

Each module should be self-describing.

Suggested structure:

```text
apps/templates/modules/auth-wallet/
  module.json
  files/
    apps/mobile/features/auth/...
    packages/auth/...
    packages/api/...
  patches/
    merge.json
```

Alternative simpler version:

```text
apps/templates/modules/auth-wallet/
  module.json
  files/** 
```

Where `files/**` mirrors the final repo-relative destination.

## Module Metadata Contract

Each module should expose a machine-readable definition.

Suggested `module.json`:

```json
{
  "name": "auth-wallet",
  "description": "Wallet-based authentication for Solana Mobile apps",
  "selectedApps": ["mobile", "api"],
  "dependsOn": [],
  "optionalDependsOn": ["profile"],
  "tags": ["auth", "wallet", "solana"],
  "writes": [
    "apps/mobile/features/auth/**",
    "packages/auth/**",
    "packages/api/**"
  ],
  "entrypoints": [
    "apps/mobile/app/_layout.tsx",
    "apps/api/src/index.ts"
  ]
}
```

## Package Responsibilities After Refactor

### `packages/ai-orchestrator`

Current role:

- generate the project plan

Future role:

- generate a composition-ready plan
- select apps
- select modules
- request exclusions
- propose new files and file edits

New output fields:

- `selectedApps`
- `selectedModules`
- `excludedModules`
- `newFiles`
- `fileEdits`

It should not:

- copy template files
- merge modules
- write project output

### `packages/template-engine`

Current role:

- copy the full starter
- rename base files
- expose files to workbench

Future role:

- scaffold from `base`
- merge `modules`
- resolve module dependencies
- apply deterministic project identity changes
- emit a final file map

Recommended new responsibilities:

- `copyBaseTemplate()`
- `mergeSelectedModules()`
- `resolveModuleDependencies()`
- `collectMergedFiles()`
- `createProjectFromComposition()`

It should not:

- do AI planning
- invent feature structure

### `packages/shared`

Current role:

- share plan and editable-file types

Future role:

- define `ProjectPlan`
- define `ModuleDefinition`
- define composition contracts
- define allowed write zones

Suggested new types:

```ts
type AppTarget = 'mobile' | 'web' | 'api';

interface ModuleDefinition {
  name: string;
  description: string;
  selectedApps: AppTarget[];
  dependsOn: string[];
  optionalDependsOn: string[];
  tags: string[];
  writes: string[];
  entrypoints: string[];
}
```

## Builder-Side Changes

### `apps/builder/app/routes/api.chat.ts`

Future change:

- no longer call “copy full template”
- instead call “compose project”

The server flow becomes:

1. plan confirmed
2. planner returns `selectedModules`
3. composer builds output from base + modules
4. customizer applies prompt-specific edits
5. artifact streams scaffold + module additions + custom files

### `apps/builder/app/components/chat/Artifact.tsx`

Future change:

Artifact output should distinguish:

- base scaffold
- module composition
- AI-created files
- commands

Recommended action labels:

- `Create starter from base template`
- `Add module: auth-wallet`
- `Add module: solana-balance`
- `Create apps/mobile/features/airdrops/...`
- `Update apps/mobile/app/index.tsx`
- `Install dependencies`

## Template Classification Pass

Before moving files, do a classification pass on the current template.

Create a temporary matrix:

- file path
- base / module / reference
- module owner
- depends on

Recommended output file:

- `apps/templates/TEMPLATE_CLASSIFICATION.md`

This will prevent accidental duplication or orphaned files during extraction.

## Concrete Migration Order

### Phase 1. Preserve reference

1. create `apps/templates/reference/solana-mobile-full`
2. copy the existing full template there

### Phase 2. Define contracts

1. add `ModuleDefinition` to `packages/shared`
2. expand `ProjectPlan` with module selection fields
3. define module metadata format

### Phase 3. Create minimal base

1. create `apps/templates/base/solana-mobile-base`
2. prune non-essential features
3. verify the base still boots

### Phase 4. Extract first reusable modules

Recommended order:

1. `auth-wallet`
2. `profile`
3. `solana-balance`
4. `ai-chat`
5. `todos`
6. `dashboard`

### Phase 5. Upgrade composer

1. teach `template-engine` to read base
2. teach it to merge module file trees
3. teach it to resolve dependencies
4. teach it to report which modules were applied

### Phase 6. Upgrade planner

1. planner returns `selectedModules`
2. planner returns `selectedApps`
3. planner avoids over-selection

### Phase 7. Upgrade artifact UX

1. show base scaffold action
2. show module add actions
3. show AI-created files only when truly new

## Merge Strategy Options

There are two reasonable merge strategies.

### Option A. File tree overlay

Each module contains files to overlay directly on top of the base.

Pros:

- simple
- predictable

Cons:

- conflicts can be harder to manage

### Option B. File tree + declarative patches

Each module contains:

- files
- patch metadata

Pros:

- more explicit merge rules
- cleaner for shared entrypoints

Cons:

- more implementation work

Recommendation:

- start with file tree overlay
- add patch metadata only when entrypoint conflicts become frequent

## Shared Entrypoint Problem

Modules will often want to touch the same files:

- `apps/mobile/app/_layout.tsx`
- `apps/mobile/app/(tabs)/_layout.tsx`
- `apps/api/src/index.ts`
- `packages/api/src/routers/index.ts`

This is the hardest part of module composition.

Recommended strategy:

- keep these files minimal in base
- make them composition-aware
- reserve explicit insertion markers

Example:

```ts
// [seeker:mobile-tab-imports]
// [seeker:mobile-tab-routes]
```

Then the composer can inject module-owned fragments deterministically.

## New Internal Tools To Add

Recommended new files:

- `packages/template-engine/src/load-base-template.ts`
- `packages/template-engine/src/load-modules.ts`
- `packages/template-engine/src/resolve-module-graph.ts`
- `packages/template-engine/src/compose-project.ts`
- `packages/shared/src/module-schema.ts`

Optional helper docs:

- `apps/templates/TEMPLATE_CLASSIFICATION.md`
- `apps/templates/MODULE_GUIDELINES.md`

## Definition Of Done For The Refactor

The refactor is successful when:

1. a prompt can generate a project without copying the full template
2. the planner selects modules explicitly
3. the composer builds from base + modules
4. the workbench no longer reflects a giant starter dump
5. the full template still exists as internal reference

## Final Recommendation

Do not try to extract every module at once.

The safest path is:

1. preserve reference
2. build minimal base
3. extract 3-6 high-value modules
4. upgrade composer
5. only then widen module coverage

That gives the best balance of:

- stability during migration
- product improvement
- implementation speed
