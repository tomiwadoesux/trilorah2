import { writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { sanitizeLook } from "@/components/box-led-hero/look";

// Development only: the box & glow panel's Save button writes the look into look.json.
// Same-origin requests only, and the body is reduced to known, in-range values.
export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return new NextResponse(null, { status: 404 });
  }
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  if (body === null) {
    return NextResponse.json({ error: "expected a JSON look" }, { status: 400 });
  }
  const file = path.join(process.cwd(), "src/components/box-led-hero/look.json");
  await writeFile(file, `${JSON.stringify(sanitizeLook(body), null, 2)}\n`);
  return NextResponse.json({ ok: true });
}

function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
