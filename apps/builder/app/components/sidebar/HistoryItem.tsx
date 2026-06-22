import * as Dialog from '@radix-ui/react-dialog';
import { useEffect, useRef, useState } from 'react';
import { type ChatHistoryItem } from '~/lib/persistence';

interface HistoryItemProps {
  item: ChatHistoryItem;
  onDelete?: (event: React.UIEvent) => void;
}

export function HistoryItem({ item, onDelete }: HistoryItemProps) {
  const [hovering, setHovering] = useState(false);
  const hoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let timeout: NodeJS.Timeout | undefined;

    function mouseEnter() {
      setHovering(true);

      if (timeout) {
        clearTimeout(timeout);
      }
    }

    function mouseLeave() {
      setHovering(false);
    }

    hoverRef.current?.addEventListener('mouseenter', mouseEnter);
    hoverRef.current?.addEventListener('mouseleave', mouseLeave);

    return () => {
      hoverRef.current?.removeEventListener('mouseenter', mouseEnter);
      hoverRef.current?.removeEventListener('mouseleave', mouseLeave);
    };
  }, []);

  return (
    <div
      ref={hoverRef}
      className="group flex items-center justify-between overflow-hidden rounded-xl px-2 py-1 text-[rgba(193,205,217,0.72)] hover:bg-[rgba(255,255,255,0.05)] hover:text-[rgba(232,240,247,0.96)]"
    >
      <a href={`/chat/${item.urlId}`} className="flex w-full relative truncate block">
        {item.description}
        <div className="absolute bottom-0 right-0 top-0 z-1 flex w-10 justify-end bg-gradient-to-l from-[rgba(9,11,15,0.96)] to-transparent group-hover:w-15 group-hover:from-[rgba(18,22,29,0.96)] group-hover:from-45%">
          {hovering && (
            <div className="flex items-center p-1 text-[rgba(193,205,217,0.72)] hover:text-[rgba(255,140,136,0.96)]">
              <Dialog.Trigger asChild>
                <button
                  className="i-ph:trash scale-110"
                  onClick={(event) => {
                    // we prevent the default so we don't trigger the anchor above
                    event.preventDefault();
                    onDelete?.(event);
                  }}
                />
              </Dialog.Trigger>
            </div>
          )}
        </div>
      </a>
    </div>
  );
}
