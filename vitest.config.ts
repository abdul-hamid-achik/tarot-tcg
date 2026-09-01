import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
  },
  test: {
    environment: 'happy-dom',
    setupFiles: ['./src/test-setup.ts'],
    globals: true,
    exclude: ['node_modules', 'e2e', '**/.next/**', '**/coverage/**'],
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
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/test-setup.ts',
        'src/test_setup.ts',
        'src/test_utils.tsx',
        '**/*.d.ts',
        'src/app/**',
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
      'content-collections': path.resolve(__dirname, './.content-collections/generated'),
    },
  },
})
