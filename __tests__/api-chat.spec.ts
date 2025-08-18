import { describe, expect, it } from 'vitest';
import { POST } from '../src/app/api/chat/route';

describe('POST /api/chat', () => {
  it('echoes message', async () => {
    const res = await POST(
      new Request('http://localhost/api/chat', {
        method: 'POST',
        body: JSON.stringify({ message: 'ping' }),
      })
    );
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.echo).toBe('ping');
  });

  it('returns 400 on invalid', async () => {
    const res = await POST(
      new Request('http://localhost/api/chat', {
        method: 'POST',
        body: JSON.stringify({}),
      })
    );
    expect(res.status).toBe(400);
  });
});
