import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import CompanionClient from "./CompanionClient";
import CompanionPreview from "../preview/CompanionPreview";

export const revalidate = 0; // always fresh — service state changes constantly

export default async function LivePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ service?: string; demo?: string }>;
}) {
  const { slug } = await params;
  const { service: requested, demo } = await searchParams;
  const serviceId = requested && /^[0-9a-f-]{36}$/i.test(requested) ? requested : null;
  if (requested && !serviceId) notFound();
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

  // Local design review only; never writes fixtures into a church service.
  if (process.env.NODE_ENV === "development" && demo === "empty") {
    return <CompanionPreview account={account} emptyTranscript />;
  }

  // Keep the latest public service reachable after the congregation goes home.
  let serviceQuery = supabase
    .from("services")
    .select("*")
    .eq("account_id", account.id)
    .eq("is_public", true);
  if (serviceId) serviceQuery = serviceQuery.eq("id", serviceId);
  const { data: service } = await serviceQuery.order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (serviceId && !service) notFound();
  return (
    <CompanionClient
      pinned={!!serviceId}
      key={service?.id ?? account.id}
      account={account as Parameters<typeof CompanionClient>[0]["account"]}
      initialService={
        service as Parameters<typeof CompanionClient>[0]["initialService"]
      }
    />
  );
}
