import { useEffect, useRef, useState, type CSSProperties, type SyntheticEvent } from 'react';
import { cx, surface, toneClass, PauseIcon, PlayIcon, ResetIcon, VolumeIcon, VolumeOffIcon } from '../../ui';
import './stageVideo.css';

/*
 * A clip in the preview or the live box, with its transport on the picture:
 * play / pause, a bar to drag through it with the time, and sound.
 *
 * The live box's copy is the operator's view of the projector. The projector
 * window owns the <video> the room sees and hears (src/output.tsx), so every
 * press here is also a media-control message to it. Both start the clip when
 * it goes live and both take every press, so this copy's time, paused state
 * and ending stand for the projector's — the projector does not report back.
 *
 * Sound comes from one place only. With the projector's window open, that
 * window carries it and this copy stays mute: two copies a few milliseconds
 * apart are an echo through the PA. With no projector window — a laptop on
 * its own — this copy is the only one playing, so it carries the sound.
 *
 * The preview's copy is for looking at a clip before it goes up. Its sound
 * starts off, because a laptop at the desk usually feeds the PA too, and
 * nothing in the preview should reach the room by surprise.
 */

/** "2:07", or "1:02:07" past an hour. */
function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** A drag sends the projector a seek this often, not one per pointer move. */
const SEEK_EVERY_MS = 150;

type MediaAction = { type: 'play' | 'pause' | 'restart' | 'seek' | 'mute'; value?: number | boolean };

