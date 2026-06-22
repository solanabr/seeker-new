'use client';

import React from 'react';
import { cva } from 'class-variance-authority';
import { classNames } from '~/utils/classNames';

const orbitalLoaderVariants = cva('flex items-center justify-center gap-2', {
  variants: {
    messagePlacement: {
      bottom: 'flex-col',
      top: 'flex-col-reverse',
      right: 'flex-row',
      left: 'flex-row-reverse',
    },
  },
  defaultVariants: {
    messagePlacement: 'bottom',
  },
});

const cn = classNames;

export interface OrbitalLoaderProps {
  message?: string;
  /**
   * Position of the message relative to the spinner.
   * @default bottom
   */
  messagePlacement?: 'top' | 'bottom' | 'left' | 'right';
}

export function OrbitalLoader({
  className,
  message,
  messagePlacement,
  ...props
}: React.ComponentProps<'div'> & OrbitalLoaderProps) {
  return (
    <div className={cn(orbitalLoaderVariants({ messagePlacement }))}>
      <div className={cn('relative h-16 w-16', className)} {...props}>
        <div className="absolute inset-0 animate-[orbital-spin_1s_linear_infinite] rounded-full border-2 border-transparent border-t-[rgba(207,244,229,0.92)]" />
        <div className="absolute inset-2 animate-[orbital-spin-reverse_1.5s_linear_infinite] rounded-full border-2 border-transparent border-t-[rgba(159,212,239,0.88)]" />
        <div className="absolute inset-4 animate-[orbital-spin_0.8s_linear_infinite] rounded-full border-2 border-transparent border-t-[rgba(232,240,247,0.96)]" />
        <style>
          {`
            @keyframes orbital-spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }

            @keyframes orbital-spin-reverse {
              from { transform: rotate(0deg); }
              to { transform: rotate(-360deg); }
            }
          `}
        </style>
      </div>
      {message && <div className="text-sm text-[rgba(193,205,217,0.82)]">{message}</div>}
    </div>
  );
}
