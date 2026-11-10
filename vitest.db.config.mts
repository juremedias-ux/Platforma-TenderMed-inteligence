import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/** Database/RLS tests. Run through scripts/test-db.sh, which provides DB_TEST_URL. */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/db/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
