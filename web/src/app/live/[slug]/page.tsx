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

  const { data: account } = await supabase
    .from("accounts")
    .select("id, name, slug, giving_methods")
    .eq("slug", slug)
    .maybeSingle();

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
