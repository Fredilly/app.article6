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
        'h-full transition-all',
        open ? 'w-64' : 'w-0 overflow-hidden'
      )}
    >
      <Collapsible.Content className="flex h-full flex-col border-r bg-background">
        <div className="border-b p-4 font-semibold">Projects</div>
        <div className="flex-1 p-4 text-sm text-muted-foreground">
          No projects yet
        </div>
        <div className="border-t p-4">
          <button
            type="button"
            className="w-full rounded bg-primary px-3 py-2 text-sm text-primary-foreground"
          >
            New Project
          </button>
        </div>
      </Collapsible.Content>
    </Collapsible.Root>
  );
}
