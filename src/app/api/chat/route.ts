import { NextResponse } from "next/server";
import { ChatRequestSchema, ChatMessage } from "@/lib/chat/schema";
import { buildEchoReply } from "@/lib/chat/echo";

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const parse = ChatRequestSchema.safeParse(json);
    if (!parse.success) {
      return NextResponse.json(
        { error: "Invalid payload", issues: parse.error.flatten() },
        { status: 400 }
      );
    }

    const { messages } = parse.data;
    const lastUser = [...messages].reverse().find(m => m.role === "user");
    const content = lastUser?.content ?? "";

    // Provider switch is stubbed; default to echo for now.
    const provider = process.env.QWEN_PROVIDER ?? "echo";
    let assistant: ChatMessage;
    switch (provider) {
      case "echo":
      default:
        assistant = buildEchoReply(content);
        break;
    }

    return NextResponse.json({ messages: [...messages, assistant] }, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
