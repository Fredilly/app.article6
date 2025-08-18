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
    <div className="flex h-full">
      <Sidebar open={open} onOpenChange={setOpen} />
      <div className="flex flex-1 flex-col">
        <div className="flex h-12 items-center border-b px-4">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="mr-2"
          >
            <PanelLeft className="h-5 w-5" />
          </button>
        </div>
        <ChatPane />
      </div>
    </div>
  );
}
