/**
 * The YouVersion Platform app key compiled into a build.
 *
 * NKJV and NIV come through the owner's registered app at
 * platform.youversion.com (free for non-commercial apps), so like the
 * Deepgram key in electron/asr/serviceDefaults.ts it is baked in at build
 * time and a church never sees or types it: there is no Settings field.
 *
 * This committed copy is empty, which is what a checkout runs with — NKJV
 * and NIV are then listed in the pickers but greyed ("needs a YouVersion
 * key"). `scripts/write-service-defaults.mjs` writes the real key here from
 * YOUVERSION_APP_KEY (environment or .env.local) during `npm run dist`, and
 * `--restore` empties it again afterwards so it is never committed.
 *
 * A developer's YOUVERSION_APP_KEY in .env.local always wins over this.
 * Kept in a file of its own so the owner's skip-worktree on serviceDefaults.ts
 * is not disturbed.
 */

export const YOUVERSION_DEFAULTS = {
  appKey: ""
} as const
