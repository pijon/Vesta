import path from 'path';
import { defineConfig } from 'vitest/config';

// Dates are stored as local YYYY-MM-DD. Run in a zone west of UTC with daylight saving, where
// mixing up local and UTC dates (toISOString, new Date('YYYY-MM-DD')) shows up as an off-by-one day.
process.env.TZ = 'America/Los_Angeles';

// Separate from vite.config.ts so tests don't load the PWA and Tailwind plugins.
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
    exclude: ['node_modules/**', 'dist/**', 'functions/node_modules/**', 'functions/lib/**'],
    setupFiles: ['./test/setup.ts'],
  },
});
