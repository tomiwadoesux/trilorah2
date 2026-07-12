"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

/**
 * Rendered by the dashboard when the authenticated user has no `accounts`
 * row yet — typically because their signup ran before email confirmation,
 * so the post-signUp org + account inserts were blocked by RLS.
 *
 * This finishes the signup in one go now that they have an authenticated
 * session.
 */
export default function FinishSetup({ email }: { email: string }) {
  const [churchName, setChurchName] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const handleFinish = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const supabase = createClient();
    const cleanSlug = (slug || churchName)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    const { error: rpcErr } = await supabase.rpc("complete_account_setup", {
      p_church_name: churchName,
      p_slug: cleanSlug,
    });
    setBusy(false);
    if (rpcErr) {
      setError(rpcErr.message);
      return;
    }
    router.refresh();
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-1">Finish account setup</h1>
        <p className="text-sm text-gray-500 mb-6">
          Signed in as {email}. Complete your church profile below.
        </p>
        <form onSubmit={handleFinish} className="space-y-3">
          <input
            type="text"
            placeholder="Church name"
            required
            value={churchName}
            onChange={(e) => setChurchName(e.target.value)}
            className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-brand/60"
          />
          <input
            type="text"
            placeholder="Public URL slug (e.g. hope-downtown)"
            required
            value={slug}
            onChange={(e) =>
              setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))
            }
            className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-brand/60"
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full py-2.5 rounded-lg bg-brand text-white text-sm font-semibold hover:bg-brand-dim transition disabled:opacity-50"
          >
            {busy ? "Creating…" : "Create church profile"}
          </button>
        </form>
      </div>
    </main>
  );
}
