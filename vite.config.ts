import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    // Set VITE_BASE=/football/ to host the app under a sub-folder of an existing site.
    base: env.VITE_BASE || '/',
  };
});
