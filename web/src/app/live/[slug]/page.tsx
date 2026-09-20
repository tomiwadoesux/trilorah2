import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import CompanionClient from "./CompanionClient";

export const revalidate = 0; // always fresh — service state changes constantly

export default async function LivePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  // Through a function, not the table: `accounts` has no anonymous read policy
  // (it holds every church's giving details), so a direct select from a
  // congregant's phone returned nothing and this page was a 404 for everyone.
  // public_account_by_slug returns only these four columns, for one slug.
  const { data: rows } = await supabase.rpc("public_account_by_slug", { p_slug: slug });
  const account = (Array.isArray(rows) ? rows[0] : rows) as
    | { id: string; name: string; slug: string; giving_methods: Record<string, string> }
    | null
    | undefined;

  if (!account) notFound();

  // Latest service for this account (live or recently ended within 4 weeks)
  const fourWeeksAgo = computeFourWeeksAgo();
  const { data: service } = await supabase
    .from("services")
    .select("*")
    .eq("account_id", account.id)
    .eq("is_public", true)
    .gte("started_at", fourWeeksAgo)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <CompanionClient
      account={account as Parameters<typeof CompanionClient>[0]["account"]}
      initialService={
        service as Parameters<typeof CompanionClient>[0]["initialService"]
      }
    />
  );
}

function computeFourWeeksAgo(): string {
  return new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString();
}
