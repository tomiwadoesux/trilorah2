"use client";

import { SEGMENT_LABELS } from "@/lib/segment-labels";

export default function SegmentBadge({ type }: { type: string }) {
  const meta = SEGMENT_LABELS[type];
  if (!meta) return null;
  return <span className="companion-tag">{meta.label.toLowerCase()}</span>;
}
