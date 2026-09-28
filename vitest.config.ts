import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['electron/**/*.test.ts', 'shared/**/*.test.ts', 'evals/**/*.test.ts', 'src/lib/**/*.test.ts'],
  },
})
