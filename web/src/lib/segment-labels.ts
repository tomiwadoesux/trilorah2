/**
 * Human labels for service segment types.
 * Shared by the live SegmentBadge and the archive transcript view.
 */

export const SEGMENT_LABELS: Record<string, { label: string; emoji: string }> = {
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

/** Label for any segment type, with a graceful fallback for unknown types. */
export function segmentLabel(type: string | null): { label: string; emoji: string } {
  if (type && SEGMENT_LABELS[type]) return SEGMENT_LABELS[type];
  if (!type || type === "unknown") return { label: "Transcript", emoji: "" };
  return {
    label: type.charAt(0).toUpperCase() + type.slice(1).replace(/-/g, " "),
    emoji: "",
  };
}
