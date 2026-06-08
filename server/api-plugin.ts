import type { Plugin, ViteDevServer } from 'vite';
import { resolve } from 'node:path';

// Dev-server middleware exposing the game logic at /api/<cmd> (POST JSON).
// Runs in Vite's Node process via SSR, so pokemon-showdown works. The session
// module is cached by Vite's SSR registry, so its in-memory state persists.
export function gameApiPlugin(): Plugin {
  return {
    name: 'game-api',
    configureServer(server: ViteDevServer) {
      const sessionPath = resolve(process.cwd(), 'server/session.ts');
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith('/api/')) return next();
        const cmd = req.url.slice('/api/'.length).split('?')[0];
        try {
          const chunks: Buffer[] = [];
          for await (const c of req) chunks.push(c as Buffer);
          const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString() || '{}') : {};
          const mod = await server.ssrLoadModule(sessionPath);
          const result = await mod.dispatch(cmd, body);
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(result));
        } catch (err: any) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: String(err?.stack || err) }));
        }
      });
    },
  };
}
