import { z } from 'zod';

const bodySchema = z.object({ message: z.string().min(1) });

export async function POST(req: Request) {
  const log = (info: Record<string, unknown>) =>
    console.log(JSON.stringify(info));
  try {
    const json = await req.json();
    const { message } = bodySchema.parse(json);

    log({ level: 'info', event: 'chat', model: process.env.MODEL_ID });

    // Future model call
    // await fetch(`${process.env.INFERENCE_BASE_URL}/chat/completions`, {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     Authorization: `Bearer ${process.env.INFERENCE_API_KEY}`,
    //   },
    //   body: JSON.stringify({
    //     model: process.env.MODEL_ID,
    //     messages: [{ role: 'user', content: message }],
    //   }),
    // });

    return Response.json({
      echo: message,
      model: process.env.MODEL_ID || 'Qwen2.5-VL',
    });
  } catch {
    return new Response('Invalid request', { status: 400 });
  }
}
