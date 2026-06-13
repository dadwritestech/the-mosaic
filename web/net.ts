// Thin client: the browser never imports game logic; it calls the server API.
export type View = any;

export async function api(cmd: string, body: Record<string, unknown> = {}): Promise<View> {
  const r = await fetch(`/api/${cmd}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    try {
      const err = await r.json();
      throw new Error(err.message || `HTTP ${r.status}`);
    } catch {
      throw new Error(`HTTP ${r.status}`);
    }
  }
  return r.json();
}
