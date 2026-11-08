import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only` throws outside the React Server environment; unit tests
      // exercise server modules directly, so it is replaced by an empty module.
      "server-only": fileURLToPath(new URL("./tests/unit/support/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
  },
});
