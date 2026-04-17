import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    environmentMatchGlobs: [['src/renderer/**', 'jsdom']],
    testTimeout: 10_000
  },
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared')
    }
  }
})
