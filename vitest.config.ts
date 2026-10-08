import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["evals/**/*.test.ts"],
    // Each test file gets its own in-memory database.
    env: { MASTRA_DB_URL: ":memory:" },
    testTimeout: 180_000,
  },
});
