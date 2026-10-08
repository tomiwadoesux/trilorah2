import { Button, ResetIcon } from '../../ui';
import { EmptyMark } from './emptyArt';
import { BibleBookmarkArt } from './BibleBookmarkArt';

export function ScriptureLibraryEmpty({ status, error, version, onRetry, onReset, onDefaultBible, defaultBible }: {
  status: 'idle' | 'loading' | 'error' | 'no-api' | 'empty';
  error: string | null;
  version: string;
  onRetry: () => void;
  onReset?: () => void;
  /** An online Bible that could not load: read the same chapter in the church's default instead. */
  onDefaultBible?: () => void;
  /** The Bible that button reads in when it is not the default (the default being the Bible that failed). */
  defaultBible?: string;
}) {
  if (status === 'idle' || status === 'loading') {
    return <p role="status" className="px-4 py-6 text-[length:var(--tri-size-xs)] text-white/50">
      {status === 'loading' ? 'loading scripture…' : 'type a reference to find scripture'}
    </p>;
  }
  const unavailable = status === 'no-api';
  return (
    <div className="h-full min-h-0">
      <EmptyMark w={220} h={205} plain art={<BibleBookmarkArt />}
        line={status === 'empty' ? 'no verses in this chapter' : 'scripture couldn’t load'}
        below={<div className="mt-2 flex max-w-[38ch] flex-col items-center gap-2">
          <p role={status === 'empty' ? 'status' : 'alert'} className="text-[length:var(--tri-size-sm)] leading-relaxed text-white/60 break-words">
            {error ?? `No verses were found in ${version} for this chapter. Try loading again or go back to Genesis in the church’s default Bible.`}
          </p>
          {/* Restarting does not bring an online Bible back; the internet does. */}
          {status === 'error' && !onDefaultBible && <p className="text-[length:var(--tri-size-sm)] text-white/40">
            Try again. If this continues, restart Trilorah.
          </p>}
          <Button label={unavailable ? 'reload app' : 'try again'} icon={<ResetIcon size={14} />}
            onClick={unavailable ? () => window.location.reload() : onRetry} />
          {status === 'empty' && onReset && <Button label="open Genesis 1 · default bible" onClick={onReset} />}
          {status === 'error' && onDefaultBible && <Button label={`read it in the ${defaultBible ?? 'default bible'}`} onClick={onDefaultBible} />}
        </div>}
      />
    </div>
  );
}
