import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { buildVerseSlides, type VerseSlide } from '../../../shared/verseDisplay';
import type { LiveItem, ScreenState } from './projector';
import type { Spoken } from './transcript/types';
import { confirmTranscriptCommand, recordTranscriptLine } from '../../lib/transcriptCommands';

/*
 * The one door between this surface and the real engine.
 *
 * S-02 is drawn in a sandbox window, and for a long time everything on it
 * was a specimen. It does not have to be. electron/main.ts builds the
 * sandbox window with the SAME preload as the app (createDesignWindow, and
 * see the byte-identical webPreferences on the app and output windows), the
 * bridge in preload.ts is one unconditional exposeInMainWorld with no
 * per-window gate, and every output-affecting handler in the main process
 * starts `(_event, …)` and broadcasts with getAllWindows(). Nothing checks
 * who is asking. Run the app with SANDBOX=1 and this window is a first-class
 * operator surface with a live engine behind it.
 *
 * Every window.api call on this screen goes through here, for two reasons.
 * One: the surface has to keep working in a plain browser tab and under
 * DESIGN_MODE=1, where there is no bridge and no engine respectively — and
 * that is one `if` in one file rather than an optional-chain at forty call
 * sites. Two: what the engine can actually do differs between those modes,
 * and a control that quietly does nothing is worse than one that says it
 * cannot. `caps` is how a control finds out which it is.
 */

/* Mirrors the app's own ASRStatus. */
export type AsrStatus = 'idle' | 'connecting' | 'listening' | 'error' | 'stopped';

export interface EngineCaps {
  /** window.api exists at all. False in a plain browser tab. */
  bridge: boolean;
  /** The bible database answered. True under DESIGN_MODE=1 as well. */
  db: boolean;
  /** Output windows can be opened and blanked. */
  outputs: boolean;
  /**
   * Whether anything is listening for speech.
   *
   * 'unknown' until the first ASR status or detection arrives, because there
   * is no method that asks. DESIGN_MODE=1 connects the database and skips
   * every service, so db-yes/resolver-no is a real and common combination
   * and the difference matters: under it, "start listening" is a button that
   * cannot work.
   */
  resolver: 'unknown' | 'yes' | 'no';
}

/** What a detection carries in flight — richer than the declared type. */
interface Detection {
  book: string;
  chapter: number;
  verse: number | null;
  endVerse?: number | null;
  confidence?: number;
  version?: string;
  isPreview?: boolean;
  /* Not in api.d.ts but always emitted — main.ts composes both before it
     broadcasts. Optional here because the declared type is the contract and
     this is an observation of the implementation. */
  text?: string;
  verses?: { verse: number; text: string }[];
}

export interface EngineValue {
  caps: EngineCaps;
  asr: AsrStatus;
  /** The engine's own sentence behind `asr` — "Error: add a Deepgram key…",
      "Downloading speech model — 40%". The state says THAT something is
      wrong; this is the only thing that says WHAT, and how to fix it. */
  asrMessage: string;
  /** Last mic level the engine reported, in its own units. */
  level: number;
  /** Newest last, capped. The sermon transcript as it arrives. */
  transcript: string[];
  /**
   * The transcript as sentences: what has been SAID (finished lines, newest
   * last) and what is BEING said (the partial, replaced as it grows).
   */
  spoken: Spoken;
  /** What the real projector says it is doing. */
  screen: ScreenState;

  listen: (on: boolean) => void;
  /** Stage a reference in the ENGINE's preview. Does not reach the room. */
  show: (ref: string) => boolean;
  /** Promote whatever the ENGINE has in preview. Not the local stage. */
  pushEnginePreview: (reference?: string, version?: string) => void;
  /** Load and promote the selected reference in one main-process operation. */
  pushReference: (ref: string, version?: string) => boolean;
  setScreen: (s: ScreenState) => void;
  openProjector: () => void;
  /** Look a reading up in the bible database. Null when there is no db. */
  lookup: (book: string, chapter: number, verse: number, endVerse?: number, version?: string) => Promise<Reading | null>;

