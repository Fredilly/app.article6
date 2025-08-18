'use client';

import { useChatStore } from "@/lib/store";
import ModelPicker from "./ModelPicker";

const providers = [
  { label: "OpenRouter", value: "openrouter" },
  { label: "HuggingFace", value: "hf" },
  { label: "vLLM", value: "vllm" },
];

export default function Sidebar() {
  const conversations = useChatStore((s) => Object.values(s.conversations));
  const activeId = useChatStore((s) => s.activeId);
  const setActive = useChatStore((s) => s.setActive);
  const newConversation = useChatStore((s) => s.newConversation);
  const provider = useChatStore((s) => s.provider);
  const setProvider = useChatStore((s) => s.setProvider);
  const temperature = useChatStore((s) => s.temperature);
  const setTemperature = useChatStore((s) => s.setTemperature);

  return (
    <div className="hidden md:flex md:w-64 border-r flex-col">
      <div className="p-4 space-y-4">
        <button
          onClick={() => newConversation()}
          className="w-full bg-primary text-primary-foreground p-2 rounded"
        >
          New chat
        </button>
        <div className="space-y-2">
          <label className="text-xs font-medium">Provider</label>
          <select
            className="w-full border rounded p-2 text-sm"
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
          >
            {providers.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <ModelPicker />
        <div className="space-y-1">
          <label className="text-xs font-medium">Temperature: {temperature.toFixed(1)}</label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.1}
            value={temperature}
            onChange={(e) => setTemperature(parseFloat(e.target.value))}
            className="w-full"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {conversations.map((c) => (
          <div
            key={c.id}
            onClick={() => setActive(c.id)}
            className={`p-2 cursor-pointer ${c.id === activeId ? "bg-muted" : ""}`}
          >
            Chat {c.id}
          </div>
        ))}
      </div>
    </div>
  );
}
