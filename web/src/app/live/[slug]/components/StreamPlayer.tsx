"use client";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Headphones } from "lucide-react";
import { parseStreamUrl } from "@/lib/streamEmbed";

/**
 * The church's own stream, embedded — collapsed until asked for.
 *
 * Two reasons this exists, and the second is the real one. Obviously a viewer
 * at the back or at home may want to hear the service. But when the player is
 * PLAYING, the page can read its clock, and the word highlight stops being an
 * estimate built out of a guessed stream delay and becomes exact. That is worth
 * more than the audio.
 *
 * Nothing renders at all when the service has no stream URL: an empty player
 * frame mid-sermon reads as broken software, and most services will never set
 * one.
 */
export default function StreamPlayer({
  url,
  onSeconds,
  onDrivingChange,
}: {
  url: string | null;
  /** Called with the player's position in seconds, or null when it is not driving. */
  onSeconds: (seconds: number | null) => void;
  onDrivingChange: (driving: boolean) => void;
}) {
  const embed = parseStreamUrl(url);
  const [open, setOpen] = useState(false);

  // Hand the clock back when this unmounts or the stream goes away, or the
  // transcript would keep trusting a frozen player position forever.
  useEffect(() => {
    if (embed) return;
    onSeconds(null);
    onDrivingChange(false);
  }, [embed, onSeconds, onDrivingChange]);

  if (!embed) return null;

  return (
    <div className="px-4 pt-3">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-left hover:bg-white/[0.07] transition-colors"
        >
          <Headphones size={15} className="text-brand shrink-0" />
          <span className="text-xs text-gray-300 flex-1">
            Listen to the live stream
            <span className="block text-[10px] text-gray-600 mt-0.5">
              Playing it syncs the transcript exactly
            </span>
          </span>
        </button>
      ) : (
        <div className="rounded-xl overflow-hidden bg-black border border-white/10">
          {embed.kind === "youtube" ? (
            <YouTubeFrame src={embed.src} onSeconds={onSeconds} onDrivingChange={onDrivingChange} />
          ) : (
            <FacebookFrame src={embed.src} />
          )}
          <button
            onClick={() => {
              setOpen(false);
              onSeconds(null);
              onDrivingChange(false);
            }}
            className="w-full flex items-center justify-center gap-1 py-1.5 text-[10px] uppercase tracking-widest text-gray-600 hover:text-gray-400 transition-colors"
          >
            <ChevronDown size={12} />
            Hide
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * YouTube's iframe API, loaded only if a viewer actually opens the player.
 *
 * Polled rather than event-driven for the position: the API emits state changes
 * but not a tick, and `getCurrentTime` is a synchronous postMessage-backed read.
 * 250ms is far coarser than the highlight needs, but the rAF playhead in
 * usePlayhead interpolates between reads, so the word still lights on a frame.
 */
function YouTubeFrame({
  src,
  onSeconds,
  onDrivingChange,
}: {
  src: string;
  onSeconds: (s: number | null) => void;
  onDrivingChange: (d: boolean) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  const cb = useRef({ onSeconds, onDrivingChange });
  cb.current = { onSeconds, onDrivingChange };

  useEffect(() => {
    let player: any = null;
    let poll: ReturnType<typeof setInterval> | null = null;
    let dead = false;

    const build = () => {
      const YT = (window as any).YT;
      if (dead || !YT?.Player || !hostRef.current) return;
      player = new YT.Player(hostRef.current, {
        events: {
          onStateChange: (e: any) => {
            const playing = e.data === YT.PlayerState.PLAYING;
            cb.current.onDrivingChange(playing);
            if (!playing) cb.current.onSeconds(null);
          },
          onError: () => setFailed(true),
        },
      });
      poll = setInterval(() => {
        if (dead || !player?.getCurrentTime) return;
        try {
          const state = player.getPlayerState?.();
          // 1 === PLAYING. A paused player must not keep driving the highlight.
          if (state !== 1) return;
          const t = player.getCurrentTime();
          if (typeof t === "number" && Number.isFinite(t)) cb.current.onSeconds(t);
        } catch {
          /* The frame can be mid-navigation; the next tick will do. */
        }
      }, 250);
    };

    loadYouTubeApi()
      .then(build)
      .catch(() => setFailed(true));

    return () => {
      dead = true;
      if (poll) clearInterval(poll);
      try {
        player?.destroy?.();
      } catch {
        /* nothing to do about a frame that has already gone */
      }
      cb.current.onSeconds(null);
      cb.current.onDrivingChange(false);
    };
  }, []);

  return (
    <div className="relative aspect-video">
      {/* The API replaces this div with its own iframe, so the src lives here
          only to seed the player when YT.Player adopts an existing iframe. */}
      <iframe
        ref={hostRef as any}
        src={src}
        title="Live stream"
        allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="w-full h-full"
      />
      {failed && (
        <p className="absolute inset-x-0 bottom-0 text-center text-[10px] text-gray-500 bg-black/70 py-1">
          Stream unavailable — the transcript is still running on its own clock.
        </p>
      )}
    </div>
  );
}

/**
 * Facebook's plugin player exposes no readable clock, so this is audio only —
 * the transcript stays on the estimated wall-clock playhead and the viewer's
 * nudge control. Offered anyway because hearing the service is worth something
 * on its own.
 */
function FacebookFrame({ src }: { src: string }) {
  return (
    <iframe
      src={src}
      title="Live stream"
      allow="autoplay; clipboard-write; encrypted-media; picture-in-picture"
      allowFullScreen
      className="w-full aspect-video"
    />
  );
}

/** One loader for the whole page, however many times a viewer opens the player. */
let ytApiPromise: Promise<void> | null = null;
function loadYouTubeApi(): Promise<void> {
  if ((window as any).YT?.Player) return Promise.resolve();
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise<void>((resolve, reject) => {
    const prior = (window as any).onYouTubeIframeAPIReady;
    (window as any).onYouTubeIframeAPIReady = () => {
      prior?.();
      resolve();
    };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    s.async = true;
    s.onerror = () => reject(new Error("youtube iframe api failed to load"));
    document.head.appendChild(s);
  });
  return ytApiPromise;
}
