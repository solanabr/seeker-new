import type { ProgramSpec, ProjectPlan } from '~/lib/.server/seeker/shared';

/** Friendly, user-facing label for each curated on-chain program archetype. */
const ARCHETYPE_LABEL: Record<string, string> = {
  counter: 'on-chain counter',
  'spl-token-mint': 'token mint',
  escrow: 'escrow',
  vote: 'voting',
};

interface GenerationPlanCardProps {
  plan: ProjectPlan;
  isStreaming?: boolean;
  onConfirm: () => void;
  onEdit: () => void;
  onRegenerate: () => void;
}

export function GenerationPlanCard({
  plan,
  isStreaming = false,
  onConfirm,
  onEdit,
  onRegenerate,
}: GenerationPlanCardProps) {
  return (
    <div className="w-full max-w-chat mx-auto mb-4 rounded-2xl border border-bolt-elements-borderColor bg-bolt-elements-prompt-background p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-bolt-elements-textTertiary">
            Plan Review
          </p>
          <h2 className="mt-2 text-xl font-semibold text-bolt-elements-textPrimary">
            {plan.projectName}
          </h2>
          <p className="mt-2 text-sm text-bolt-elements-textSecondary">{plan.summary}</p>
        </div>
        <div className="rounded-full border border-bolt-elements-borderColor px-3 py-1 text-xs text-bolt-elements-textTertiary">
          {plan.template}
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Section title="Initial screens" items={plan.initialScreens} />
        <Section title="Integrations" items={plan.integrations} />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Section title="Files to edit" items={plan.filesToEdit.map((file) => file.path)} code />
        <Section
          title="New files planned"
          items={plan.newFiles.length > 0 ? plan.newFiles.map((file) => file.path) : ['None in MVP draft']}
          code
        />
      </div>

      {plan.programSpec?.needsProgram ? <ProgramSpecPanel spec={plan.programSpec} /> : null}

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={isStreaming}
          onClick={onConfirm}
          className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-60"
        >
          Confirm plan
        </button>
        <button
          type="button"
          disabled={isStreaming}
          onClick={onEdit}
          className="rounded-xl border border-bolt-elements-borderColor px-4 py-2 text-sm text-bolt-elements-textPrimary disabled:opacity-60"
        >
          Edit plan
        </button>
        <button
          type="button"
          disabled={isStreaming}
          onClick={onRegenerate}
          className="rounded-xl border border-bolt-elements-borderColor px-4 py-2 text-sm text-bolt-elements-textPrimary disabled:opacity-60"
        >
          Regenerate
        </button>
      </div>
    </div>
  );
}

function ProgramSpecPanel({ spec }: { spec: ProgramSpec }) {
  const label = ARCHETYPE_LABEL[spec.archetype] ?? `${spec.archetype} program`;

  return (
    <div className="mt-4 rounded-xl border border-bolt-elements-borderColor bg-black/10 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-green-500/15 px-2.5 py-0.5 text-xs font-medium text-green-400">
          On-chain
        </span>
        <p className="text-sm font-medium text-bolt-elements-textPrimary">
          Deploys a {label} program to Solana devnet
        </p>
      </div>
      <p className="mt-2 text-sm text-bolt-elements-textSecondary">{spec.rationale}</p>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        <Section title="On-chain state" items={[spec.state.name]} code />
        <Section title="Program actions" items={spec.instructions} code />
      </div>
    </div>
  );
}

function Section({
  title,
  items,
  code = false,
}: {
  title: string;
  items: string[];
  code?: boolean;
}) {
  return (
    <div>
      <p className="text-sm font-medium text-bolt-elements-textPrimary">{title}</p>
      <ul className="mt-2 space-y-2 text-sm text-bolt-elements-textSecondary">
        {items.map((item) => (
          <li key={item} className="rounded-lg bg-black/10 px-3 py-2">
            {code ? <code>{item}</code> : item}
          </li>
        ))}
      </ul>
    </div>
  );
}
