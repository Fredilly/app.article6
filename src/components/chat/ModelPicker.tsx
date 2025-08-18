'use client';

import { useChatStore } from "@/lib/store";

const models = [
  { label: "Qwen2.5-VL 7B", value: "qwen/qwen2.5-vl-7b-instruct" },
  { label: "Qwen2.5-VL 32B", value: "qwen/qwen2.5-vl-32b-instruct" },
  { label: "Qwen2.5-VL 72B", value: "qwen/qwen2.5-vl-72b-instruct" },
];

export default function ModelPicker() {
  const model = useChatStore((s) => s.model);
  const setModel = useChatStore((s) => s.setModel);
  return (
    <select
      className="w-full border rounded p-2 text-sm"
      value={model}
      onChange={(e) => setModel(e.target.value)}
    >
      {models.map((m) => (
        <option key={m.value} value={m.value}>
          {m.label}
        </option>
      ))}
    </select>
  );
}
