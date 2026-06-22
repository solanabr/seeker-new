# Plan Confirmation Tech TODO

## Purpose

Translate the product proposal from `PLAN_CONFIRMATION_FLOW.md` into a concrete implementation plan tied to the current `seeker.new` codebase.

This document answers:

- which files need to change
- what each file should own
- what can stay as-is
- what should be built first

## Current Flow Summary

Today the generation path is:

1. user sends first prompt
2. `/api/chat` receives the request
3. `createProjectPlan()` extracts basic metadata
4. `createProjectFromTemplate()` copies the Solana template
5. `generateCustomizedFiles()` rewrites a fixed set of files
6. a `<boltArtifact>` is streamed back immediately

Relevant files:

- [apps/builder/app/routes/api.chat.ts](/Users/joaorubensbelluzzoneto/Documents/seeker-bolt/seeker.new/apps/builder/app/routes/api.chat.ts:1)
- [apps/builder/app/lib/.server/seeker/ai-orchestrator.ts](/Users/joaorubensbelluzzoneto/Documents/seeker-bolt/seeker.new/apps/builder/app/lib/.server/seeker/ai-orchestrator.ts:1)
- [apps/builder/app/lib/.server/seeker/template-engine.ts](/Users/joaorubensbelluzzoneto/Documents/seeker-bolt/seeker.new/apps/builder/app/lib/.server/seeker/template-engine.ts:1)
- [apps/builder/app/lib/.server/seeker/claude-customizer.ts](/Users/joaorubensbelluzzoneto/Documents/seeker-bolt/seeker.new/apps/builder/app/lib/.server/seeker/claude-customizer.ts:1)
- [apps/builder/app/lib/.server/seeker/shared.ts](/Users/joaorubensbelluzzoneto/Documents/seeker-bolt/seeker.new/apps/builder/app/lib/.server/seeker/shared.ts:1)
- [apps/builder/app/components/chat/Chat.client.tsx](/Users/joaorubensbelluzzoneto/Documents/seeker-bolt/seeker.new/apps/builder/app/components/chat/Chat.client.tsx:1)
- [apps/builder/app/components/chat/BaseChat.tsx](/Users/joaorubensbelluzzoneto/Documents/seeker-bolt/seeker.new/apps/builder/app/components/chat/BaseChat.tsx:1)

## Target Flow Summary

The new generation path should be:

1. user sends first prompt
2. planner generates a structured plan
3. UI renders a plan review state
4. user confirms, edits, or regenerates the plan
5. only after confirmation the project is created
6. then template copy + file creation/editing run
7. the workbench artifact is streamed

## Core Design Decision

Keep the template engine deterministic.

Do not move project creation logic into the LLM.

Instead:

- `template-engine` creates the trusted base
- `planner` defines what should happen
- `customizer/generator` applies the confirmed plan

## File-by-File Changes

### 1. `apps/builder/app/lib/.server/seeker/shared.ts`

Current role:

- shared types
- editable file definitions
- workbench visible files

Changes:

- expand `ProjectPlan` into a richer schema
- add explicit plan status types
- separate `edit existing files` from `create new files`
- replace exact-file-only model with future-ready path policy types

Add types like:

```ts
export type PlanStatus = 'draft' | 'confirmed' | 'generating';

export interface PlannedNewFile {
  path: string;
  purpose: string;
  instruction: string;
}

export interface PlannedFileEdit {
  path: string;
  instruction: string;
}

export interface PlannedDependency {
  name: string;
  reason: string;
}
```

Update `ProjectPlan` to include:

- `summary`
- `initialScreens`
- `entities`
- `integrations`
- `newFiles`
- `fileEdits`
- `dependencies`

Keep for now:

- `TEMPLATE_NAME`
- `WORKBENCH_VISIBLE_FILES`

Phase 1 note:

- do not remove `ALLOWED_EDITABLE_FILES` yet
- add new structures without breaking the current generator immediately

### 2. `apps/builder/app/lib/.server/seeker/ai-orchestrator.ts`

Current role:

- basic prompt parsing
- name/slug extraction
- tiny `ProjectPlan`

