import { memo, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Panel } from '../parts';
import { useEngine } from '../engine';
import { nextLineId } from '../transcript/words';
import { transcriptBookMentions, transcriptReferences, type TranscriptReference } from '../../../lib/transcriptReferences';
import { BOOKS } from '../../../lib/books';
import { transcriptCommands, transcriptSearchText } from '../../../lib/transcriptCommands';
import { formatReference } from '../../../../shared/verseDisplay';
import type { VoiceCommandEvent } from '../../../../shared/types';
import type { Spoken } from '../transcript/types';
import { Expandable } from './expand';
import { cx, surface, ArrowIcon, BookIcon, Button, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, CloseIcon, PauseIcon, PencilIcon, PlayIcon, PrayerIcon, SearchField } from '../../../ui';
import './preachingTile.css';

const CAPTION_LINE_PX = 24;
const CAPTION_HOLD_MS = 1500;

const verifiedChapters = new WeakMap<object, Map<string, Promise<Set<number> | null>>>();
function verifiedChapter(book: string, chapter: number): Promise<Set<number> | null> {
  const api = window.api;
  if (!api?.getChapter) return Promise.resolve(null);
  let cache = verifiedChapters.get(api);
  if (!cache) { cache = new Map(); verifiedChapters.set(api, cache); }
  const key = `${book}:${chapter}`;
  let request = cache.get(key);
  if (!request) {
    request = api.getChapter(BOOKS.indexOf(book), chapter, 'KJV').then((result) => {
      if (!result.success || !result.data?.length) { cache!.delete(key); return null; }
      return new Set(result.data.filter((row) => row.text.trim()).map((row) => row.id));
    }).catch(() => { cache!.delete(key); return null; });
    cache.set(key, request);
  }
  return request;
}

function markedWords(text: string, offset: number, state: string = 'plain'): ReactNode[] {
  return [...text.matchAll(/\s+|\S+/g)].map((match) => /^\s+$/.test(match[0]) ? match[0] :
    <span key={offset + match.index!} className="transcript-word" data-reference-state={state}>{match[0]}</span>);
}

function ReferencePhrase({ text, offset, reference }: { text: string; offset: number; reference?: TranscriptReference }) {
  const [verified, setVerified] = useState<{ key: string; verses: Set<number> } | null>(null);
  const key = reference?.complete ? `${reference.book}:${reference.chapter}` : '';
  useEffect(() => {
    if (!key || !reference?.chapter || !reference.verse) return;
    let active = true;
    void verifiedChapter(reference.book, reference.chapter).then((verses) => {
      if (!active || !verses) return;
      setVerified({ key, verses });
    });
    return () => { active = false; };
  }, [key]);
  let pill = !!key && verified?.key === key && !!reference?.verse;
  if (pill) {
    const end = reference!.endVerse ?? reference!.verse!;
    for (let v = reference!.verse!; v <= end; v++) {
      if (!verified!.verses.has(v)) { pill = false; break; }
    }
  }
  const label = pill ? formatReference({ book: reference!.book, chapter: reference!.chapter!, version: '' },
    reference!.verse!, reference!.endVerse ?? reference!.verse!, { showTranslation: false }) : text;
  return <span className={cx('transcript-reference', pill && surface({ tone: 'caution', stroke: 'none' }))} data-pill={pill || undefined} title={pill ? text : undefined}>
    <span className="transcript-reference__icon" aria-hidden><BookIcon size={14} /></span>
    <span className="transcript-reference__words">{markedWords(label, offset, reference?.state)}</span>
  </span>;
}

const COMMAND_ICONS = { book: BookIcon, next: ChevronRightIcon, previous: ChevronLeftIcon,
  pen: PencilIcon, close: CloseIcon, pause: PauseIcon, prayer: PrayerIcon, play: PlayIcon };

