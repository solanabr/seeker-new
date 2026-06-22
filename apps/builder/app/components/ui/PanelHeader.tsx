import { memo } from 'react';
import { classNames } from '~/utils/classNames';

interface PanelHeaderProps {
  className?: string;
  children: React.ReactNode;
}

export const PanelHeader = memo(({ className, children }: PanelHeaderProps) => {
  return (
    <div
      className={classNames(
        'flex min-h-[40px] items-center gap-2 border-b border-[rgba(255,255,255,0.08)] bg-[rgba(12,16,22,0.86)] px-4 py-1 text-sm text-[rgba(193,205,217,0.78)]',
        className,
      )}
    >
      {children}
    </div>
  );
});