  /** Engine proposals the operator has not answered yet, newest first. */
  proposals: Proposal[];
  dismissProposal: (id: string) => void;
  /** Fires when the engine pushes something itself. */
  onEngineLive: (fn: (item: LiveItem) => void) => () => void;
}

export interface Reading {
  reference: string;
  version: string;
  text: string;
  verses: { verse: number; text: string }[];
}

export interface Proposal {
  id: string;
  reference: string;
  version: string;
  text: string;
  /** The engine's confidence, or null when it did not say. */
  trust: number | null;
  slides: VerseSlide[];
  verses: { verse: number; text: string }[];
  /** The database had no such verse. Shown, but never offered to the room. */
  missing: boolean;
}

const EngineContext = createContext<EngineValue | null>(null);

/*
 * How a reading becomes slides.
 *
 * These are the renderer-facing options, and they are deliberately NOT the
 * app's saved projector settings: the sandbox has no business rewriting a
 * church's configuration to draw its own preview. One verse per slide with
 * the reference on it is the arrangement a Bible study wants — the reading
 * is walked verse by verse and every slide has to say where it is, because
 * people arrive late and look up.
 */
export const SLIDE_RULES = {
  breakOnVerse: true,
  showVerseNumbers: false,
  referenceMode: 'each' as const,
  showTranslation: false,
  maxCharsPerSlide: 240,
};

/*
 * How much one slide can hold and still be read from the back row.
 *
 * Counted in words because that is what an operator can judge at a glance —
 * "is this too much?" — and because the projector's type size is a setting,
 * so any pixel answer would be wrong for somebody. Up to FIT_WORDS a reading
 * sits comfortably; up to TIGHT_WORDS it fits but is dense; past that it
 * should be split.
 */
export const FIT_WORDS = 45;
export const TIGHT_WORDS = 70;

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export type Fit = 'fits' | 'tight' | 'too long';
export function fitOf(words: number): Fit {
  return words <= FIT_WORDS ? 'fits' : words <= TIGHT_WORDS ? 'tight' : 'too long';
}

/**
 * "Verse four and five" means show four and five — together, if they fit.
 * A range is kept on one slide until it would stop being readable, and only
 * then walked verse by verse.
 */
export function fitRules(verses: { text: string }[], together?: boolean) {
  const words = wordCount(verses.map((v) => v.text).join(' '));
  const keep = together ?? (verses.length > 1 && words <= TIGHT_WORDS);
  return { ...SLIDE_RULES, breakOnVerse: !keep, showVerseNumbers: keep && verses.length > 1 };
}

/** How many transcript lines to keep. Enough to read back, not a log file. */
const TRANSCRIPT_CAP = 200;
/** Finished sentences kept for the read-along. It shows six; this is slack. */
/** How many unanswered proposals the rail will hold. */
const PROPOSAL_CAP = 4;

function referenceOf(d: Detection): string {
  const verse = d.verse == null ? '' : `:${d.verse}${d.endVerse && d.endVerse !== d.verse ? `-${d.endVerse}` : ''}`;
  return `${d.book} ${d.chapter}${verse}`;
}

