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
    <div className="mx-auto mb-4 w-full max-w-chat rounded-[1.75rem] border border-[rgba(159,212,239,0.16)] bg-[rgba(15,18,24,0.84)] p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_0_28px_rgba(159,212,239,0.08)] backdrop-blur-md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-[rgba(193,205,217,0.62)]">Plan Review</p>
          <h2 className="mt-2 text-xl font-semibold text-[rgba(232,240,247,0.96)]">{plan.projectName}</h2>
          <p className="mt-2 text-sm text-[rgba(193,205,217,0.78)]">{plan.summary}</p>
        </div>
        <div className="rounded-full border border-[rgba(255,255,255,0.1)] bg-[rgba(8,11,16,0.7)] px-3 py-1 text-xs text-[rgba(193,205,217,0.72)]">
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
          className="rounded-full bg-[rgba(207,244,229,0.92)] px-4 py-2 text-sm font-medium text-[#12211b] transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          Confirm plan
        </button>
        <button
          type="button"
          disabled={isStreaming}
          onClick={onEdit}
          className="rounded-full border border-[rgba(255,255,255,0.1)] bg-transparent px-4 py-2 text-sm text-[rgba(232,240,247,0.96)] transition-colors hover:bg-[rgba(255,255,255,0.05)] disabled:opacity-60"
        >
          Edit plan
        </button>
        <button
          type="button"
          disabled={isStreaming}
          onClick={onRegenerate}
          className="rounded-full border border-[rgba(255,255,255,0.1)] bg-transparent px-4 py-2 text-sm text-[rgba(232,240,247,0.96)] transition-colors hover:bg-[rgba(255,255,255,0.05)] disabled:opacity-60"
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
    <div className="mt-4 rounded-2xl border border-[rgba(255,255,255,0.1)] bg-[rgba(8,11,16,0.72)] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-[rgba(207,244,229,0.12)] px-2.5 py-0.5 text-xs font-medium text-[rgba(207,244,229,0.92)]">
          On-chain
        </span>
        <p className="text-sm font-medium text-[rgba(232,240,247,0.96)]">Deploys a {label} program to Solana devnet</p>
      </div>
      <p className="mt-2 text-sm text-[rgba(193,205,217,0.78)]">{spec.rationale}</p>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        <Section title="On-chain state" items={[spec.state.name]} code />
        <Section title="Program actions" items={spec.instructions} code />
      </div>
    </div>
  );
}

function Section({ title, items, code = false }: { title: string; items: string[]; code?: boolean }) {
  return (
    <div>
      <p className="text-sm font-medium text-[rgba(232,240,247,0.96)]">{title}</p>
      <ul className="mt-2 space-y-2 text-sm text-[rgba(193,205,217,0.78)]">
        {items.map((item) => (
          <li
            key={item}
            className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] px-3 py-2"
          >
            {code ? <code>{item}</code> : item}
          </li>
        ))}
      </ul>
    </div>
  );
}