Changes:

- promote this module into the actual planner
- return a reviewable plan instead of only rename metadata
- support two modes:
  - initial app generation planning
  - plan revision based on user feedback

New responsibilities:

- infer app summary
- infer screens
- infer entities
- infer integrations
- infer likely file changes
- validate against schema

Implementation approach:

- MVP: keep it deterministic and heuristic-first
- later: allow LLM-assisted planning with schema validation

Recommended functions:

```ts
export function createDraftProjectPlan(prompt: string, seed?: ExistingProjectSeed): ProjectPlan
export function reviseDraftProjectPlan(input: {
  currentPlan: ProjectPlan;
  userFeedback: string;
}): ProjectPlan
```

Phase 1 constraint:

- do not generate code here
- only produce a structured plan

### 3. `apps/builder/app/routes/api.chat.ts`

Current role:

- single endpoint for first generation and later edits
- immediately creates project on first prompt

This is the main orchestration file and needs the biggest change.

Changes:

- split first-run planning from confirmed generation
- detect whether the latest user message means:
  - create draft plan
  - confirm current plan
  - revise current plan
  - continue editing existing project

New responsibilities:

- return a plan-review response before artifact generation
- only call `createProjectFromTemplate()` after explicit confirmation
- preserve current “edit existing project” behavior for later turns

Recommended refactor:

```ts
async function handleDraftPlan(...)
async function handlePlanConfirmation(...)
async function handlePlanRevision(...)
async function handleExistingProjectEdit(...)
```

Need a new internal state strategy:

- detect latest draft plan from conversation
- detect explicit confirmation messages
- keep project generation blocked until confirmation

Recommended first implementation:

- serialize the plan into a structured assistant payload embedded in message content
- render a readable artifact-like plan block in chat
- interpret simple user confirmations such as:
  - `confirm`
  - `confirm plan`
  - `looks good`
  - `go ahead`

Later improvement:

- use dedicated client-side actions instead of natural-language confirmation

### 4. `apps/builder/app/components/chat/Chat.client.tsx`

Current role:

- chat state
- send messages
- parse streamed assistant output

Changes:

- support a pre-generation review state
- distinguish between:
  - ordinary assistant response
  - plan review content
  - real workbench artifact

Likely tasks:

- add plan-specific client state
- intercept “confirm plan” UI action
- send a structured confirmation message to `/api/chat`

Recommended approach:

- keep `useChat()` as the transport
- add a lightweight protocol in assistant messages for plan blocks

Example:

- assistant emits a machine-readable wrapper like `<seekerPlan>...</seekerPlan>`
- client parses it and renders a plan card

### 5. `apps/builder/app/components/chat/BaseChat.tsx`

Current role:

- base layout
- input box
- examples
- message/workbench layout

Changes:

- host a new `GenerationPlanCard`
- show plan actions inline with messages or between chat and workbench

Recommended UI behavior:

- when a draft plan is active, show the plan card above the composer
- disable actual generation until the user confirms
- keep the normal workbench hidden or empty before generation

Phase 1:

- use a simple review card
- no need for complex diff visuals yet

### 6. New component: `apps/builder/app/components/chat/GenerationPlanCard.tsx`

This file does not exist yet.

Create it.

Responsibilities:

- display the current draft plan
- show summary, template, screens, integrations
- show file edit and file creation lists
- expose actions:
  - confirm
  - edit
  - regenerate

Suggested props:

```ts
type GenerationPlanCardProps = {
  plan: ProjectPlan;
  status: 'draft' | 'confirmed' | 'generating';
  onConfirm: () => void;
  onEdit: () => void;
  onRegenerate: () => void;
};
```

Phase 1 UX:

- `Edit plan` can simply focus the textarea with a hint
- `Regenerate` can resend the original prompt with a regeneration intent

### 7. `apps/builder/app/lib/.server/seeker/template-engine.ts`

Current role:

- copy template
- rename app metadata
- read/write editable files
- refresh archive/workbench files

This should remain stable.

Changes:

- keep template copy deterministic
- add support for writing newly created files after confirmation
- add helper methods for path-safe file creation

