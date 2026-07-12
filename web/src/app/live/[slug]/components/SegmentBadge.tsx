"use client";

const LABELS: Record<string, { label: string; emoji: string }> = {
  worship: { label: "Worship", emoji: "🎵" },
  prayer: { label: "Prayer", emoji: "🙏" },
  sermon: { label: "Sermon", emoji: "📖" },
  announcements: { label: "Announcements", emoji: "📢" },
  offering: { label: "Offering", emoji: "🎁" },
  "altar-call": { label: "Altar call", emoji: "✋" },
  closing: { label: "Closing", emoji: "🕊️" },
  communion: { label: "Communion", emoji: "🍞" },
  baptism: { label: "Baptism", emoji: "💧" },
  testimony: { label: "Testimony", emoji: "🎤" },
};

export default function SegmentBadge({ type }: { type: string }) {
  const meta = LABELS[type];
  if (!meta) return null;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/10 text-[10px] font-medium text-gray-300">
      <span>{meta.emoji}</span>
      {meta.label}
    </span>
  );
}
