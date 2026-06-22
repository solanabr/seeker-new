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
  ({
    content,
    isActivePlanMessage = false,
    onConfirmPlan,
    onEditPlan,
    onRegeneratePlan,
  }: AssistantMessageProps) => {
    const plan = parsePlanMessage(content);
    const visibleContent = stripPlanMessage(content);

  return (
    <div className="overflow-hidden w-full">
        <Markdown html>{visibleContent}</Markdown>
        {plan && isActivePlanMessage ? (
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => onConfirmPlan?.(plan)}
              className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-black"
            >
              Confirm plan
            </button>
            <button
              type="button"
              onClick={() => onEditPlan?.(plan)}
              className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-black"
            >
              Edit plan
            </button>
            <button
              type="button"
              onClick={() => onRegeneratePlan?.(plan)}
              className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-black"
            >
              Regenerate
            </button>
          </div>
        ) : null}
    </div>
  );
  },
);
