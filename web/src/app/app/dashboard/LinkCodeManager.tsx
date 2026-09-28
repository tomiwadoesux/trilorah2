"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { Copy, Link as LinkIcon, Plus, ChevronDown } from "@/components/icons";

/**
 * Multi-campus link code manager.
 *
 * Collapsed by default because most churches are single-campus and don't
 * need this. Keep it quietly available: one disclosure click expands the
 * generate + redeem flow.
 */
export default function LinkCodeManager({ isOrgAdmin }: { isOrgAdmin: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [redeemCode, setRedeemCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const generate = async () => {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { data, error: e } = await supabase.rpc("generate_link_code");
    setBusy(false);
    if (e) {
      setError(e.message);
      return;
    }
    setGeneratedCode(data as string);
  };

  const redeem = async () => {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: e } = await supabase.rpc("redeem_link_code", { p_code: redeemCode });
    setBusy(false);
    if (e) {
      setError(e.message);
      return;
    }
    setRedeemCode("");
    router.refresh();
  };

  return (
    <div>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between group"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2">
          <LinkIcon size={11} className="text-gray-500" />
          <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 group-hover:text-white transition-colors">
            Multi-campus link
          </span>
          <span className="text-[10px] text-gray-600">Optional</span>
        </div>
        <ChevronDown
          size={12}
          className={`text-gray-500 transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {expanded && (
        <div className="mt-4 space-y-4">
          <p className="text-[11px] text-gray-500 leading-relaxed">
            Only needed if this church has multiple campuses. Skip this section
            otherwise — everything works fine with a single account.
          </p>

          {isOrgAdmin && (
            <div>
              <button
                onClick={generate}
                disabled={busy}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-brand/10 border border-brand/30 text-[11px] font-semibold uppercase tracking-wider text-brand hover:bg-brand/20 transition-colors disabled:opacity-50"
              >
                <Plus size={11} />
                Generate link code
              </button>
              {generatedCode && (
                <div className="mt-3 flex items-center gap-2 rounded-md bg-brand/10 border border-brand/30 px-3 py-2">
                  <code className="text-sm font-mono text-brand tracking-wider flex-1">
                    {generatedCode}
                  </code>
                  <button
                    onClick={() => navigator.clipboard?.writeText(generatedCode)}
                    className="text-brand/70 hover:text-brand transition-colors"
                    title="Copy"
                  >
                    <Copy size={12} />
                  </button>
                </div>
              )}
              <p className="text-[10px] text-gray-600 mt-2 leading-relaxed">
                Share the code with another campus&apos; operator. They redeem it
                from their dashboard. Expires in 24 hours.
              </p>
            </div>
          )}

          <div className="pt-4 border-t border-white/5">
            <label className="text-[10px] uppercase tracking-widest text-gray-500 mb-1.5 flex items-center gap-1.5">
              <LinkIcon size={10} />
              Redeem a code from another campus
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="TRL-XXXX"
                value={redeemCode}
                onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
                className="flex-1 bg-white/[0.03] border border-white/10 rounded-md px-2 py-1.5 text-xs font-mono tracking-wider focus:outline-none focus:border-brand/60"
              />
              <button
                onClick={redeem}
                disabled={busy || !redeemCode}
                className="px-3 py-1.5 rounded-md bg-white/[0.06] border border-white/10 text-[11px] font-semibold uppercase tracking-wider hover:border-brand/40 hover:text-brand transition-colors disabled:opacity-40"
              >
                Redeem
              </button>
            </div>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
      )}
    </div>
  );
}
