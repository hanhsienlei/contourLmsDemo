import path from 'node:path'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''))
  const shared = {
    plugins: [tsconfigPaths()],
    resolve: {
      alias: {
        'server-only': path.resolve(__dirname, 'tests/stubs/server-only.ts'),
      },
    },
  }
  return {
    test: {
      projects: [
        {
          ...shared,
          test: {
            name: 'unit',
            environment: 'node',
            include: ['tests/unit/**/*.test.ts'],
          },
        },
        {
          ...shared,
          test: {
            name: 'integration',
            environment: 'node',
            include: ['tests/integration/**/*.test.ts'],
            fileParallelism: false,
            testTimeout: 20000,
          },
        },
      ],
    },
  }
})
