"use client";
import { useEffect, useMemo, useRef } from "react";

interface Chunk {
  id: string;
  text: string;
  is_final: boolean;
  timestamp: string;
  segment_type: string;
}

interface Verse {
  id: string;
  ref: string;
  pushed_at: string;
}

/**
 * Spotify-lyrics style transcript.
 *
 * Lines flow up. The most recent line is centered and bold; older lines
 * fade into the background. When a verse reference is detected, the line
 * around its push timestamp glows briefly and the verse ref appears as a
 * pill below it.
 *
 * During worship/prayer the transcript is replaced with a contextual
 * placeholder so the page is never silent.
 */
export default function TranscriptStream({
  chunks,
  verses,
  segment,
  isLive,
  publishTranscript,
}: {
  chunks: Chunk[];
  verses: Verse[];
  segment: string;
  isLive: boolean;
  publishTranscript: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new chunks arrive
  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [chunks.length]);

  // Map verses to the chunk closest in time so we can render a pill under it
  const versesByChunkIdx = useMemo(() => {
    const map = new Map<number, Verse>();
    for (const v of verses) {
      const vt = new Date(v.pushed_at).getTime();
      let bestIdx = -1;
      let bestDiff = Infinity;
      chunks.forEach((c, i) => {
        const diff = Math.abs(new Date(c.timestamp).getTime() - vt);
        if (diff < bestDiff) {
          bestDiff = diff;
          bestIdx = i;
        }
      });
      if (bestIdx >= 0 && bestDiff < 8000) map.set(bestIdx, v);
    }
    return map;
  }, [chunks, verses]);

  // Segment-specific placeholders
  if (segment === "worship") {
    return (
      <Placeholder
        emoji="🎵"
        title="Worship in progress"
        subtitle="Live transcript pauses during songs."
      />
    );
  }
  if (segment === "prayer") {
    return (
      <Placeholder
        emoji="🙏"
        title="In prayer"
        subtitle="Take a moment with the room."
      />
    );
  }

  if (!publishTranscript && !isLive) {
    return (
      <Placeholder
        emoji=""
        title="Transcript not archived"
        subtitle="The verses and notes for this service are still available — tap the tabs below."
      />
    );
  }

  if (chunks.length === 0) {
    return (
      <Placeholder
        emoji=""
        title={isLive ? "Listening…" : "No transcript yet"}
        subtitle={isLive ? "The first words will land here in a moment." : ""}
      />
    );
  }

  return (
    <div
      ref={scrollRef}
      className="transcript-scroll h-[calc(100vh-180px)] overflow-y-auto px-5 py-6"
    >
      <div className="space-y-3 pb-32">
        {chunks.map((c, i) => {
          const isLatest = i === chunks.length - 1;
          const verse = versesByChunkIdx.get(i);
          return (
            <div
              key={c.id}
              className={`transition-all duration-500 ${
                isLatest
                  ? "text-white text-lg leading-relaxed font-medium opacity-100"
                  : "text-gray-500 text-sm leading-relaxed opacity-70"
              }`}
            >
              <p>{c.text}</p>
              {verse && (
                <div
                  key={verse.id}
                  className="verse-glow inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full bg-brand/15 border border-brand/40 text-brand text-xs font-semibold"
                >
                  <BookmarkDot />
                  {verse.ref}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Placeholder({
  emoji,
  title,
  subtitle,
}: {
  emoji: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="h-[calc(100vh-180px)] flex flex-col items-center justify-center text-center px-8">
      {emoji && <div className="text-5xl mb-4 opacity-80">{emoji}</div>}
      <p className="text-base font-medium text-gray-300 mb-1">{title}</p>
      {subtitle && <p className="text-sm text-gray-500 max-w-xs">{subtitle}</p>}
    </div>
  );
}

function BookmarkDot() {
  return <span className="w-1.5 h-1.5 rounded-full bg-brand" />;
}
