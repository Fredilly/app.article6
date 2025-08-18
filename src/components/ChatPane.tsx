'use client';

import { FormEvent, useRef, useState } from 'react';
import clsx from 'clsx';
import { postChat } from '@/lib/api';
import { useChatStore } from '@/lib/chat-store';

export function ChatPane() {
  const { messages, pending, send, append } = useChatStore();
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const content = input.trim();
    if (!content) return;
    send(content);
    setInput('');
    inputRef.current?.focus();
    try {
      const res = await postChat(content);
      append({ role: 'assistant', content: res.echo });
    } catch (err) {
      console.error(err);
      // ensure pending flag resets on error
      useChatStore.setState({ pending: false });
    }
  };

  return (
    <div className="relative flex flex-col h-full">
      <header className="border-b border-border bg-panel/70 backdrop-blur p-4 md:p-6">
        <h1 className="text-lg font-semibold">Automated Carbon Compliance</h1>
      </header>
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
        {messages.length === 0 ? (
          <div className="mx-auto my-24 max-w-xl text-center p-8 rounded-2xl bg-panelElev ring-1 ring-border">
            <h2 className="text-2xl font-semibold">What would you like to verify?</h2>
            <p className="mt-2 text-subtext">Start by sending a message.</p>
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={clsx(
                'max-w-[72ch] px-4 py-3 ring-1 ring-border break-words',
                m.role === 'user'
                  ? 'ml-auto rounded-2xl rounded-tr-md bg-[#1B2631]'
                  : 'mr-auto rounded-2xl rounded-tl-md bg-[#121A22]'
              )}
            >
              {m.content}
            </div>
          ))
        )}
      </div>
      <form onSubmit={handleSubmit} className="border-t border-border bg-panel/80 backdrop-blur">
        <div className="max-w-3xl mx-auto py-4 px-4 md:px-0 flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.shiftKey) {
                return;
              }
            }}
            placeholder="What would you like to verify?"
            className="flex-1 h-12 px-4 rounded-xl bg-[#131A22] ring-1 ring-border placeholder:text-subtext focus:ring-2 focus:ring-accent/60 outline-none"
          />
          <button
            type="submit"
            disabled={pending}
            className="h-12 px-4 rounded-xl bg-accent text-black font-medium hover:brightness-110 disabled:opacity-50 transition-colors duration-200 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
