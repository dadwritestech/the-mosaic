// Standalone game-logic server (run with tsx). Vite proxies /api here.
// Runs under esbuild's CJS interop (like vitest), so pokemon-showdown's exports resolve.
import { createServer } from 'node:http';
import { dispatch } from './session';

const PORT = 3001;

const server = createServer(async (req, res) => {
  if (!req.url || !req.url.startsWith('/api/')) { res.statusCode = 404; res.end('not found'); return; }
  const cmd = req.url.slice('/api/'.length).split('?')[0];
  try {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString() || '{}') : {};
    const result = await dispatch(cmd, body);
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(result));
  } catch (err: any) {
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ error: String(err?.stack || err) }));
  }
});

server.listen(PORT, () => console.log(`[game-server] listening on http://localhost:${PORT}`));
