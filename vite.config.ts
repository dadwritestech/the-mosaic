import { defineConfig } from 'vite';

export default defineConfig({
  root: 'web',
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001', // -> the tsx game server
      // Same-origin proxy for Showdown sprites so they load as WebGL textures (no CORS).
      '/sprites': { target: 'https://play.pokemonshowdown.com', changeOrigin: true, secure: true },
    },
  },
  build: { outDir: '../dist-web', emptyOutDir: true },
});
