import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LinkCodeManager from "./LinkCodeManager";
import SignOutButton from "./SignOutButton";
import FinishSetup from "./FinishSetup";
import QrCard from "./QrCard";
import { IconCredits } from '@/components/IconCredits';
import { ArrowRight } from '@/components/icons';

export const revalidate = 0;

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) redirect("/app");

  const { data: account } = await supabase
    .from("accounts")
    .select("id, organization_id, slug, name, is_org_admin")
    .eq("owner_user_id", userResp.user.id)
    .maybeSingle();

  if (!account) {
    return <FinishSetup email={userResp.user.email ?? ""} />;
  }

  // Sister campuses (other accounts in the same org)
  const { data: campuses } = await supabase
    .from("accounts")
    .select("id, name, slug")
    .eq("organization_id", account.organization_id);

  // Recent services
  const { data: services } = await supabase
    .from("services")
    .select("id, sermon_title, started_at, ended_at, preacher_id")
    .eq("account_id", account.id)
    .order("started_at", { ascending: false })
    .limit(20);

  // Preachers visible to this org
  const { data: preachers } = await supabase
    .from("preachers")
    .select("id, name, detection_accuracy, learned_false_positive_phrases, favorite_verse_refs")
    .eq("organization_id", account.organization_id);

  return (
    <main className="min-h-screen p-6 max-w-5xl mx-auto space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{account.name}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Public companion:{" "}
            <Link
              href={`/live/${account.slug}`}
              target="_blank"
              className="text-brand hover:underline"
            >
              /live/{account.slug}
            </Link>
          </p>
        </div>
        <SignOutButton />
      </header>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <QrCard slug={account.slug} />

        <div className="rounded-xl bg-white/[0.03] border border-white/10 p-5">
          <h2 className="text-[10px] uppercase tracking-widest text-gray-500 mb-3">
            Linked campuses
          </h2>
          {campuses && campuses.length > 1 ? (
            <ul className="space-y-2">
              {campuses.map((c) => (
                <li key={c.id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-200">{c.name}</span>
                  <Link
                    href={`/live/${c.slug}`}
                    target="_blank"
                    className="text-[11px] text-gray-500 hover:text-brand"
                  >
                    /live/{c.slug}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">Just this campus, for now.</p>
          )}
          <div className="mt-4 pt-4 border-t border-white/5">
            <LinkCodeManager isOrgAdmin={account.is_org_admin} />
          </div>
        </div>

        <div className="rounded-xl bg-white/[0.03] border border-white/10 p-5">
          <h2 className="text-[10px] uppercase tracking-widest text-gray-500 mb-3">
            Preachers
          </h2>
          {preachers && preachers.length > 0 ? (
            <ul className="space-y-3">
              {preachers.map((p) => (
                <li key={p.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-white">{p.name}</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      {p.favorite_verse_refs?.length ?? 0} favorite verses ·{" "}
                      {p.learned_false_positive_phrases?.length ?? 0} learned filters
                    </p>
                  </div>
                  <span className="text-xs text-brand tabular-nums">
                    {Math.round((p.detection_accuracy ?? 0) * 100)}%
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">
              Preacher profiles will appear here after their first service.
            </p>
          )}
        </div>
      </section>

      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-[10px] uppercase tracking-widest text-gray-500">
            Recent services
          </h2>
          <Link
            href="/app/services"
            className="inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-brand"
          >
            View all <ArrowRight size={12} />
          </Link>
        </div>
        {services && services.length > 0 ? (
          <ul className="space-y-2">
            {services.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/app/services/${s.id}`}
                  className="block rounded-lg bg-white/[0.03] border border-white/10 p-4 hover:border-white/20 transition-colors"
                >
                  <div className="flex items-baseline justify-between">
                    <p className="text-sm font-medium text-white">
                      {s.sermon_title || "Untitled service"}
                    </p>
                    <time className="text-[11px] text-gray-500 tabular-nums">
                      {new Date(s.started_at).toLocaleString()}
                    </time>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1">
                    {s.ended_at ? "Ended" : "In progress"}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">
            No services yet. Run one in the desktop app — it&apos;ll sync here automatically.
          </p>
        )}
      </section>
      <IconCredits />
    </main>
  );
}
