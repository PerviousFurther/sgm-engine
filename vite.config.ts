import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  publicDir: 'asset',
  build: {
    rollupOptions: {
      input: {
        game: resolve(import.meta.dirname, 'game.html'),
        editor: resolve(import.meta.dirname, 'editor.html'),
      },
    },
  },
});
