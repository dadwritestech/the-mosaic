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
      // Real Draco-compressed GLB 3D models (Pokemon-3D-api/assets), keyed by dex num.
      '/models3d': {
        target: 'https://raw.githubusercontent.com',
        changeOrigin: true, secure: true,
        rewrite: (p) => p.replace(/^\/models3d/, '/Pokemon-3D-api/assets/main/models/opt/regular'),
      },
    },
  },
  build: { outDir: '../dist-web', emptyOutDir: true },
});
