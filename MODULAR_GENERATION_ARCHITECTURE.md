# Modular Generation Architecture

## Goal

Refactor `seeker.new` from:

- full-template copy
- broad starter scaffold
- post-generation customization

into:

- minimal base scaffold
- module-driven composition
- full template kept as internal reference
- AI planner choosing only what the user request actually needs

This is the next architectural step after plan confirmation.

## Core Position

The generator should **not** create projects by copying the entire starter every time.

It should:

1. start from a small, production-safe base
2. add only the modules required by the prompt
3. use the full starter as an implementation reference when helpful
4. let the AI create missing project-specific files only when needed

## Why This Is Better

### 1. Better product fit

Users want:

- an app that matches the prompt
- not a giant starter with unrelated features

If the user asks for:

- mobile wallet login
- airdrop tracking

they should not get:

- todos
- AI chat
- generic examples
- unused web routes
- unrelated feature folders

### 2. Better AI behavior

The AI performs better when it composes from known building blocks than when it:

- invents the full app from scratch
- or inherits too much irrelevant structure

### 3. Cleaner codebase output

Projects become:

- smaller
- easier to understand
- easier to extend
- less noisy in the workbench

### 4. Better long-term maintainability

Modules can evolve independently.

A monolithic template becomes harder and harder to reason about as more features are added.

## Recommended System

The generator should use three template layers:

- `base`
- `modules`
- `reference`

### Base

The smallest valid scaffold that should exist in almost every generated app.

### Modules

Composable feature units that the planner can include or exclude.

### Reference

A richer internal implementation library used by AI for adaptation and inspiration, not copied by default.

## Folder Strategy

Suggested structure:

```text
apps/
  templates/
    base/
      solana-mobile-base/
    modules/
      auth-wallet/
      profile/
      solana-balance/
      ai-chat/
      payments/
      airdrops/
      dashboard/
      todos/
    reference/
      solana-mobile-full/
```

Alternative naming if you want one root:

```text
apps/templates/
  base/solana-mobile
  modules/auth-wallet
  modules/profile
  modules/solana-balance
  modules/ai-chat
  modules/payments
  modules/airdrops
  modules/dashboard
  modules/todos
  reference/solana-mobile-full
```

## What Belongs In Base

The base should be as small as possible while still producing a real app.

Suggested contents:

- monorepo root structure
- package manager and workspace config
- minimal mobile app shell
- minimal API shell
- optional minimal web shell
- env setup
- core providers
- auth and wallet hooks only if those are considered default capabilities
- required runtime wiring only

Base should **not** contain:

- todos
- AI chat
- sample dashboards
- generic example routes
- sample feature showcases
- unrelated screens

## What Belongs In Modules

A module should represent a meaningful capability, not a tiny UI atom.

Good module size:

- one coherent user-facing feature
- one coherent technical capability

Examples of good modules:

- `auth-wallet`
- `auth-email`
- `solana-balance`
- `profile`
- `payments-send`
- `airdrops`
- `ai-chat`
- `dashboard`
- `activity-feed`

Examples of bad modules:

- `primary-button`
- `header-row`
- `loading-spinner`
- `wallet-address-label`

Those belong in shared code, not generation modules.

## What Belongs In Reference

The reference template is an internal knowledge source.

It should contain:

- full current starter
- polished implementations
- example flows
- richer feature patterns

The generator can use it to:

- find a known implementation pattern
- adapt an existing screen
- reuse folder structure ideas
- learn where files should live

The reference should **not** be copied wholesale by default.

## Generation Flow

### Step 1. User prompt

User writes:

`Create a Solana Mobile app for tracking airdrops with wallet login and a simple profile screen.`

### Step 2. AI planning

Planner returns:

- project name
- summary
- selected apps
- selected modules
- optional new files
- optional edits

### Step 3. User confirms plan

The plan review step remains mandatory for first-generation structure.

### Step 4. Composer builds scaffold

Composer creates:

- base scaffold
- selected modules merged in
- project identity updates

### Step 5. AI customizer fills gaps

Only after composition:

- create prompt-specific files
- customize selected module files
- adapt text and UX

### Step 6. Workbench output

Workbench should show:

- `Create starter from template`
- `Add module: auth-wallet`
- `Add module: airdrops`
- `Add module: profile`
- `Create apps/mobile/features/airdrops/...`
- `Update apps/mobile/app/index.tsx`
- `Install dependencies`
- `Start preview`

This preserves clarity between:

- scaffold infrastructure
- module composition
- AI-authored additions

## Plan Schema

The plan should evolve to explicitly include module composition.

Suggested shape:

```ts
type ProjectPlan = {
  prompt: string;
  template: 'solana-mobile';
  projectName: string;
  projectSlug: string;
  summary: string;
  appDescription: string;
  appTagline: string;
  selectedApps: Array<'mobile' | 'web' | 'api'>;
  selectedModules: string[];
  excludedModules: string[];
  initialScreens: string[];
  entities: string[];
  integrations: string[];
  newFiles: Array<{
    path: string;
    purpose: string;
    instruction: string;
  }>;
  fileEdits: Array<{
    path: string;
    instruction: string;
  }>;
  dependencies: Array<{
    name: string;
    reason: string;
  }>;
};
```

## Module Metadata

Each module should declare what it contains and what it depends on.

Suggested `module.json`:

```json
{
  "name": "airdrops",
  "description": "Mobile-first airdrop discovery and claim tracking flow",
  "apps": ["mobile", "api"],
  "dependsOn": ["auth-wallet", "profile"],
  "optionalDependsOn": ["solana-balance"],
  "files": [
    "apps/mobile/features/airdrops/**",
    "apps/api/src/routes/airdrops/**"
  ],
  "tags": ["solana", "airdrops", "wallet"]
}
```

This helps the planner and composer stay deterministic.

## Composer Responsibilities

The composer should be a deterministic engine.

It should:

- scaffold base
- merge selected modules
- resolve module dependencies
- avoid duplicate files
- apply rename/project identity updates
- expose the final file map to the customizer

It should not:

- infer product intent
- invent missing features
- free-form generate code

That belongs to the planner/customizer.

## Customizer Responsibilities

The customizer is the controlled AI layer after composition.

It should:

- adapt text and branding
- create prompt-specific files not covered by modules
- modify selected files to reflect the requested app concept

It should not:

- replace the composer
- ignore selected module boundaries
- freely mutate unrelated parts of the project

## Module Selection Rules

The planner should bias toward the smallest useful set.

Rules:

- only include modules justified by the prompt
- avoid “nice to have” feature inflation
- include dependencies automatically
- prefer omission over over-generation

If the user asks for:

`wallet login + portfolio overview`

the system should likely include:

- `auth-wallet`
- `profile`
- `solana-balance`

and exclude:

- `todos`
- `ai-chat`
- `payments`

## Reference Usage Rules

The reference template can be consulted when:

- a selected module needs an example implementation pattern
- the AI must create a nearby feature similar to an existing one
- the generator needs a known route/component arrangement

The reference template should not:

- be mounted directly into output
- define default output scope

## Migration Plan

### Phase 1. Classify current starter

Take the current full template and label all parts as:

- base
- module candidate
- reference only

### Phase 2. Extract base

Create `solana-mobile-base` with only the minimum valid scaffold.

### Phase 3. Extract modules

Move current features into reusable modules:

- auth
- profile
- solana-balance
- ai-chat
- todos
- dashboard

### Phase 4. Keep full template as reference

Preserve the current starter under `reference/solana-mobile-full`.

### Phase 5. Update planner

Planner outputs:

- `selectedApps`
- `selectedModules`
- `excludedModules`

### Phase 6. Build composer

Composer merges:

- base
- selected modules
- prompt-specific project identity

### Phase 7. Update workbench semantics

Artifact should show:

- scaffold
- module adds
- custom files
- updates

not giant template dumps.

## Implementation Ownership

Recommended ownership split:

- `ai-orchestrator`
  - plan generation
  - module selection
- `template-engine`
  - base scaffold creation
  - module merge logic
  - conflict resolution
- `claude-customizer`
  - file-level prompt-specific adaptation
- `shared`
  - plan schema
  - module metadata schema

## Risks

### Risk 1. Modules become too granular

This makes composition fragile and hard to reason about.

Mitigation:

- keep modules feature-sized

### Risk 2. Base becomes too large

This recreates the current monolithic template problem.

Mitigation:

- aggressively prune non-essential features from base

### Risk 3. Module merge conflicts

Overlapping files between modules can become messy.

Mitigation:

- give modules explicit ownership zones
- prefer append/slot-based patterns where possible

### Risk 4. AI over-selects modules

The planner may still include too much.

Mitigation:

- add strict planner instructions
- require justification for each selected module

## Recommended Output Semantics

For the initial build, the user should perceive:

- a tailored app
- selected capabilities
- intentional additions

not:

- a generic starter with everything switched on

That means:

- hide full-template bulk copy
- show selected module composition
- show AI-created new files
- show meaningful edits

## Final Recommendation

The best architecture for `seeker.new` is:

- **base scaffold**
- **module composition**
- **reference template**
- **AI planning before generation**
- **AI customization after composition**

This is better than:

- copying the full starter every time
- generating everything from scratch
- or cloning a monolith and deleting half of it later

It gives the strongest balance of:

- reliability
- flexibility
- output quality
- user trust
- maintainability