export const Marked = memo(function Marked({ text, dim, partial = false, commands }: { text: string; dim?: boolean; partial?: boolean; commands?: VoiceCommandEvent[] }) {
  const ranges = transcriptReferences(text, partial);
  const out: ReactNode[] = [];
  let at = 0;
  // A book's wrapper exists from its first mention, even for an ordinary
  // name. Confirmation forms the pill around the same text and icon slot.
  const mentions = transcriptBookMentions(text).map((mention) => ({ ...mention, command: null }));
  const actions = transcriptCommands(text, commands).map((command) => ({ start: command.start, end: command.end, command }));
  for (const segment of [...mentions, ...actions].sort((a, b) => a.start - b.start || Number(!!b.command) - Number(!!a.command) || b.end - a.end)) {
    if (segment.start < at) continue;
    if (segment.start > at) out.push(...markedWords(text.slice(at, segment.start), at));
    const reference = segment.command ? undefined : ranges.find((range) => range.start === segment.start);
    const end = reference?.end ?? segment.end;
    if (segment.command) {
      const { event, label, icon } = segment.command;
      const Icon = COMMAND_ICONS[icon];
      out.push(<span key={`command:${segment.start}`} className={cx(surface({ tone: 'caution', stroke: 'none' }), 'transcript-command')} data-command={event.kind} data-icon={icon}
        title={text.slice(segment.start, end)}>
        <span className="transcript-command__icon" aria-hidden><Icon size={14} /></span>
        <span className="transcript-command__label">{label}</span>
      </span>);
    } else {
      out.push(<ReferencePhrase key={`book:${segment.start}`} text={text.slice(segment.start, end)} offset={segment.start} reference={reference} />);
    }
    at = end;
  }
  if (at < text.length) out.push(...markedWords(text.slice(at), at));
  return <span className="transcript-marked" data-dim={dim || undefined}>{out}</span>;
});

export function PreachingTile({ className }: { className?: string }) {
  const { spoken, asr } = useEngine();
  return (
    <Expandable className={className} title="Preacher transcript" glyph={false}
      blurb="The whole service, in order. Scroll back to any moment."
      bodyClassName="transcript-dialog-body"
      size={{ w: 820, h: 720 }}
      tile={({ onOpen }) => <TranscriptFace spoken={spoken} asr={asr} className="min-h-0 w-full flex-1" onOpen={onOpen} />}>
      <FullTranscript />
    </Expandable>
  );
}

/** Final sentences stay in normal text flow. Only the fixed live-caption area
 * changes when ASR revises its hypothesis; no word remounts, blur or roll animations. */
