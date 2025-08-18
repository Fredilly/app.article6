export type ChatResponse = {
  echo: string;
  model: string;
};

export async function postChat(message: string): Promise<ChatResponse> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });
  if (!res.ok) {
    throw new Error('Request failed');
  }
  return (await res.json()) as ChatResponse;
}
