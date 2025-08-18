'use client';

import { useEffect, useState } from 'react';
import { PanelLeft } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { ChatPane } from './ChatPane';

export function Shell() {
  const [open, setOpen] = useState(false);

  // expand sidebar by default on desktop
  useEffect(() => {
    if (matchMedia('(min-width: 768px)').matches) {
      setOpen(true);
    }
  }, []);

  return (
    <div className="w-full h-full rounded-2xl bg-panel shadow-soft ring-1 ring-border overflow-hidden">
      <div className="grid h-full grid-cols-1 md:grid-cols-[280px,1fr]">
        <Sidebar open={open} onOpenChange={setOpen} />
        <div className="relative flex flex-col">
          <div className="sticky top-0 z-10 flex h-12 items-center border-b border-border bg-bg/80 backdrop-blur supports-[backdrop-filter]:bg-bg/80 px-4">
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              className="h-9 px-3 rounded-xl bg-panel hover:bg-panelElev ring-1 ring-border transition-colors duration-200 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            >
              <PanelLeft className="h-5 w-5" />
            </button>
          </div>
          <ChatPane />
        </div>
      </div>
    </div>
  );
}