export function StageVideo({ src, label, onAir = false, projectorOpen = false, sound: soundWanted, onSound, hush }: {
  src: string;
  label: string;
  /** The live box: presses go to the projector as well. */
  onAir?: boolean;
  /** The projector's window is open, so it carries the sound and this copy is mute. */
  projectorOpen?: boolean;
  /** Sound on. Given by the live box, which keeps it from one clip to the next; the preview's own starts off. */
  sound?: boolean;
  onSound?: (on: boolean) => void;
  /** The preview's: the clip now on the wall, if one is. Whenever one goes up the preview goes quiet, so a clip heard here while it was checked is not heard twice. */
  hush?: string;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [previewSound, setPreviewSound] = useState(false);
  const sound = soundWanted ?? previewSound;
  useEffect(() => {
    if (hush) setPreviewSound(false);
  }, [hush]);
  const [paused, setPaused] = useState(false);
  const [ended, setEnded] = useState(false);
  const [time, setTime] = useState(0);
  const [length, setLength] = useState(0);
  const lastSeek = useRef(0);
  const pendingSeek = useRef<number | null>(null);

  const tell = (action: MediaAction) => {
    if (onAir) void window.api?.mediaControl?.(action);
  };

  /* This copy's sound. Set on the element, not left to the attribute, which
     React only applies when the element is first made. */
  const muted = !sound || (onAir && projectorOpen);
  useEffect(() => {
    if (video.current) video.current.muted = muted;
  }, [muted, src]);

  /* The projector keeps its own sound setting, and a window opened after the
     operator turned sound off starts with it on: say it again whenever a clip
     goes up or the window comes. It holds it for the next clip if none is
     showing yet. */
  useEffect(() => {
    if (onAir) void window.api?.mediaControl?.({ type: 'mute', value: !sound });
  }, [onAir, sound, projectorOpen, src]);

  useEffect(() => () => window.clearTimeout(pendingSeek.current ?? undefined), []);

  const read = (e: SyntheticEvent<HTMLVideoElement>) => {
    const v = e.currentTarget;
    setTime(v.currentTime);
    if (Number.isFinite(v.duration)) setLength(v.duration);
    setPaused(v.paused);
    setEnded(v.ended);
  };

  const playOrPause = () => {
    const v = video.current;
    if (!v) return;
    if (v.ended) {
      /* At the end, play means from the start, the way every player does it. */
      v.currentTime = 0;
      void v.play().catch(() => undefined);
      tell({ type: 'restart' });
    } else if (v.paused) {
      void v.play().catch(() => undefined);
      tell({ type: 'play' });
    } else {
      v.pause();
      tell({ type: 'pause' });
    }
  };

  const restart = () => {
    const v = video.current;
    if (!v) return;
    v.currentTime = 0;
    void v.play().catch(() => undefined);
    tell({ type: 'restart' });
  };

  /* While the bar is dragged this copy follows every move; the projector is
     told at most every SEEK_EVERY_MS, and always where the drag let go. */
  const seek = (to: number, final = false) => {
    const v = video.current;
    if (!v) return;
    v.currentTime = to;
    setTime(to);
    if (!onAir) return;
    window.clearTimeout(pendingSeek.current ?? undefined);
    const now = Date.now();
    if (final || now - lastSeek.current >= SEEK_EVERY_MS) {
      lastSeek.current = now;
      tell({ type: 'seek', value: to });
    } else {
      pendingSeek.current = window.setTimeout(() => {
        lastSeek.current = Date.now();
        tell({ type: 'seek', value: v.currentTime });
      }, SEEK_EVERY_MS);
    }
  };

  const toggleSound = () => {
    const next = !sound;
    if (onSound) onSound(next);
    else setPreviewSound(next);
  };

  const played = length ? Math.min(100, (time / length) * 100) : 0;
  const button = cx(surface({ shape: 'control', interactive: true }), toneClass(), 'grid size-7 shrink-0 place-items-center');
  const showPlay = paused || ended;
  const soundTitle = sound
    ? onAir ? (projectorOpen ? 'sound on the projector — turn it off' : 'sound on this computer — turn it off') : 'sound on — only on this computer'
    : onAir ? 'sound off — turn it on' : 'sound off — listen on this computer';

  return (
    <>
      <video
        ref={video}
        key={src}
        src={src}
        aria-label={label}
        autoPlay
        playsInline
        muted={muted}
        className="absolute inset-0 h-full w-full object-contain bg-black"
        onLoadedMetadata={read}
        onDurationChange={read}
        onTimeUpdate={read}
        onPlay={read}
        onPause={read}
        onSeeked={read}
        onEnded={read}
      />
      {/* On the picture, so it never costs the stage a row; its own presses
          stay its own — the picture's drop and step targets sit underneath. */}
      <div
        className="stage-video-bar @container absolute inset-x-0 bottom-0 z-20 flex items-center gap-1.5 px-2 pb-2 pt-7"
        data-on-air={onAir || undefined}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          data-guide={onAir ? 'live-video-pause' : 'preview-video-play'}
          className={button}
          aria-label={showPlay ? `play ${label}` : `pause ${label}`}
          title={showPlay ? (ended ? 'play it again from the start' : 'play') : 'pause'}
          onClick={playOrPause}
        >
          {showPlay ? <PlayIcon size={12} /> : <PauseIcon size={12} />}
        </button>
        {onAir ? (
          <button type="button" data-guide="live-video-restart" className={button} aria-label={`play ${label} again from the start`} title="play it again from the start" onClick={restart}>
            <ResetIcon size={12} />
          </button>
        ) : null}
        <input
          type="range"
          data-guide={onAir ? 'live-video-seek' : 'preview-video-seek'}
          className="stage-video-scrub min-w-0 flex-1"
          aria-label={`where ${label} is`}
          aria-valuetext={`${clock(time)} of ${clock(length)}`}
          min={0}
          max={length || 0}
          step={0.1}
          value={Math.min(time, length || 0)}
          disabled={!length}
          style={{ '--played': `${played}%` } as CSSProperties}
          onChange={(e) => seek(Number(e.currentTarget.value))}
          onPointerUp={(e) => seek(Number(e.currentTarget.value), true)}
          onKeyUp={(e) => seek(Number(e.currentTarget.value), true)}
        />
        <span className="stage-video-time hidden shrink-0 tabular-nums @min-[16rem]:inline">
          {clock(time)} / {clock(length)}
        </span>
        <button
          type="button"
          data-guide={onAir ? 'live-video-sound' : 'preview-video-sound'}
          className={button}
          aria-label={sound ? `turn ${label}'s sound off` : `turn ${label}'s sound on`}
          aria-pressed={sound}
          title={soundTitle}
          onClick={toggleSound}
        >
          {sound ? <VolumeIcon size={13} /> : <VolumeOffIcon size={13} />}
        </button>
      </div>
    </>
  );
}
