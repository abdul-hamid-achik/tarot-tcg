import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    setupFiles: ['./src/test-setup.ts'],
    globals: true,
    exclude: ['node_modules', 'e2e'],
    css: true,
    // Disable watch mode by default
    watch: false,
    // UI options
    ui: true,
    open: false,
    // Coverage options
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test-setup.ts',
        '**/*.d.ts',
        '**/*.config.*',
        'src/app/**', // Next.js app directory
        '**/__tests__/**',
        '**/*.test.*',
        '**/*.spec.*',
      ],
    },
    // Timer mocking for game clock tests
    fakeTimers: {
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
