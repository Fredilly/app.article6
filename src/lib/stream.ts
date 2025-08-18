import { createParser } from "eventsource-parser";

export async function streamResponse(
  res: Response,
  onToken: (token: string) => void
) {
  const reader = res.body?.getReader();
  if (!reader) return;
  const decoder = new TextDecoder();
  const parser = createParser((event) => {
    if (event.type === "event") {
      if (event.data === "[DONE]") return;
      try {
        const json = JSON.parse(event.data);
        const text = json.text || json.content || "";
        if (text) onToken(text);
      } catch {
        // ignore
      }
    }
  });
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    parser.feed(decoder.decode(value));
  }
}
