/**
 * Collapsible - Radix Collapsible wrapper with default styling
 */

'use client';

import * as CollapsiblePrimitive from '@radix-ui/react-collapsible';
import { ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';

// Re-export primitives
export const Collapsible = CollapsiblePrimitive.Root;
export const CollapsibleContent = CollapsiblePrimitive.Content;

interface CollapsibleTriggerProps
  extends ComponentPropsWithoutRef<typeof CollapsiblePrimitive.Trigger> {
  children: ReactNode;
  isOpen?: boolean;
}

export function CollapsibleTrigger({
  children,
  isOpen,
  className,
  ...props
}: CollapsibleTriggerProps) {
  return (
    <CollapsiblePrimitive.Trigger
      className={clsx(
        'flex items-center gap-2 w-full py-2 px-3 rounded-md',
        'hover:bg-muted/50 transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        className
      )}
      {...props}
    >
      <ChevronRight
        className={clsx(
          'h-4 w-4 text-muted-foreground transition-transform duration-200',
          isOpen && 'rotate-90'
        )}
      />
      {children}
    </CollapsiblePrimitive.Trigger>
  );
}
