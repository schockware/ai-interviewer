// Authored by Claude Sonnet 5.5 and Claude Fable 5.1 (Anthropic), with Steven Chock as co-author.
import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

// The API prototype's address, for the dev server's /api proxy. Not secret: it comes from the
// committed env file for the mode (.env.dev for `npm run dev:real`) or a gitignored .env.local.
// Mock mode never calls it, but the proxy is always there so `?integration=real` works on `npm run dev`.
const DEFAULT_API_PROXY_TARGET = 'http://localhost:5036'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const apiTarget = env.VITE_API_PROXY_TARGET || DEFAULT_API_PROXY_TARGET
  return {
    plugins: [react()],
    server: {
      proxy: {
        // The browser calls /api/..., so it needs no CORS setup. The prefix is stripped on the way through.
        // ws: the InterviewHub (SignalR) upgrades /api/hubs/... to a WebSocket through the same proxy.
        '/api': { target: apiTarget, changeOrigin: true, ws: true, rewrite: (path) => path.replace(/^\/api/, '') },
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test-setup.ts'],
      include: ['src/**/*.{test,spec}.{ts,tsx}'],
      // Real-integration tests run only on request: npm run test:integration (decision 0004).
      exclude: ['**/node_modules/**', 'src/**/*.integration.spec.ts'],
    },
  }
})
