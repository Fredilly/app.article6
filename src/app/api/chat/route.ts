import { NextRequest } from "next/server";
import { OpenAI } from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { z } from "zod";

const BodySchema = z.object({
  messages: z.array(z.object({ role: z.string(), content: z.string() })),
  images: z.array(z.string()).optional(),
  provider: z.string().optional(),
  model: z.string().optional(),
  temperature: z.number().optional(),
});

function envForProvider(provider: string) {
  switch (provider) {
    case "hf":
      return {
        token: process.env.HF_TOKEN,
        url: process.env.HF_API_URL,
      };
    case "vllm":
      return {
        baseURL: process.env.VLLM_BASE_URL,
        model: process.env.VLLM_MODEL,
      };
    default:
      return {
        apiKey: process.env.OPENROUTER_API_KEY,
        baseURL: process.env.OPENROUTER_BASE_URL,
        model: process.env.OPENROUTER_MODEL,
      };
  }
}

export async function GET() {
  const provider = process.env.PROVIDER || "openrouter";
  const env = envForProvider(provider);
  return Response.json({ ok: true, provider, model: env.model });
}

export async function POST(req: NextRequest) {
  try {
    const body = BodySchema.parse(await req.json());
    const provider = body.provider || process.env.PROVIDER || "openrouter";
    if (provider === "hf") {
      return handleHF(body);
    }
    if (provider === "vllm") {
      return handleOpenAI(
        body,
        process.env.VLLM_BASE_URL!,
        process.env.VLLM_MODEL!,
        undefined
      );
    }
    return handleOpenAI(
      body,
      process.env.OPENROUTER_BASE_URL!,
      body.model || process.env.OPENROUTER_MODEL!,
      process.env.OPENROUTER_API_KEY
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return Response.json({ error: message }, { status: 400 });
  }
}

interface TextMessage {
  role: string;
  content: string;
}

function withImages(
  messages: TextMessage[],
  images?: string[]
): ChatCompletionMessageParam[] {
  const mapped = messages.map((m) => ({
    role: m.role as ChatCompletionMessageParam["role"],
    content: m.content,
  })) as ChatCompletionMessageParam[];
  if (!images?.length) return mapped;
  const last = mapped[mapped.length - 1];
  return [
    ...mapped.slice(0, -1),
    {
      role: last.role,
      content: [
        { type: "text", text: last.content as string },
        ...images.map((url) => ({ type: "image_url", image_url: { url } })),
      ],
    },
  ];
}

async function handleOpenAI(
  body: z.infer<typeof BodySchema>,
  baseURL: string,
  model: string,
  apiKey?: string
) {
  const client = new OpenAI({ apiKey, baseURL });
  const stream = await client.chat.completions.create({
    model,
    messages: withImages(body.messages, body.images),
    stream: true,
    temperature: body.temperature,
  });
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const token = chunk.choices[0]?.delta?.content || "";
          if (token) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text: token })}\n\n`)
            );
          }
        }
        controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });
  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
    },
  });
}

async function handleHF(body: z.infer<typeof BodySchema>) {
  const env = envForProvider("hf");
  const res = await fetch(env.url!, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ inputs: body.messages[body.messages.length - 1].content }),
  });
  const json = await res.json();
  const text =
    json?.generated_text ||
    json?.choices?.[0]?.message?.content ||
    JSON.stringify(json);
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
      controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
      controller.close();
    },
  });
  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
    },
  });
}
