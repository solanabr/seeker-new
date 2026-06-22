# seeker.new

App builder focused only on Solana Mobile apps.

## Structure

- `apps/builder`: customized Bolt-based builder UI
- `apps/templates/solana-mobile`: source template for generated apps
- `packages/template-engine`: copies and renames template apps
- `packages/ai-orchestrator`: converts prompts into a constrained app plan
- `packages/shared`: shared types and allowed editable file definitions
- `generated/<app-id>`: output apps created from prompts

## Local development

Install the builder dependencies from the copied Bolt app:

```bash
cd apps/builder
pnpm install
pnpm dev
```

Open the builder and try a prompt like:

```text
Create a Solana Mobile app called PayFriend with wallet login and a simple payment home screen.
```

The builder creates a real app under `generated/payfriend` and mirrors the main editable files into the Bolt workbench.
