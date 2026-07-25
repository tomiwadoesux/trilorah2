"use client";

import { SEGMENT_LABELS } from "@/lib/segment-labels";

export default function SegmentBadge({ type }: { type: string }) {
  const meta = SEGMENT_LABELS[type];
  if (!meta) return null;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/10 text-[10px] font-medium text-gray-300">
      <span>{meta.emoji}</span>
      {meta.label}
    </span>
  );
}
