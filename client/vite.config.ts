import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
  },
  define: {
    __APP_VERSION__: JSON.stringify('1.0.0'),
  },
});
