import { create } from "zustand";

export type Message = { role: "user" | "assistant"; content: string };
export type Conversation = { id: string; messages: Message[] };

interface ChatState {
  conversations: Record<string, Conversation>;
  activeId: string | null;
  provider: string;
  model: string;
  temperature: number;
  newConversation: () => string;
  addMessage: (id: string, message: Message) => void;
  setActive: (id: string) => void;
  setModel: (model: string) => void;
  setProvider: (provider: string) => void;
  setTemperature: (temp: number) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  conversations: {},
  activeId: null,
  provider: process.env.PROVIDER || "openrouter",
  model: process.env.OPENROUTER_MODEL || "qwen/qwen2.5-vl-7b-instruct",
  temperature: 0.7,
  newConversation: () => {
    const id = Date.now().toString();
    set((state) => ({
      conversations: {
        ...state.conversations,
        [id]: { id, messages: [] },
      },
      activeId: id,
    }));
    return id;
  },
  addMessage: (id, message) =>
    set((state) => {
      const convo = state.conversations[id] || { id, messages: [] };
      return {
        conversations: {
          ...state.conversations,
          [id]: { ...convo, messages: [...convo.messages, message] },
        },
      };
    }),
  setActive: (id) => set({ activeId: id }),
  setModel: (model) => set({ model }),
  setProvider: (provider) => set({ provider }),
  setTemperature: (temperature) => set({ temperature }),
}));