export function EngineProvider({ children }: { children: ReactNode }) {
  const api = typeof window === 'undefined' ? undefined : window.api;

  const [caps, setCaps] = useState<EngineCaps>({
    bridge: !!api,
    db: false,
    outputs: !!api && typeof api.setScreenState === 'function',
    resolver: 'unknown',
  });
  const [asr, setAsr] = useState<AsrStatus>('idle');
  const [asrMessage, setAsrMessage] = useState('');
  const [level, setLevel] = useState(0);
  const [transcript, setTranscript] = useState<string[]>([]);
  const [spoken, setSpoken] = useState<Spoken>({
    lines: [],
    partial: '',
  });
  const [screen, setScreenState] = useState<ScreenState>('live');
  const [proposals, setProposals] = useState<Proposal[]>([]);

  /* Subscribers rather than a state value: a push is an event, and a
     component that reacts to one should not also re-render every time
     another one happens. */
  const liveListeners = useRef(new Set<(item: LiveItem) => void>());

  /* Ask the database whether it is there. It answers under DESIGN_MODE=1
     too, which is exactly why db and resolver are separate capabilities. */
  useEffect(() => {
    if (!api?.getDbStatus) return;
    let alive = true;
    void api
      .getDbStatus()
      .then((s) => alive && setCaps((c) => ({ ...c, db: !!s?.connected })))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [api]);

  /* Every subscription in one effect, torn down together. The unsubscribes
     the preload hands back are the only way off these — a stale listener in
     a hot-reloaded sandbox is how one spoken verse arrives four times. */
  useEffect(() => {
    if (!api) return;
    const off: (undefined | (() => void))[] = [];

    off.push(
      api.onAsrStatus?.((s: string) => {
        /* The engine speaks in sentences for the old status pill —
           "Connecting...", "Listening...", "Error: no key", "Downloading
           speech model — 40%". Cast straight to AsrStatus, none of them
           equalled 'connecting' or 'listening', so the button fell back to
           "start listening" while the engine WAS listening and the operator
           pressed it a second time to make it look right. Folded here. */
        const t = s.toLowerCase();
        setAsrMessage(s.replace(/^error:\s*/i, ''));
        setAsr(
          t.startsWith('listening')
            ? 'listening'
            : t.startsWith('error') || t.startsWith('could not')
              ? 'error'
              : t.startsWith('stopped')
                ? 'stopped'
                : 'connecting', // connecting, downloading the model, anything in flight
        );
        /* Any word from the ASR proves something is running behind it. */
        setCaps((c) => (c.resolver === 'yes' ? c : { ...c, resolver: 'yes' }));
      }),
    );

    off.push(api.onAudioLevel?.((n: number) => setLevel(n)));

    off.push(
      api.onTranscriptUpdate?.((text: string) => {
        const line = String(text || '').trim();
        if (!line) return;
        setTranscript((t) => (t.length < TRANSCRIPT_CAP ? [...t, line] : [...t.slice(1), line]));
        setCaps((c) => (c.resolver === 'yes' ? c : { ...c, resolver: 'yes' }));
      }),
    );

    off.push(
      api.onTranscriptLine?.((line) => {
        const text = String(line?.text || '').trim();
        if (!text) return;
        setSpoken((s) => recordTranscriptLine(s, { text, isFinal: line.isFinal }));
      }),
    );

    off.push(api.onVoiceCommand?.((event) => setSpoken((s) => confirmTranscriptCommand(s, event))));

    off.push(api.onScreenState?.((s: string) => setScreenState(s as ScreenState)));

    /*
     * A proposal, not a stage.
     *
     * The engine's preview is a guess about what is being preached. Staging
     * it straight into the preview box would let the engine overwrite a
     * verse the operator picked by hand, mid-sentence, which is the failure
     * that makes an operator turn the whole feature off. It goes to the
     * rail's proposal stack instead, where answering it is a deliberate act.
     */
    off.push(
      api.onVersePreview?.((d: Detection) => {
        setCaps((c) => (c.resolver === 'yes' ? c : { ...c, resolver: 'yes' }));
        const reference = referenceOf(d);

        const verses = d.verses?.length ? d.verses : d.verse != null && d.text ? [{ verse: d.verse, text: d.text }] : [];
        const text = d.text || verses.map((v) => v.text).join(' ');
        if (!text) return;
        const version = d.version || 'KJV';
        /* main.ts writes the literal "Verse N not found" into the text when
           the row is absent. That is a message to the operator, and it must
           never be one press away from the projector. */
        const missing = /\bnot found\b/i.test(text);
        const proposal: Proposal = {
          id: `${reference}@${version}`,
          reference,
          version,
          text,
          /* No invented figure. The trust meter is the product's own promise
             and a made-up number on it is worse than no meter. */
          trust: typeof d.confidence === 'number' ? d.confidence : null,
          slides: buildVerseSlides({ book: d.book, chapter: d.chapter, version }, verses, fitRules(verses)),
          verses,
          missing,
        };
        setProposals((p) => [proposal, ...p.filter((x) => x.id !== proposal.id)].slice(0, PROPOSAL_CAP));
      }),
    );

    /* The engine put something up itself — auto mode, or a push from the
       app window running beside this one. Either way the congregation is
       reading it now and this surface must agree. */
    off.push(
      api.onVerseDetected?.((d: Detection) => {
        setCaps((c) => (c.resolver === 'yes' ? c : { ...c, resolver: 'yes' }));
        const reference = referenceOf(d);
        const verses = d.verses?.length ? d.verses : d.verse != null && d.text ? [{ verse: d.verse, text: d.text }] : [];
        const version = d.version || 'KJV';
        const item: LiveItem = {
          source: 'scripture',
          id: reference,
          label: reference,
          reference,
          version,
          text: d.text || verses.map((v) => v.text).join(' '),
          slides: buildVerseSlides({ book: d.book, chapter: d.chapter, version }, verses, fitRules(verses)),
          verses,
          origin: 'engine',
        };
        setProposals((p) => p.filter((x) => x.id !== `${reference}@${version}`));
        liveListeners.current.forEach((fn) => fn(item));
      }),
    );

    return () => off.forEach((fn) => fn?.());
  }, [api]);

  /*
   * Starting the microphone, and why this does not say "connecting".
   *
   * It did, and it stuck there forever. `emitASRStatus` exists in
   * electron/emitters.ts and the `on-asr-status` channel is wired at both
   * ends, but NOTHING IN THE MAIN PROCESS EVER CALLS IT — the engine never
   * reports its own state. So a control that showed "connecting" and waited
   * to be corrected was waiting for a message that is not coming, and the
   * word sat on the bar through an entire service looking like a failure.
   *
   * The shipping operator screen has always guessed instead, with the same
   * finding written next to it: "Optimistic — corrected by onAsrStatus when
   * the engine exposes it." It does not expose it. So this guesses too, and
   * guesses the useful way round — say the mic is open, and let silence
   * prove otherwise.
   *
   * The proof is real and it is better than a status word: the orb flips to
   * "no mic signal" after eight seconds with no level, which catches a mic
   * that is not actually working. A status message would only have told us
   * what the engine INTENDED. See engineState in ./Live.
   *
   * The device is the one the church picked in Settings. There is no picker
   * on this surface yet, and starting on the laptop mic when a soundboard
   * feed is configured a screen away would be the wrong default to test a
   * service on.
   */
  const listen = useCallback(
    (on: boolean) => {
      if (!api) return;
      if (!on) {
        api.stopListening();
        setAsr('stopped');
        return;
      }
      setAsr('listening');
      void Promise.resolve(api.getSetting?.('micDeviceLabel'))
        .then((label) => api.startListening(typeof label === 'string' && label ? label : undefined))
        .catch(() => api.startListening());
    },
    [api],
  );

  /*
   * Putting a reference on the real projector.
   *
   * There is no "render this verse" channel — verses reach the output only
   * through the engine's own detection path. So the reference is handed to
   * the resolver and the engine broadcasts the result, which is also what
   * the shipping operator screen does. showQueuedVerse is the direct route
   * and sendText the fallback that goes the long way round through the
   * transcript, exactly as src/screens/Live.tsx has it.
   */
  const show = useCallback(
    (ref: string) => {
      if (!api) return false;
      if (api.showQueuedVerse) {
        void api.showQueuedVerse(ref).catch(() => api.sendText(ref));
        return true;
      }
      if (api.sendText) {
        api.sendText(ref);
        return true;
      }
      return false;
    },
    [api],
  );

  const pushEnginePreview = useCallback((reference?: string, version?: string) => api?.pushToLive(reference, version), [api]);

  const pushReference = useCallback(
    (ref: string, version?: string) => {
      if (!api) return false;
      api.pushToLive(ref, version);
      return true;
    },
    [api],
  );

  const setScreen = useCallback(
    (s: ScreenState) => {
      /* Optimistic, then corrected by on-screen-state. Without the local set
         the button does nothing visible until the round trip lands, and a
         blank control that appears not to have worked gets pressed twice. */
      setScreenState(s);
      void api?.setScreenState?.(s)?.catch(() => undefined);
    },
    [api],
  );

  const openProjector = useCallback(() => api?.openOutput('main'), [api]);

  /*
   * Reading text out of the bible database.
   *
   * getChapter's bookId is 0-BASED — the index into BOOKS, which is what the
   * `Book` column holds. This repo has shipped that bug before; the caller
   * passes a name and the index is taken here so there is one place to get
   * it wrong.
   */
  const lookup = useCallback(
    async (book: string, chapter: number, verse: number, endVerse?: number, version?: string): Promise<Reading | null> => {
      if (!api?.getChapter) return null;
      const { BOOKS } = await import('../../lib/books');
      const bookId = BOOKS.findIndex((b) => b.toLowerCase() === book.toLowerCase());
      if (bookId < 0) return null;
      const res = await api.getChapter(bookId, chapter, version).catch(() => null);
      if (!res?.success || !res.data?.length) return null;
      const last = endVerse && endVerse >= verse ? endVerse : verse;
      const picked = res.data.filter((row) => row.id >= verse && row.id <= last);
      if (!picked.length) return null;
      const span = last === verse ? `${verse}` : `${verse}-${last}`;
      return {
        reference: `${book} ${chapter}:${span}`,
        version: picked[0].version || version || 'KJV',
        text: picked.map((r) => r.text).join(' '),
        verses: picked.map((r) => ({ verse: r.id, text: r.text })),
      };
    },
    [api],
  );

  const dismissProposal = useCallback((id: string) => setProposals((p) => p.filter((x) => x.id !== id)), []);

  const onEngineLive = useCallback((fn: (item: LiveItem) => void) => {
    liveListeners.current.add(fn);
    return () => liveListeners.current.delete(fn) as unknown as void;
  }, []);

  const value = useMemo(
    () => ({
      caps,
      asr,
      asrMessage,
      level,
      transcript,
      spoken,
      screen,
      listen,
      show,
      pushEnginePreview,
      pushReference,
      setScreen,
      openProjector,
      lookup,
      proposals,
      dismissProposal,
      onEngineLive,
    }),
    [
      caps,
      asr,
      asrMessage,
      level,
      transcript,
      spoken,
      screen,
      listen,
      show,
      pushEnginePreview,
      pushReference,
      setScreen,
      openProjector,
      lookup,
      proposals,
      dismissProposal,
      onEngineLive,
    ],
  );

  return <EngineContext.Provider value={value}>{children}</EngineContext.Provider>;
}

/*
 * Never throws when the provider is missing.
 *
 * Unlike the projector and the run, this one has a meaningful "not there":
 * a design sheet rendering a single component in isolation has no engine and
 * should not have to mount one to draw a button. The dead value below is
 * what a control sees, and `caps.bridge === false` is the honest thing for
 * it to say.
 */
const DEAD: EngineValue = {
  caps: { bridge: false, db: false, outputs: false, resolver: 'no' },
  asr: 'idle',
  asrMessage: '',
  level: 0,
  transcript: [],
  spoken: { lines: [], partial: '' },
  screen: 'live',
  listen: () => undefined,
  show: () => false,
  pushEnginePreview: () => undefined,
  pushReference: () => false,
  setScreen: () => undefined,
  openProjector: () => undefined,
  lookup: async () => null,
  proposals: [],
  dismissProposal: () => undefined,
  onEngineLive: () => () => undefined,
};

export function useEngine(): EngineValue {
  return useContext(EngineContext) ?? DEAD;
}
