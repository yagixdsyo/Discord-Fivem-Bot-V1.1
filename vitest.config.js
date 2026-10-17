/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.js'],
    environment: 'node',
    testTimeout: 60000,
    hookTimeout: 120000,
  },
});
