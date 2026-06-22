# Plan Confirmation MVP Checklist

## Goal

Ship the smallest useful version of the plan confirmation flow:

- first prompt creates a draft plan
- no project is generated yet
- user confirms the plan
- only then the app is scaffolded and customized

## Scope

Included in MVP:

- richer `ProjectPlan`
- plan serialization in assistant messages
- server-side generation blocking until confirmation
- simple client-side plan review card
- confirm/edit/regenerate actions

Not included in MVP:

- arbitrary new file generation
- dependency installation
- path-zone write policies
- multi-template selection
- plan diff UI

## Checklist

### Planning schema

- [x] Expand `ProjectPlan` beyond name/slug
- [x] Add summary, screens, integrations, entities
- [x] Keep compatibility with current template/customizer flow

### Server flow

- [x] Add helper to serialize and parse plan messages
- [x] Return a draft plan for the first prompt
- [x] Prevent project creation before explicit confirmation
- [x] Support lightweight plan revision loop from follow-up prompt
- [x] Keep existing project edit flow intact after generation

### Client flow

- [x] Detect plan payloads in assistant messages
- [x] Strip hidden plan payload from visible assistant markdown
- [x] Render a visible plan review card
- [x] Add `Confirm plan` action
- [x] Add `Edit plan` action
- [x] Add `Regenerate` action

### Workbench behavior

- [x] Avoid streaming a Bolt artifact during draft-plan stage
- [x] Preserve normal artifact/workbench behavior after confirmation

### Next validation pass

- [ ] Run builder typecheck
- [ ] Verify first prompt returns plan instead of project
- [ ] Verify confirm action generates project
- [ ] Verify follow-up revision updates plan instead of generating immediately
- [ ] Verify existing generated project still accepts normal edit prompts

## Suggested Next Steps After MVP

1. Add `newFiles` support in the confirmed plan
2. Add allowed create/edit path zones
3. Generate new components/routes/features from plan
4. Add richer plan revision UX
