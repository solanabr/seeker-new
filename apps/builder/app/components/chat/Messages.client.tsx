import type { Message } from 'ai';
import React from 'react';
import type { ProjectPlan } from '~/lib/.server/seeker/shared';
import { classNames } from '~/utils/classNames';
import { AssistantMessage } from './AssistantMessage';
import { UserMessage } from './UserMessage';

interface MessagesProps {
  id?: string;
  className?: string;
  isStreaming?: boolean;
  messages?: Message[];
  activePlanMessageIndex?: number;
  onConfirmPlan?: (plan: ProjectPlan) => void;
  onEditPlan?: (plan: ProjectPlan) => void;
  onRegeneratePlan?: (plan: ProjectPlan) => void;
}

export const Messages = React.forwardRef<HTMLDivElement, MessagesProps>((props: MessagesProps, ref) => {
  const {
    id,
    isStreaming = false,
    messages = [],
    activePlanMessageIndex = -1,
    onConfirmPlan,
    onEditPlan,
    onRegeneratePlan,
  } = props;

  return (
    <div id={id} ref={ref} className={props.className}>
      {messages.length > 0
        ? messages.map((message, index) => {
            const { role, content } = message;
            const isUserMessage = role === 'user';
            const isFirst = index === 0;
            const isLast = index === messages.length - 1;

            return (
              <div
                key={index}
                className={classNames('flex w-full gap-4 rounded-[1.5rem] border p-6 backdrop-blur-md', {
                  'border-[rgba(159,212,239,0.14)] bg-[rgba(9,14,20,0.78)] shadow-[0_0_0_1px_rgba(255,255,255,0.03)]':
                    isUserMessage || !isStreaming || (isStreaming && !isLast),
                  'border-[rgba(159,212,239,0.14)] bg-gradient-to-b from-[rgba(9,14,20,0.82)] from-30% to-transparent':
                    isStreaming && isLast,
                  'mt-4': !isFirst,
                })}
              >
                {isUserMessage && (
                  <div className="flex h-[34px] w-[34px] shrink-0 self-start items-center justify-center overflow-hidden rounded-full border border-[rgba(159,212,239,0.22)] bg-[rgba(159,212,239,0.12)] text-[rgba(232,240,247,0.96)]">
                    <div className="i-ph:user-fill text-xl"></div>
                  </div>
                )}
                <div className="grid grid-col-1 w-full">
                  {isUserMessage ? (
                    <UserMessage content={content} />
                  ) : (
                    <AssistantMessage
                      content={content}
                      isActivePlanMessage={index === activePlanMessageIndex}
                      onConfirmPlan={onConfirmPlan}
                      onEditPlan={onEditPlan}
                      onRegeneratePlan={onRegeneratePlan}
                    />
                  )}
                </div>
              </div>
            );
          })
        : null}
      {isStreaming && (
        <div className="mt-4 w-full text-center text-4xl text-[rgba(193,205,217,0.72)] i-svg-spinners:3-dots-fade"></div>
      )}
    </div>
  );
});
