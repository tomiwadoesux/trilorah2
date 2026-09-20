/**
 * The project this app talks to, compiled in.
 *
 * These two values were only ever read from `process.env`, which is fed by
 * `.env.local` — and `.env.local` is developer-only and is not packaged. So
 * every installer ever shipped had no Supabase address at all: the Cloud tab
 * said "cloud is not configured in this build", nobody could sign in, no
 * service row was ever created, and the companion page stayed empty for an
 * entire service. The app worked perfectly and published nothing.
 *
 * The key here is the PUBLISHABLE (anon) key. It is designed to ship inside
 * client applications — a phone browser hitting trilorah.com already sends
 * this exact string on every request. What protects the data is row-level
 * security in Postgres, not the secrecy of this key: anon may read a service
 * only while `is_public = true`, and may write nothing at all. Writes require
 * a signed-in owner, whose session is obtained in the Cloud tab and lives in
 * electron-store on that machine.
 *
 * NEVER put the service-role or secret key here. That one bypasses every
 * policy, and shipping it would hand every install full control of the
 * database. If this file ever needs to carry a key whose role is not `anon`,
 * the design is wrong.
 *
 * An environment variable still wins where one is set, so a developer can
 * point a local build at their own project without touching this file.
 */

export const SUPABASE_DEFAULTS = {
  url: 'https://lmuuvwetrgmrphpkfywm.supabase.co',
  publishableKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxtdXV2d2V0cmdtcnBocGtmeXdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2NjEzNTgsImV4cCI6MjA5MjIzNzM1OH0.t4x1yQh3XkLk4-DiLZOmcZo6cJjG68WYSF6vjGkmiak'
} as const
