import { defineConfig } from 'vite';

export default defineConfig({
  root: 'web',
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
      // (3D GLB models are now served locally from web/public/models3d — see
      //  scripts/fetch-models.mjs. No external host at runtime.)
    },
  },
  build: { outDir: '../dist-web', emptyOutDir: true },
});
