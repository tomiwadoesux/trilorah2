/**
 * The companion app has its own vitest root because the repo-root config only
 * includes electron/, shared/ and evals/ — and this app is deployed separately
 * (Vercel root dir `web/`), so its tests belong with it.
 *
 *   npx vitest run --config web/vitest.config.ts
 */
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    root: __dirname,
  },
});
