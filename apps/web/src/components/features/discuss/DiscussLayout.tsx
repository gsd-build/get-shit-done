/**
 * DiscussLayout - Resizable split panel layout for chat and preview
 */

'use client';

import { useState, useCallback, type ReactNode } from 'react';
import { Panel, Group, Separator } from 'react-resizable-panels';
import { GripVertical, FileText, X } from 'lucide-react';
import clsx from 'clsx';
import { ContextPreview } from './ContextPreview';

interface DiscussLayoutProps {
  children: ReactNode;
}

export function DiscussLayout({ children }: DiscussLayoutProps) {
  // Mobile drawer state
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  const toggleDrawer = useCallback(() => {
    setIsMobileDrawerOpen(prev => !prev);
  }, []);

  const closeDrawer = useCallback(() => {
    setIsMobileDrawerOpen(false);
  }, []);

  return (
    <>
      {/* Desktop: Resizable panels */}
      <div className="hidden md:flex h-full">
        <Group orientation="horizontal" className="h-full">
          {/* Left Panel: Chat interface */}
          <Panel id="chat" defaultSize={60} minSize={40} className="flex flex-col">
            {children}
          </Panel>

          {/* Resize Handle */}
          <Separator className="group relative w-1 bg-border hover:bg-primary/50 transition-colors">
            <div className="absolute inset-y-0 -left-1 -right-1 flex items-center justify-center">
              <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                <GripVertical className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </Separator>

          {/* Right Panel: Context Preview */}
          <Panel id="preview" defaultSize={40} minSize={25} className="flex flex-col border-l border-border">
            <ContextPreview />
          </Panel>
        </Group>
      </div>

      {/* Mobile: Chat with drawer toggle */}
      <div className="md:hidden h-full flex flex-col">
        {/* Chat interface */}
        <div className="flex-1 flex flex-col overflow-hidden">{children}</div>

        {/* Mobile toggle button */}
        <button
          type="button"
          onClick={toggleDrawer}
          className={clsx(
            'fixed bottom-20 right-4 z-40',
            'flex items-center gap-2 px-4 py-2 rounded-full',
            'bg-primary text-primary-foreground shadow-lg',
            'hover:bg-primary/90 transition-colors',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary'
          )}
          aria-label="Open CONTEXT.md preview"
        >
          <FileText className="h-4 w-4" />
          <span className="text-sm font-medium">Preview</span>
        </button>

        {/* Mobile drawer overlay */}
        {isMobileDrawerOpen && (
          <div
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={closeDrawer}
            aria-hidden="true"
          />
        )}

        {/* Mobile drawer */}
        <div
          className={clsx(
            'fixed inset-y-0 right-0 z-50 w-full max-w-md',
            'bg-card shadow-xl transform transition-transform duration-300 ease-out',
            isMobileDrawerOpen ? 'translate-x-0' : 'translate-x-full'
          )}
          role="dialog"
          aria-modal="true"
          aria-label="CONTEXT.md Preview"
        >
          {/* Drawer header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-medium text-sm">CONTEXT.md Preview</h2>
            </div>
            <button
              type="button"
              onClick={closeDrawer}
              className={clsx(
                'p-1 rounded-md',
                'hover:bg-muted transition-colors',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary'
              )}
              aria-label="Close preview"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Drawer content */}
          <div className="h-[calc(100%-57px)] overflow-y-auto">
            <ContextPreview />
          </div>
        </div>
      </div>
    </>
  );
}

export default DiscussLayout;