export function TranscriptFace({ spoken, asr, className, onOpen, rail = false }: {
  spoken: Spoken; asr: string; className?: string; onOpen: () => void;
  /** Drawn inside the operator rail's catches card: no card of its own, no
   *  footer, and the rail's margins rather than the dashboard tile's. */
  rail?: boolean;
}) {
  const history = useRef<HTMLDivElement>(null);
  const followHistory = useRef(true);
  const caption = useRef<HTMLDivElement>(null);
  // Start near live speech when opening the dashboard. After that, completed
  // utterances stay in the caption until the reader has scrolled past them.
  const [retiredThrough, setRetiredThrough] = useState(() => spoken.lines.at(-2)?.id ?? -1);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const afterRetire = useRef<number | null>(null);
  const settled = spoken.lines.filter((line) => line.id <= retiredThrough);
  const captionLines = spoken.lines.filter((line) => line.id > retiredThrough);
  if (spoken.partial) captionLines.push({ id: nextLineId(spoken), text: spoken.partial, commands: spoken.partialCommands });
  const listening = asr === 'listening';
  useLayoutEffect(() => {
    const el = history.current;
    if (el && followHistory.current) el.scrollTop = el.scrollHeight;
  }, [settled.length]);
  useEffect(() => {
    const el = history.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      if (followHistory.current) el.scrollTop = el.scrollHeight;
    });
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => observer.disconnect();
  }, [settled.length > 0]);
  useLayoutEffect(() => {
    const el = caption.current;
    if (!el) return;
    // Removing a sentence above the viewport must not move the words in view.
    if (afterRetire.current !== null) {
      el.scrollTop = afterRetire.current;
      afterRetire.current = null;
    }
    const step = () => {
      timer.current = null;
      const box = caption.current;
      if (!box) return;
      const overflow = box.scrollHeight - box.clientHeight;
      if (overflow <= box.scrollTop + 1) return;
      box.scrollTop = Math.min(overflow, box.scrollTop + CAPTION_LINE_PX);
      const paragraphs = [...box.querySelectorAll<HTMLElement>('[data-caption-id]')];
      let lastRetired: number | null = null;
      let removedHeight = 0;
      // Keep the newest utterance, even after it becomes final. Move older
      // sentences into history only once they have actually left the box.
      for (let i = 0; i < paragraphs.length - 1; i++) {
        const nextTop = paragraphs[i + 1].offsetTop;
        if (nextTop > box.scrollTop) break;
        lastRetired = Number(paragraphs[i].dataset.captionId);
        removedHeight = nextTop;
      }
      if (lastRetired !== null) {
        afterRetire.current = box.scrollTop - removedHeight;
        setRetiredThrough(lastRetired);
      }
      if (overflow > box.scrollTop + 1) timer.current = setTimeout(step, CAPTION_HOLD_MS);
    };
    // New words update immediately. Scrolling has its own pace, so rapid ASR
    // revisions cannot repeatedly restart it or shove several lines away.
    if (el.scrollHeight > el.clientHeight + el.scrollTop + 1 && timer.current === null) {
      timer.current = setTimeout(step, CAPTION_HOLD_MS);
    }
  }, [spoken.lines, spoken.partial, retiredThrough]);
  useEffect(() => () => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  }, []);
  return (
    <Panel bare={rail} className={cx('preaching-card', !spoken.lines.length && !spoken.partial && 'preaching-card--empty', rail && 'preaching-card--rail', className)} bodyStyle={{ padding: 0 }}>
      <div className="preaching-card__content" onWheel={(e) => {
        const el = history.current;
        if (!el || el.contains(e.target as Node)) return;
        if (e.deltaY < 0) followHistory.current = false;
        el.scrollTop += e.deltaY;
      }}>
        <button type="button" className="preaching-card__header" onClick={onOpen} aria-label="Open the whole preacher transcript">
          <div className="min-w-0">
            <h3 className="preaching-card__title">Preacher transcript</h3>
          </div>
          <ArrowIcon size={14} />
        </button>
        <div className="preaching-card__history">
          {settled.length > 0 ?
            <div ref={history} className="preaching-card__history-scroll" style={{ overflowAnchor: 'none' }}
              tabIndex={0} role="region" aria-label="Earlier speech" onScroll={(e) => {
                const el = e.currentTarget;
                followHistory.current = el.scrollHeight - el.clientHeight - el.scrollTop < 24;
              }} onWheel={(e) => { if (e.deltaY < 0) followHistory.current = false; }}>
              <div className="preaching-card__sentences">
                {settled.map((line) => (
                  <p key={line.id}><Marked text={line.text} commands={line.commands} dim /></p>
                ))}
              </div>
            </div>
          : <div className="preaching-card__empty"><p>{captionLines.length ? '' : listening ? 'Listening for the preacher…' : 'Start listening to see the transcript.'}</p></div>}
        </div>
        <div className="preaching-card__live">
          <div ref={caption} className="preaching-card__caption" style={{ overflowAnchor: 'none' }}>
            <div className="relative flex flex-col">
              {captionLines.map((line) => (
                <p key={line.id} data-caption-id={line.id} className="break-words text-[var(--tri-ink)]"><Marked text={line.text} commands={line.commands} partial={!!spoken.partial && line.id === nextLineId(spoken)} /></p>
              ))}
              {!captionLines.length && <p className="preaching-card__placeholder">{listening ? 'Waiting for speech…' : 'No speech yet.'}</p>}
            </div>
          </div>
        </div>
        {!rail && <button type="button" className="preaching-card__footer" onClick={onOpen}>open transcript<ArrowIcon size={14} /></button>}
      </div>
    </Panel>
  );
}
function FullTranscript() {
  const { spoken, asr } = useEngine();
  return <FullTranscriptView spoken={spoken} asr={asr} />;
}

