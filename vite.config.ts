import { defineConfig, type Plugin } from 'vite';
import { promises as fs } from 'fs';
import * as path from 'path';

// Serve the local PokeAPI animated battle GIFs (sprites-master) at /pkmn/<num>.gif
// (front) and /pkmn/back/<num>.gif — no external dependency, no copying.
function pkmnSprites(): Plugin {
  const baseDir = path.resolve(__dirname, 'sprites-master/sprites/pokemon/other/showdown');
  return {
    name: 'pkmn-sprites',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const m = (req.url || '').match(/^\/pkmn\/(back\/)?(\d+)\.gif/);
        if (!m) return next();
        const file = path.join(baseDir, m[1] ? 'back' : '', `${m[2]}.gif`);
        try {
          const buf = await fs.readFile(file);
          res.setHeader('Content-Type', 'image/gif');
          res.end(buf);
        } catch { res.statusCode = 404; res.end(); }
      });
    },
  };
}

export default defineConfig({
  root: 'web',
  plugins: [pkmnSprites()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001', // -> the tsx game server
      // Same-origin proxy for Showdown sprites so they load as WebGL textures (no CORS).
      '/sprites': { target: 'https://play.pokemonshowdown.com', changeOrigin: true, secure: true },
      // High-res Pokémon HOME 3D-model renders (512px PNG, transparent) from PokeAPI.
      '/home': {
        target: 'https://raw.githubusercontent.com',
        changeOrigin: true, secure: true,
        rewrite: (p) => p.replace(/^\/home/, '/PokeAPI/sprites/master/sprites/pokemon/other/home'),
      },
      // (3D GLB models are served locally from web/public/models3d.)
    },
  },
  build: { outDir: '../dist-web', emptyOutDir: true },
});
