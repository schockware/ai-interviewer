import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// The API prototype's address, for the dev server's /api proxy. Not secret. Real mode only uses it.
const apiTarget = process.env.API_PROXY_TARGET ?? 'http://localhost:5036'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // The browser calls /api/..., so it needs no CORS setup. The prefix is stripped on the way through.
      '/api': { target: apiTarget, changeOrigin: true, rewrite: (path) => path.replace(/^\/api/, '') },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // Real-integration tests run only on request: npm run test:integration (decision 0004).
    exclude: ['**/node_modules/**', 'src/**/*.integration.spec.ts'],
  },
})
