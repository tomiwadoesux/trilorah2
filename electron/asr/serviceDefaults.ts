/**
 * Service credentials compiled into the build.
 *
 * The Deepgram key and Hugging Face token used to be typed into Settings by
 * whoever set the church up. They are not any more: a volunteer has no key to
 * type, and asking for one put a blank field on screen that made cloud speech
 * look broken. Both services are ours, billed to us, so the build carries
 * them and the operator never sees a credential at all.
 *
 * Unlike `supabaseDefaults.ts`, whose anon key is designed to be public and
 * is therefore checked in, THESE ARE REAL SECRETS — they bill our account.
 * So this file's values are not committed. `scripts/write-service-defaults.mjs`
 * rewrites it from the environment as part of `npm run dist`, and git ignores
 * the generated copy. A checkout gets the empty version you see here, which
 * behaves exactly like today: whisper-local works, Deepgram is unavailable
 * unless a developer sets DEEPGRAM_API_KEY in .env.local.
 *
 * Anyone who unpacks an installer can still read these out of the bundle —
 * that is true of every client-side key and is why they are scoped keys we
 * can rotate, not account passwords. Rotating means editing .env.local and
 * cutting a new build.
 *
 * An environment variable always wins, so a developer's own key overrides the
 * compiled one without touching this file.
 */

export const SERVICE_DEFAULTS = {
  deepgramApiKey: '',
  hfToken: ''
} as const
