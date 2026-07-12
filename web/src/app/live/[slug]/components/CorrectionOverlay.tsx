"use client";
import { useEffect, useState } from "react";

/**
 * 5-second ephemeral correction overlay shown when a new verse is pushed
 * during a service that has audience training enabled.
 *
 * Two taps: "wrong verse" or "no verse". Buttons fade out as the window
 * closes — visual countdown without a timer number.
 */
export default function CorrectionOverlay({
  onWrongVerse,
  onNoVerse,
}: {
  onWrongVerse: () => void;
  onNoVerse: () => void;
}) {
  const [opacity, setOpacity] = useState(1);

  useEffect(() => {
    const start = Date.now();
    const tick = setInterval(() => {
      const elapsed = Date.now() - start;
      const left = Math.max(0, 5000 - elapsed);
      setOpacity(left / 5000);
      if (left <= 0) clearInterval(tick);
    }, 50);
    return () => clearInterval(tick);
  }, []);

  return (
    <div
      style={{ opacity }}
      className="mt-3 flex items-center gap-2 transition-opacity"
    >
      <button
        onClick={onWrongVerse}
        className="flex-1 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-semibold hover:bg-red-500/20 transition-colors"
      >
        Wrong verse
      </button>
      <button
        onClick={onNoVerse}
        className="flex-1 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-gray-300 text-xs font-semibold hover:bg-white/[0.08] transition-colors"
      >
        No verse mentioned
      </button>
    </div>
  );
}
