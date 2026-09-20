import { NextResponse } from "next/server";

/*
 * Keeps the Supabase project awake.
 *
 * A free-tier Supabase project is paused after about a week with no database
 * activity, and a paused project takes the companion page — and the QR code a
 * church has printed on its bulletin — down with it, silently, in a week when
 * nobody happened to hold a service. Vercel calls this route once a day (see
 * vercel.json); one trivial read is enough to count as activity.
 *
 * Plain fetch against the REST endpoint rather than the SSR client: there is
 * no user and no cookie here, and the cheapest possible query — one id from a
 * table the anon role may read — is the whole job. A 200 with zero rows still
 * counts; RLS returning nothing is fine.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ ok: false, reason: "supabase env not set" }, { status: 500 });
  }
  try {
    const res = await fetch(`${url}/rest/v1/organizations?select=id&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    return NextResponse.json({ ok: res.ok, status: res.status, at: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ ok: false, reason: (e as Error).message }, { status: 502 });
  }
}