Recommended additions:

```ts
export async function writeGeneratedFiles(projectDir: string, files: Array<{ path: string; content: string }>)
export function assertAllowedCreatePath(path: string): void
export function assertAllowedEditPath(path: string): void
```

Important:

- do not mix planning logic into this module
- do not let this module decide what files should exist

### 8. `apps/builder/app/lib/.server/seeker/claude-customizer.ts`

Current role:

- rewrites a fixed list of editable files with Anthropic

Changes:

- keep the current file-edit support
- later extend it to generate new files from `plan.newFiles`

Recommended evolution:

- `generateCustomizedFiles()` remains for existing-file rewrites
- add a new function for planned file creation

Suggested shape:

```ts
export async function generatePlannedNewFiles(...)
export async function generatePlannedFileEdits(...)
```

Important guardrail:

- file generation should be based on:
  - path
  - purpose
  - instruction
  - nearby project context

Phase 1:

- keep only existing-file edits after confirmation
- new file generation can land in phase 2

### 9. New parser/helper module

Recommended new file:

- `apps/builder/app/lib/.server/seeker/plan-message.ts`

Purpose:

- serialize a `ProjectPlan` into a chat-safe assistant payload
- parse a plan payload back from the conversation
- detect if the user confirmed or revised the plan

Suggested responsibilities:

```ts
export function serializePlanMessage(plan: ProjectPlan): string
export function parsePlanMessage(content: string): ProjectPlan | null
export function isPlanConfirmation(content: string): boolean
export function isPlanRegenerationRequest(content: string): boolean
```

This avoids overloading `api.chat.ts` with brittle regexes.

### 10. New client parser support

There is already assistant message parsing in the chat flow.

Recommended additions:

- extend the client-side message parser to detect plan payloads
- render them as UI instead of raw text

Likely impacted area:

- existing message parsing hook in `~/lib/hooks`

This should be inspected during implementation because the current message-to-HTML flow was not modified yet in this plan.

## Suggested Delivery Plan

### Phase 1: Safe MVP

Goal:

- add plan confirmation before first generation
- keep file generation mostly as it is

Tasks:

1. expand shared `ProjectPlan` schema
2. update `ai-orchestrator` to generate richer draft plans
3. add plan serialization/parsing helpers
4. update `/api/chat` to stop at draft plan
5. add `GenerationPlanCard`
6. confirm plan before calling `createProjectFromTemplate`

What stays intentionally limited:

- fixed editable file list
- no arbitrary new files yet
- no dependency installation yet

### Phase 2: New File Creation

Goal:

- allow the confirmed plan to create additional files in safe zones

Tasks:

1. add `newFiles` generation in planner
2. add allowed path policy
3. generate and write planned files
4. refresh workbench with those files

### Phase 3: Richer Iteration

Goal:

- support explicit plan revision loops and bigger structured edits

Tasks:

1. plan diff/review UI
2. stronger confirmation detection
3. dependency request handling
4. larger architecture changes behind confirmation

## Risks

### Risk 1: Message protocol gets brittle

If plan data is embedded ad hoc in plain assistant text, parsing will get fragile.

Mitigation:

- define one explicit plan wrapper format
- keep serialization and parsing in one shared helper

### Risk 2: Two states of truth for the plan

If the server derives the plan from one message format and the client renders another, they will drift.

Mitigation:

- server owns the canonical plan object
- client renders from that serialized canonical payload

### Risk 3: Premature support for arbitrary files

If new file generation is enabled too early, quality will drop fast.

Mitigation:

- ship confirmation first
- ship `newFiles` second
- keep path guardrails strict

## Recommended First PR

The first PR should do only this:

- add richer `ProjectPlan`
- add plan review UI
- stop generation until confirmation
- preserve current template copy and editable-file rewrite path after confirm

That is the smallest change that materially improves the product.

## Final Recommendation

Build this in two layers:

1. `plan before generate`
2. `create more files after confirm`

That ordering is important.

If you try to unlock broader file generation before the confirmation layer exists, the system will feel less reliable, not more.
