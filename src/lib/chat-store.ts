import { create } from 'zustand';
import type { ChatMessage } from './types';

// simple deterministic id generator
let idCounter = 0;
const nextId = () => `${++idCounter}`;

type State = {
  messages: ChatMessage[];
  pending: boolean;
};

type Actions = {
  send: (content: string) => ChatMessage;
  append: (message: Omit<ChatMessage, 'id'>) => ChatMessage;
  clear: () => void;
};

export const useChatStore = create<State & Actions>((set) => ({
  messages: [],
  pending: false,
  send: (content) => {
    const message: ChatMessage = {
      id: nextId(),
      role: 'user',
      content,
    };
    set((state) => ({
      messages: [...state.messages, message],
      pending: true,
    }));
    return message;
  },
  append: (message) => {
    const msg: ChatMessage = { ...message, id: nextId() };
    set((state) => ({
      messages: [...state.messages, msg],
      pending: false,
    }));
    return msg;
  },
  clear: () => set({ messages: [], pending: false }),
}));
