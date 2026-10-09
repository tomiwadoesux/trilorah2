import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatDuration, formatServiceDate, serviceTitle } from "@/lib/format";
import { ArrowLeft, ArrowRight } from "@/components/icons";

export const revalidate = 0;

const PAGE_SIZE = 25;

interface ServiceRow {
  id: string;
  sermon_title: string | null;
  started_at: string;
  ended_at: string | null;
  preacher_id: string | null;
}

export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: rawPage } = await searchParams;
  const page = Math.max(1, Number.parseInt(rawPage ?? "1", 10) || 1);

  const supabase = await createClient();
  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) redirect("/app");

  const { data: account } = await supabase
    .from("accounts")
    .select("id, name")
    .eq("owner_user_id", userResp.user.id)
    .maybeSingle();

  // No account yet — dashboard walks through setup.
  if (!account) redirect("/app/dashboard");

  const from = (page - 1) * PAGE_SIZE;
  const { data, count } = await supabase
    .from("services")
    .select("id, sermon_title, started_at, ended_at, preacher_id", {
      count: "exact",
    })
    .eq("account_id", account.id)
    .order("started_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  const services = (data ?? []) as ServiceRow[];
  const total = count ?? services.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Preacher names + pushed-verse counts for the visible page, in parallel.
  const serviceIds = services.map((s) => s.id);
  const preacherIds = [
    ...new Set(services.map((s) => s.preacher_id).filter(Boolean)),
  ] as string[];

  const [preachersRes, versesRes] = await Promise.all([
    preacherIds.length > 0
      ? supabase.from("preachers").select("id, name").in("id", preacherIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    serviceIds.length > 0
      ? supabase
          .from("detected_verses")
          .select("service_id")
          .in("service_id", serviceIds)
          .eq("pushed_to_live", true)
      : Promise.resolve({ data: [] as { service_id: string }[] }),
  ]);

  const preacherName = new Map<string, string>();
  for (const p of preachersRes.data ?? []) preacherName.set(p.id, p.name);

  const verseCount = new Map<string, number>();
  for (const v of versesRes.data ?? []) {
    verseCount.set(v.service_id, (verseCount.get(v.service_id) ?? 0) + 1);
  }

  return (
    <main className="min-h-screen p-6 max-w-5xl mx-auto space-y-8">
      <header className="flex items-end justify-between">
        <div>
          <Link
            href="/app/dashboard"
            className="inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-brand"
          >
            <ArrowLeft size={12} /> Dashboard
          </Link>
          <h1 className="text-2xl font-bold mt-1">Services</h1>
        </div>
        <p className="text-[11px] text-gray-500 tabular-nums">
          {total} {total === 1 ? "service" : "services"}
        </p>
      </header>

      <section>
        <h2 className="text-[10px] uppercase tracking-widest text-gray-500 mb-3">
          All services
        </h2>
        {services.length > 0 ? (
          <ul className="space-y-2">
            {services.map((s) => {
              const duration = formatDuration(s.started_at, s.ended_at);
              const n = verseCount.get(s.id) ?? 0;
              return (
                <li key={s.id}>
                  <Link
                    href={`/app/services/${s.id}`}
                    className="block rounded-lg bg-white/[0.03] border border-white/10 p-4 hover:border-white/20 transition-colors"
                  >
                    <div className="flex items-baseline justify-between gap-4">
                      <p className="text-sm font-medium text-white flex items-baseline gap-2 flex-wrap">
                        {serviceTitle(s.sermon_title, s.started_at)}
                        {!s.ended_at && (
                          <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-brand">
                            <span className="w-1.5 h-1.5 rounded-full bg-brand live-dot" />
                            Live
                          </span>
                        )}
                      </p>
                      <time className="text-[11px] text-gray-500 tabular-nums shrink-0">
                        {formatServiceDate(s.started_at)}
                      </time>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1">
                      {(s.preacher_id && preacherName.get(s.preacher_id)) ||
                        "Unknown preacher"}
                      {" · "}
                      {duration ?? "In progress"}
                      {" · "}
                      {n} {n === 1 ? "verse" : "verses"}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">
            {page > 1
              ? "Nothing on this page."
              : "No services yet. Run one in the desktop app — it’ll sync here automatically."}
          </p>
        )}
      </section>

      {totalPages > 1 && (
        <nav className="flex items-center justify-between text-[11px] text-gray-500">
          {page > 1 ? (
            <Link
              href={`/app/services?page=${page - 1}`}
              className="inline-flex items-center gap-1 hover:text-brand"
            >
              <ArrowLeft size={12} /> Newer
            </Link>
          ) : (
            <span />
          )}
          <span className="tabular-nums">
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              href={`/app/services?page=${page + 1}`}
              className="inline-flex items-center gap-1 hover:text-brand"
            >
              Older <ArrowRight size={12} />
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </main>
  );
}
