/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';
import react from '@vitejs/plugin-react';

const reportName = process.argv[3]?.split('=')?.[1] ?? 'node';
const date = Date.now();
const reportFolder = `test-results/report-${date}`;

export default defineConfig({
  plugins: [react()],

  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'index',
    },
    target: 'node',
  },
  test: {
    includeSource: ['src/**/*.{js,ts}'],
    api: {
      port: 3000,
    },
    ui: true,
    uiBase: '/',
  },
});
