import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig(({ mode }) => ({
  base: process.env.GITHUB_PAGES === 'true' ? '/delivery-map-test-v1/' : '/',
  plugins: mode === 'https' ? [basicSsl()] : [],
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
}));
