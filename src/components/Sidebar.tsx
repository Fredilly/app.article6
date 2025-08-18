'use client';

import * as Collapsible from '@radix-ui/react-collapsible';
import clsx from 'clsx';

interface SidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function Sidebar({ open, onOpenChange }: SidebarProps) {
  return (
    <Collapsible.Root
      open={open}
      onOpenChange={onOpenChange}
      className={clsx(
        'h-full transition-[width] duration-200 motion-reduce:transition-none',
        open ? 'w-64' : 'w-0 overflow-hidden'
      )}
    >
      <Collapsible.Content className="flex h-full flex-col bg-panelElev border-r border-border">
        <div className="border-b border-border p-4 text-sm uppercase tracking-wider text-subtext/70">Projects</div>
        <div className="flex-1 p-4 text-sm text-subtext">No projects yet</div>
        <div className="border-t border-border p-4">
          <button
            type="button"
            className="h-9 w-full rounded-xl bg-accent text-black font-medium hover:brightness-110 shadow-soft transition-colors duration-200 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            New Project
          </button>
        </div>
      </Collapsible.Content>
    </Collapsible.Root>
  );
}
