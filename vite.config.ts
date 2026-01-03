import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => {
    return {
      root: '.',
      server: {
        host: 'localhost',
        port: 5175,
        strictPort: true,
        // Proxy /.netlify/functions to the local Netlify Dev server (default port 8888)
        proxy: {
          '/.netlify/functions': {
            target: 'http://localhost:8888',
            changeOrigin: true,
          },
        },
      },
      plugins: [react()],
    };
});
