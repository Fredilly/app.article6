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
    <div className="flex h-full flex-col">
      <header className="border-b p-4 font-semibold">
        Automated Carbon Compliance
      </header>
      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            What would you like to verify?
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={clsx(
                'max-w-[80%] overflow-hidden rounded px-3 py-2 text-sm break-words',
                m.role === 'user'
                  ? 'ml-auto bg-primary text-primary-foreground'
                  : 'mr-auto bg-muted'
              )}
            >
              {m.content}
            </div>
          ))
        )}
      </div>
      <form onSubmit={handleSubmit} className="border-t p-4">
        <div className="flex gap-2">
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
            className="flex-1 rounded border px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
