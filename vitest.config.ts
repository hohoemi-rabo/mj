import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Vite がネイティブに tsconfig の paths（@/* -> ./src/*）を解決する。
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**/*.ts'],
      exclude: ['src/lib/**/*.{test,spec}.ts'],
      reporter: ['text', 'html'],
    },
  },
})
