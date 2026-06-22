import { memo } from 'react';
import type { ProjectPlan } from '~/lib/.server/seeker/shared';
import { parsePlanMessage, stripPlanMessage } from '~/lib/seeker-plan';
import { Markdown } from './Markdown';

interface AssistantMessageProps {
  content: string;
  isActivePlanMessage?: boolean;
  onConfirmPlan?: (plan: ProjectPlan) => void;
  onEditPlan?: (plan: ProjectPlan) => void;
  onRegeneratePlan?: (plan: ProjectPlan) => void;
}

export const AssistantMessage = memo(
  ({ content, isActivePlanMessage = false, onConfirmPlan, onEditPlan, onRegeneratePlan }: AssistantMessageProps) => {
    const plan = parsePlanMessage(content);
    const visibleContent = stripPlanMessage(content);

    return (
      <div className="w-full overflow-hidden text-[rgba(232,240,247,0.96)]">
        <Markdown html>{visibleContent}</Markdown>
        {plan && isActivePlanMessage ? (
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => onConfirmPlan?.(plan)}
              className="rounded-full bg-[rgba(207,244,229,0.92)] px-4 py-2 text-sm font-medium text-[#12211b] transition-opacity hover:opacity-90"
            >
              Confirm plan
            </button>
            <button
              type="button"
              onClick={() => onEditPlan?.(plan)}
              className="rounded-full border border-[rgba(255,255,255,0.1)] bg-transparent px-4 py-2 text-sm font-medium text-[rgba(232,240,247,0.96)] transition-colors hover:bg-[rgba(255,255,255,0.05)]"
            >
              Edit plan
            </button>
            <button
              type="button"
              onClick={() => onRegeneratePlan?.(plan)}
              className="rounded-full border border-[rgba(255,255,255,0.1)] bg-transparent px-4 py-2 text-sm font-medium text-[rgba(232,240,247,0.96)] transition-colors hover:bg-[rgba(255,255,255,0.05)]"
            >
              Regenerate
            </button>
          </div>
        ) : null}
      </div>
    );
  },
);
