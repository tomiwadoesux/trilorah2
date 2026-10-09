import { useEffect, useRef, type VideoHTMLAttributes } from 'react';
import { connectBackgroundAudio, videoSpeed } from '../lib/backgroundPlayback';

type Props = Omit<VideoHTMLAttributes<HTMLVideoElement>, 'muted'> & {
  speed?: number; bass?: number; audible?: boolean;
};

export function BackgroundVideo({ speed, bass = 0, audible = false, ...props }: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.playbackRate = videoSpeed(speed);
  }, [speed, props.src]);
  useEffect(() => {
    const video = ref.current;
    if (!video || !audible) return;
    let disconnect: (() => void) | undefined;
    try { disconnect = connectBackgroundAudio(video, bass); }
    catch { /* The native soundtrack remains available if Web Audio cannot start. */ }
    void video.play().catch(() => undefined);
    return disconnect;
  }, [audible, bass, props.src]);
  return <video {...props} crossOrigin="anonymous" ref={ref} autoPlay loop playsInline muted={!audible} />;
}
