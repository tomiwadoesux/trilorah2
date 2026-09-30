"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import CorrectionOverlay from "./CorrectionOverlay";

interface Verse {
  id: string;
  ref: string;
  pushed_at: string;
}

const OVERLAY_WINDOW_MS = 5000;

export default function VersesTab({
  verses,
  audienceTrainingEnabled,
  fingerprint,
  serviceId,
}: {
  verses: Verse[];
  audienceTrainingEnabled: boolean;
  fingerprint: string;
  serviceId: string;
}) {
  // Polling clock — derive the overlay from verse age instead of imperatively
  // setting state in an effect on each new verse arrival.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const newest = verses[0];
  const ageMs = newest ? now - new Date(newest.pushed_at).getTime() : Infinity;
  const activeOverlay =
    audienceTrainingEnabled && newest && ageMs < OVERLAY_WINDOW_MS && !dismissed.has(newest.id)
      ? newest.id
      : null;

  const supabase = createClient();
  const submitCorrection = async (
    verseId: string,
    type: "wrong-verse" | "no-verse",
  ) => {
    setDismissed((prev) => new Set(prev).add(verseId));
    await supabase.from("correction_taps").insert({
      service_id: serviceId,
      detected_verse_id: verseId,
      type,
      audience_fingerprint: fingerprint,
    });
  };

  if (verses.length === 0) {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center text-gray-500 text-sm">
        Verses will appear here as the pastor references them.
      </div>
    );
  }

  return (
    <div className="px-5 py-3 space-y-2 pb-8 overflow-y-auto flex-1 min-h-0">
      {verses.map((v) => (
        <div
          key={v.id}
          className="rounded-xl bg-white/[0.03] border border-white/10 px-4 py-3 relative"
        >
          <div className="flex items-baseline justify-between">
            <p className="text-base font-semibold text-white">{v.ref}</p>
            <time className="text-[10px] text-gray-500 tabular-nums">
              {formatTimeAgo(v.pushed_at)}
            </time>
          </div>
          {audienceTrainingEnabled && activeOverlay === v.id && (
            <CorrectionOverlay
              onWrongVerse={() => submitCorrection(v.id, "wrong-verse")}
              onNoVerse={() => submitCorrection(v.id, "no-verse")}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  return `${h}h ago`;
}
