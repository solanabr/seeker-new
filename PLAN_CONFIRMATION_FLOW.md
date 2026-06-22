# Plan Confirmation Flow

## Goal

Add a confirmation step between the user's first prompt and the actual project generation.

Instead of generating the app immediately, `seeker.new` should:

1. interpret the user's request
2. build a structured app plan
3. show that plan to the user
4. wait for confirmation or edits
5. only then create and customize the project

This keeps the starter reliable while making the generation feel deliberate instead of random.

## Why This Is Better

- Reduces wrong assumptions in the first generation
- Avoids creating too much structure too early
- Makes the AI's intent visible before files are created
- Gives the user a fast correction loop before spending more tokens
- Improves trust because the user sees exactly what will be generated

## Product Principle

The system should always start from a trusted template.

The AI should not invent the project foundation from scratch.

The AI should:

- choose the right template
- extract intent from the prompt
- propose a build plan
- create additional files and edits only after confirmation

## Ideal User Flow

1. User writes the first prompt
2. System generates a structured plan
3. UI shows a plan review card
4. User chooses one of:
   - confirm
   - edit plan
   - regenerate plan
5. After confirmation:
   - template is copied
   - rename/customization is applied
   - additional files are created
   - existing files are edited
6. The workbench opens with the generated app

## UX Proposal

### Entry point

The current chat input remains the same.

Example prompt:

`Create a Solana Mobile app called PayFriend with wallet login and a simple payment home screen.`

### New intermediate state

Before project creation, show a `Plan Review` component in the chat/workbench flow.

Suggested sections:

- App name
- Summary
- Template selected
- Initial screens
- Main entities
- Integrations
- New files to create
- Existing files to edit

### Actions

The plan component should expose three primary actions:

- `Confirm plan`
- `Edit plan`
- `Regenerate`

Optional future action:

- `Change template`

## Plan Object

The current `ProjectPlan` is too small for this flow. It should evolve into a richer schema.

Suggested shape:

```ts
type ProjectPlan = {
  prompt: string;
  template: 'solana-mobile';
  projectName: string;
  projectSlug: string;
  summary: string;
  tagline: string;
  initialScreens: string[];
  entities: string[];
  integrations: string[];
  fileEdits: Array<{
    path: string;
    instruction: string;
  }>;
  newFiles: Array<{
    path: string;
    purpose: string;
    instruction: string;
  }>;
  dependencies: Array<{
    name: string;
    reason: string;
  }>;
};
```

## Generation Policy

### Before confirmation

Allowed:

- prompt interpretation
- template selection
- plan generation
- plan regeneration

Not allowed:

- copying project files
- writing generated app files
- running install commands
- mutating the workbench artifact

### After confirmation

Allowed:

- copy template
- rename project metadata
- create approved files
- edit approved files
- refresh workbench files
- optionally bootstrap preview

## Architecture Proposal

### 1. Planner layer

Add a dedicated planning step before `createProjectFromTemplate`.

This can live in the current `ai-orchestrator`, but it should become a real planner instead of only extracting name and slug.

Responsibilities:

- interpret prompt
- decide if the prompt is app-generation intent
- choose template
- generate structured plan
- keep the plan deterministic and schema-validated

### 2. Confirmation state

The builder needs a temporary state for:

- `draft_plan`
- `confirmed_plan`
- `rejected_plan`

The initial chat flow should stop at `draft_plan`.

Only a confirmed plan can move into project generation.

### 3. Template engine

`template-engine` should remain the source of truth for safe scaffold creation.

Responsibilities:

- copy template into `generated/<slug>`
- apply base rename and config updates
- expose editable files
- create archive/workbench projection

This part should stay deterministic.

### 4. File generation engine

After confirmation, a second stage should apply the plan:

- create `newFiles`
- apply `fileEdits`
- optionally install approved dependencies

This is where the LLM should have controlled freedom.

## Guardrails

The current implementation limits edits to a fixed list of files. That is safe, but too restrictive.

The next version should move from `allowed exact files` to `allowed path zones`.

Suggested split:

```ts
const ALLOWED_EDIT_PATHS = [
  'README.md',
  'apps/mobile/app/**',
  'apps/mobile/features/**',
  'apps/web/src/routes/**',
  'apps/web/src/features/**',
  'apps/api/src/**',
  'packages/api/src/**',
  'packages/db/src/schema/**',
];

const ALLOWED_CREATE_PATHS = [
  'apps/mobile/features/**',
  'apps/mobile/app/**',
  'apps/web/src/routes/**',
  'apps/web/src/features/**',
  'apps/api/src/**',
  'packages/api/src/routers/**',
  'packages/db/src/schema/**',
];
```

Rules:

- no writes outside allowed zones
- no destructive deletes in the initial version
- no arbitrary shell commands
- no arbitrary package installation without whitelist or confirmation

## UI Component Proposal

Suggested component name:

- `GenerationPlanCard`

Possible props:

```ts
type GenerationPlanCardProps = {
  plan: ProjectPlan;
  status: 'draft' | 'confirmed' | 'generating';
  onConfirm: () => void;
  onEdit: () => void;
  onRegenerate: () => void;
};
```

Suggested visual structure:

- header with app name and template
- short summary block
- chips/list for screens and integrations
- compact code-style list for file operations
- footer with primary actions

## Suggested Chat Behavior

When the first prompt arrives:

- do not emit a full `<boltArtifact>` yet
- emit a plan-review UI state first

When the user confirms:

- generate the artifact
- mirror workbench files
- start preview bootstrap if needed

When the user edits the plan:

- send the plan back into the planner as structured input
- regenerate only the plan
- avoid generating files until confirmation

## Example

### User prompt

`Create a Solana Mobile app called PayFriend with wallet login and a simple payment home screen.`

### Plan preview

- App name: `PayFriend`
- Template: `solana-mobile`
- Summary: mobile wallet-connected payment app on Solana
- Initial screens:
  - Home
  - Send Payment
  - Activity
  - Profile
- Integrations:
  - wallet login
  - balance lookup
  - typed API
- New files:
  - `apps/mobile/features/payments/feature/payments-feature-entry.tsx`
  - `apps/mobile/app/(tabs)/payments.tsx`
  - `apps/web/src/routes/payments.tsx`
- Existing files to edit:
  - `apps/mobile/app/index.tsx`
  - `apps/web/src/routes/index.tsx`
  - `apps/api/src/index.ts`

## Recommended Implementation Order

### MVP

1. Add plan generation endpoint/state
2. Add confirmation UI
3. Block project creation until confirmation
4. Keep current fixed editable file list
5. Generate only after confirm

### V2

1. Support `newFiles`
2. Support allowed path zones
3. Add structured dependency requests
4. Add richer feature planning

### V3

1. Support template selection across multiple starters
2. Support architecture-level confirmations for major changes
3. Add a diff preview before applying large edits to existing projects

## Recommendation

This should be implemented before broadening file generation freedom.

Reason:

- confirmation first improves product trust
- confirmation gives the planner a clean contract
- once the plan is user-approved, file creation becomes much safer

## Final Position

`seeker.new` should become:

- template-first
- plan-confirmed
- generation-second

That gives the best balance of:

- reliability
- flexibility
- user control
- believable AI behavior
