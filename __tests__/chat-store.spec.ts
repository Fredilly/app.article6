import { describe, expect, it } from 'vitest';
import { useChatStore } from '../src/lib/chat-store';

describe('chat store', () => {
  it('handles send, append and clear', () => {
    const store = useChatStore;
    store.getState().clear();

    const userMsg = store.getState().send('hello');
    expect(store.getState().messages).toHaveLength(1);
    expect(userMsg.role).toBe('user');
    expect(store.getState().pending).toBe(true);

    const assistantMsg = store
      .getState()
      .append({ role: 'assistant', content: 'hello' });
    expect(assistantMsg.role).toBe('assistant');
    expect(store.getState().messages).toHaveLength(2);
    expect(store.getState().pending).toBe(false);

    store.getState().clear();
    expect(store.getState().messages).toHaveLength(0);
  });
});
