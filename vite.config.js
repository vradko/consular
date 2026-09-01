import { defineConfig } from 'vite';

// base is set at build time so the same source deploys to GitHub Pages
// (served from /<repo>/) and to any root-hosted origin.
export default defineConfig({
  base: process.env.DEPLOY_BASE || '/',
  build: { outDir: 'dist', emptyOutDir: true }
});
