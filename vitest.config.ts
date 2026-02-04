/**
 * Vitest Config
 */

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["**/*.test.ts", "**/*.test.tsx"],
    setupFiles: ["./vitest.setup.ts"],
    env: {
      NODE_ENV: "test",
      DATABASE_URL: "file:./test.db",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json"],
      exclude: [
        "node_modules/**",
        "**/*.config.{ts,js}",
        "**/*.d.ts",
        "dist/**",
        "build/**",
        ".next/**",
      ],
    },
  },
});
