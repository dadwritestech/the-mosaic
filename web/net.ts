// Thin client: the browser never imports game logic; it calls the server API.
export type View = any;

export async function api(cmd: string, body: Record<string, unknown> = {}): Promise<View> {
  const r = await fetch(`/api/${cmd}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return r.json();
}
