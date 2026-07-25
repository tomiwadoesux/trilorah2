import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SermonNotesSections, {
  notesAreEmpty,
  type SermonNotesData,
} from "@/components/SermonNotesSections";
import { segmentLabel } from "@/lib/segment-labels";
import {
  formatDuration,
  formatServiceDate,
  formatServiceTime,
  serviceTitle,
} from "@/lib/format";

export const revalidate = 0;

interface Chunk {
  id: string;
  text: string;
  timestamp: string;
  segment_type: string | null;
}

interface PushedVerse {
  id: string;
  ref: string;
  pushed_at: string | null;
}

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) redirect("/app");

  const { data: account } = await supabase
    .from("accounts")
    .select("id")
    .eq("owner_user_id", userResp.user.id)
    .maybeSingle();

  // No account yet — dashboard walks through setup.
  if (!account) redirect("/app/dashboard");

  // Scoped to this account — a foreign or unknown id falls through to 404.
  const { data: service } = await supabase
    .from("services")
    .select("id, sermon_title, started_at, ended_at, preacher_id, is_public")
    .eq("id", id)
    .eq("account_id", account.id)
    .maybeSingle();

  if (!service) notFound();

  const [preacherRes, notesRes, versesRes, chunksRes, audienceRes, cityRes] =
    await Promise.all([
      service.preacher_id
        ? supabase
            .from("preachers")
            .select("name")
            .eq("id", service.preacher_id)
            .maybeSingle()
        : Promise.resolve({ data: null as { name: string } | null }),
      supabase
        .from("sermon_notes")
        .select("*")
        .eq("service_id", service.id)
        .maybeSingle(),
      supabase
        .from("detected_verses")
        .select("id, ref, pushed_at")
        .eq("service_id", service.id)
        .eq("pushed_to_live", true)
        .order("pushed_at", { ascending: true }),
      supabase
        .from("transcript_chunks")
        .select("id, text, timestamp, segment_type")
        .eq("service_id", service.id)
        .eq("is_final", true)
        .order("timestamp", { ascending: true })
        .limit(5000),
      supabase
        .from("audience_sessions")
        .select("id", { count: "exact", head: true })
        .eq("service_id", service.id),
      supabase
        .from("audience_sessions")
        .select("city")
        .eq("service_id", service.id)
        .not("city", "is", null)
        .limit(1000),
    ]);

  const preacher = (preacherRes.data as { name: string } | null)?.name ?? null;
  const notes = (notesRes.data ?? null) as SermonNotesData | null;
  const verses = (versesRes.data ?? []) as PushedVerse[];
  const chunks = (chunksRes.data ?? []) as Chunk[];
  const audienceCount = audienceRes.count ?? 0;

  const cityCounts = new Map<string, number>();
  for (const row of (cityRes.data ?? []) as { city: string | null }[]) {
    if (!row.city) continue;
    cityCounts.set(row.city, (cityCounts.get(row.city) ?? 0) + 1);
  }
  const topCities = [...cityCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([city, n]) => (n > 1 ? `${city} (${n})` : city));

  const hasNotes = notes !== null && !notesAreEmpty(notes);
  const isLive = !service.ended_at;
  const duration = formatDuration(service.started_at, service.ended_at);
  const groups = groupBySegment(chunks);

  return (
    <main className="min-h-screen p-6 max-w-5xl mx-auto space-y-8">
      <header className="space-y-2">
        <Link
          href="/app/services"
          className="text-[11px] text-gray-500 hover:text-brand"
        >
          ← All services
        </Link>
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-2xl font-bold">
            {serviceTitle(service.sermon_title, service.started_at)}
          </h1>
          <div className="flex items-center gap-2 shrink-0 mt-1.5">
            {isLive && (
              <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-brand">
                <span className="w-1.5 h-1.5 rounded-full bg-brand live-dot" />
                Live
              </span>
            )}
            {service.is_public ? (
              <span className="px-2.5 py-1 rounded-full bg-brand/10 border border-brand/20 text-brand text-[10px] font-medium uppercase tracking-widest">
                Public
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/10 text-gray-400 text-[10px] font-medium uppercase tracking-widest">
                Private
              </span>
            )}
          </div>
        </div>
        <p className="text-sm text-gray-500">
          {preacher ?? "Unknown preacher"}
          {" · "}
          {formatServiceDate(service.started_at)}
          {" · "}
          {duration ?? "In progress"}
        </p>
        {audienceCount > 0 && (
          <p className="text-[11px] text-gray-500">
            {audienceCount} {audienceCount === 1 ? "person" : "people"} followed
            along
            {topCities.length > 0 && <> · {topCities.join(", ")}</>}
          </p>
        )}
      </header>

      <section>
        <h2 className="text-[10px] uppercase tracking-widest text-gray-500 mb-3">
          Sermon notes
        </h2>
        {hasNotes && notes ? (
          <div className="space-y-6">
            <SermonNotesSections notes={notes} />
          </div>
        ) : (
          <p className="text-sm text-gray-500">
            {isLive
              ? "Notes are still building — check back after the service."
              : "No notes were generated for this service."}
          </p>
        )}
      </section>

      <section>
        <h2 className="text-[10px] uppercase tracking-widest text-gray-500 mb-3">
          Verses pushed live
        </h2>
        {verses.length > 0 ? (
          <ul className="rounded-xl bg-white/[0.03] border border-white/10 divide-y divide-white/5">
            {verses.map((v) => (
              <li
                key={v.id}
                className="flex items-center justify-between px-4 py-3"
              >
                <span className="px-2.5 py-0.5 rounded-full bg-brand/15 border border-brand/40 text-brand text-xs font-semibold">
                  {v.ref}
                </span>
                {v.pushed_at && (
                  <time className="text-[11px] text-gray-500 tabular-nums">
                    {formatServiceTime(v.pushed_at)}
                  </time>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">
            No verses were pushed live during this service.
          </p>
        )}
      </section>

      <section>
        <h2 className="text-[10px] uppercase tracking-widest text-gray-500 mb-3">
          Transcript
        </h2>
        {groups.length > 0 ? (
          <details className="rounded-xl bg-white/[0.03] border border-white/10">
            <summary className="cursor-pointer select-none px-5 py-4 text-sm text-gray-300 hover:text-white transition-colors">
              Show transcript
              <span className="text-gray-500">
                {" "}
                · {chunks.length} {chunks.length === 1 ? "line" : "lines"}
              </span>
            </summary>
            <div className="px-5 pb-5 pt-4 space-y-6 border-t border-white/5">
              {groups.map((g, gi) => {
                const meta = segmentLabel(g.type);
                return (
                  <div key={gi}>
                    <h3 className="text-[10px] uppercase tracking-widest text-gray-500 mb-2">
                      {meta.emoji && <span className="mr-1.5">{meta.emoji}</span>}
                      {meta.label}
                    </h3>
                    <div className="space-y-3">
                      {toParagraphs(g.texts).map((p, pi) => (
                        <p
                          key={pi}
                          className="text-sm text-gray-300 leading-relaxed"
                        >
                          {p}
                        </p>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </details>
        ) : (
          <p className="text-sm text-gray-500">
            No transcript was archived for this service.
          </p>
        )}
      </section>
    </main>
  );
}

/** Runs of consecutive chunks sharing a segment type. */
function groupBySegment(chunks: Chunk[]): { type: string | null; texts: string[] }[] {
  const groups: { type: string | null; texts: string[] }[] = [];
  for (const c of chunks) {
    if (!c.text) continue;
    const type = c.segment_type ?? null;
    const last = groups[groups.length - 1];
    if (last && last.type === type) last.texts.push(c.text);
    else groups.push({ type, texts: [c.text] });
  }
  return groups;
}

/** Join chunk lines into readable paragraphs of ~8 lines each. */
function toParagraphs(texts: string[], size = 8): string[] {
  const paras: string[] = [];
  for (let i = 0; i < texts.length; i += size) {
    paras.push(texts.slice(i, i + size).join(" "));
  }
  return paras;
}