export function FullTranscriptView({ spoken, asr }: { spoken: Spoken; asr: string }) {
  const [query, setQuery] = useState('');
  const [following, setFollowing] = useState(true);
  const follow = useRef(true);
  const lines = spoken.partial
    ? [...spoken.lines, { id: nextLineId(spoken), text: spoken.partial, commands: spoken.partialCommands }]
    : spoken.lines;
  const visible = query.trim() ? lines.filter((line) => transcriptSearchText(line.text, line.commands).includes(query.trim().toLowerCase())) : lines;
  const box = useRef<HTMLDivElement>(null);
  const tail = lines[lines.length - 1]?.text ?? '';
  useLayoutEffect(() => {
    const el = box.current;
    if (el && follow.current && !query) el.scrollTop = el.scrollHeight;
  }, [lines.length, tail, following, query]);
  useLayoutEffect(() => { if (query && box.current) box.current.scrollTop = 0; }, [query]);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      if (follow.current) el.scrollTop = el.scrollHeight;
    });
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => observer.disconnect();
  }, []);
  const latest = () => {
    follow.current = true;
    setQuery('');
    setFollowing(true);
    if (box.current) box.current.scrollTop = box.current.scrollHeight;
  };
  return (
    <div className="transcript-reader">
      <div className="transcript-reader__toolbar">
        <label className="transcript-reader__search"><span className="sr-only">Find in transcript</span>
          <SearchField value={query} onChange={(value) => { follow.current = false; setFollowing(false); setQuery(value); }} placeholder="find a word or reference…" />
        </label>
        <Button label={following && !query ? 'following live' : 'latest words'} icon={<ChevronDownIcon size={12} />} onClick={latest} tone="ash" />
      </div>
      <div ref={box} className="transcript-reader__scroll" tabIndex={0} role="region" aria-label="Full service transcript"
        style={{ overflowAnchor: 'none' }} onWheel={(e) => { if (e.deltaY < 0) { follow.current = false; setFollowing(false); } }}
        onScroll={(e) => {
          const el = e.currentTarget;
          const atEnd = !query && el.scrollHeight - el.clientHeight - el.scrollTop < 24;
          follow.current = atEnd;
          setFollowing(atEnd);
        }}>
        <div className="transcript-reader__entries">
          {visible.map((line) => {
            const partial = !!spoken.partial && line.id === nextLineId(spoken);
            return <article key={line.id} className="transcript-reader__entry" data-partial={partial || undefined}>
              <span className="transcript-reader__number" aria-hidden>{partial ? 'now' : String(line.id + 1).padStart(3, '0')}</span>
              <p><Marked text={line.text} commands={line.commands} partial={partial} /></p>
            </article>;
          })}
          {!visible.length && <p className="transcript-reader__empty">{query ? 'No words match this search.' : asr === 'listening' ? 'Listening for the first words…' : 'Start listening to record this service.'}</p>}
        </div>
      </div>
      <footer className="transcript-reader__footer">
        <span>{query ? `${visible.length} matching ${visible.length === 1 ? 'entry' : 'entries'}` : `${spoken.lines.length} recorded ${spoken.lines.length === 1 ? 'entry' : 'entries'}`}</span>
        <span>{query ? 'searching this service' : following ? 'at the latest words' : 'reading earlier speech'}</span>
      </footer>
    </div>
  );
}
