import type { ChatMessage } from "./schema";

export function buildEchoReply(userContent: string): ChatMessage {
  const text =
    userContent?.trim()
      ? `Echo (Qwen2.5-VL scaffold): ${userContent}`
      : "Echo (Qwen2.5-VL scaffold): [no content]";
  return {
    role: "assistant",
    content: text
  };
}
