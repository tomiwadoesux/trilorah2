"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/browser";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [churchName, setChurchName] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();

    const cleanSlug = (slug || churchName)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { account_name: churchName } },
    });
    if (signUpErr || !signUpData.user) {
      setLoading(false);
      setError(signUpErr?.message ?? "Sign-up failed");
      return;
    }

    // If email confirmation is enabled, signUp returns a user but no session.
    // The account-setup RPC will then refuse (auth.uid() is null without a
    // session). In that case, land the user on /app/dashboard which will
    // detect the missing account and show FinishSetup after they log in.
    if (!signUpData.session) {
      setLoading(false);
      router.push("/app");
      return;
    }

    const { error: rpcErr } = await supabase.rpc("complete_account_setup", {
      p_church_name: churchName,
      p_slug: cleanSlug,
    });
    setLoading(false);
    if (rpcErr) {
      setError(rpcErr.message);
      return;
    }

    router.push("/app/dashboard");
    router.refresh();
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-1">Create church account</h1>
        <p className="text-sm text-gray-500 mb-6">
          One account per campus. Link multiple campuses later via your code.
        </p>
        <form onSubmit={handleSignup} className="space-y-3">
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
          <input
            type="email"
            placeholder="Operator email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-brand/60"
          />
          <input
            type="password"
            placeholder="Password (min 8 chars)"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-brand/60"
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-brand text-white text-sm font-semibold hover:bg-brand-dim transition disabled:opacity-50"
          >
            {loading ? "Creating…" : "Create account"}
          </button>
        </form>
        <p className="text-xs text-gray-500 mt-6 text-center">
          Already have an account?{" "}
          <Link href="/app" className="text-brand hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
