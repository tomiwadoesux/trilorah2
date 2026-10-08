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
import { SLIDE_RULES, fitRules } from '../../lib/slideRules';
import { isScreenState, type LiveItem, type ScreenState } from './projector';
import type { Spoken } from './transcript/types';
import { confirmTranscriptCommand, recordTranscriptLine } from '../../lib/transcriptCommands';
import type { ScriptureRecognition } from '../../../shared/types';
import { removeWithdrawnProposals } from '../../lib/recognitionWithdrawal';
import { CatchClocks, type CatchClock } from '../../lib/catchClock';
import { usePracticeStore } from '../../stores/practiceStore';
import { PRACTICE_SERMON_DEVICE } from '../../../shared/practiceSermon';
import { catchKind, groupFor, type CatchKind, type SetTail } from '../../lib/catchSets';

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
  recognition?: ScriptureRecognition;
  /* Not in api.d.ts but always emitted — main.ts composes both before it
     broadcasts. Optional here because the declared type is the contract and
     this is an observation of the implementation. */
  text?: string;
  verses?: { verse: number; text: string }[];
  /** The operator's own push on its way through the engine's preview. */
  operatorPush?: boolean;
  /** A catch shown first in the bundled fallback, now in the online Bible
      it was heard in: the version its card is showing (main.ts). */
  replaces?: string;
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
  /** Most recently called scripture, retained when its proposal is cleared. */
  latestReference: string | null;
  dismissProposal: (id: string) => void;
  /**
   * Each waiting proposal's clock — it stays CATCH_LIFE_MS and then leaves.
   * Keyed by proposal id; a proposal with no clock has none running.
   */
  proposalClocks: Record<string, CatchClock>;
  /** Proposals whose time ran out and that are on their way off the screen. */
  leavingProposals: readonly string[];
  /**
   * Hold (true) or let go of (false) a proposal's clock for one reason —
   * 'pointer' while the operator's hand is on it, 'queued' while it waits its
   * turn in a set. It runs only when nothing holds it.
   */
  holdProposal: (id: string, held: boolean, reason?: string) => void;
  /** Put one of the engine's close alternatives in a proposal's place. */
  swapProposal: (id: string, reading: Reading) => void;
  /** Fires when a proposal's time runs out, just before it is removed. */
  onProposalExpired: (fn: (id: string) => void) => () => void;
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
  recognition?: ScriptureRecognition;
  /** How it was caught: said, read out, a named passage, or a story. */
  kind: CatchKind;
  /** Verses named one straight after another share a set (lib/catchSets). */
  group: string;
  arrivedAt: number;
  /** The last words heard as it arrived — why it was caught. */
  heard?: string;
  /**
   * The engine's close runners-up for what was heard, best first ("thirteen"
   * against "thirty"). Only those within ALTERNATE_MARGIN of the best.
   */
  alternates?: string[];
}

const EngineContext = createContext<EngineValue | null>(null);

/* How a reading becomes slides — lib/slideRules, so a plain module can
   slice a reading the same way without importing this provider. */
export { SLIDE_RULES, fitRules };

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

/** How many transcript lines to keep. Enough to read back, not a log file. */
const TRANSCRIPT_CAP = 200;
/** Finished sentences kept for the read-along. It shows six; this is slack. */
/** How many unanswered proposals are held. Each leaves after six seconds, so
    this only bites when a preacher names a long list in one breath. */
const PROPOSAL_CAP = 8;
/** How close, in the engine's 0–100 points, a runner-up must be to be offered. */
const ALTERNATE_MARGIN = 15;

interface Candidate {
  book: string;
  chapter: number;
  verse: number;
  endVerse?: number;
  score: number;
  source: string;
}

const candidateReference = (c: Candidate) =>
  `${c.book} ${c.chapter}:${c.verse}${c.endVerse && c.endVerse !== c.verse ? `-${c.endVerse}` : ''}`;

/** The last few words of what is being heard, for a catch's "why". */
function lastWords(spoken: Spoken, count = 12): string {
  const text = spoken.partial.trim() || spoken.lines[spoken.lines.length - 1]?.text || '';
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.length > count ? `…${words.slice(-count).join(' ')}` : words.join(' ');
}
/** How long a proposal whose time ran out takes to fade before it is removed. */
const PROPOSAL_LEAVE_MS = 240;

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
  /* The latest words, readable from the event handlers below without
     resubscribing them every time a word arrives. */
  const spokenRef = useRef(spoken);
  spokenRef.current = spoken;
  /* The set the last plain reference joined, for the next one to join. */
  const setTail = useRef<SetTail | null>(null);
  const setCount = useRef(0);
  const lastArrival = useRef(0);
  const [screen, setScreenState] = useState<ScreenState>('live');
  const [latestReference, setLatestReference] = useState<string | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  /*
   * Every change to the list goes through updateProposals, which keeps this
   * copy current as of the change itself rather than as of the last render.
   * The clocks are tidied against it in the same step: tidying them in an
   * effect after the render used a list one arrival behind, and when three
   * verses came in one breath it threw away the clocks of the two newest
   * cards, which then never left.
   */
  const proposalsNow = useRef<Proposal[]>([]);
  const clocksRef = useRef<CatchClocks | null>(null);
  const updateProposals = useCallback((change: (list: Proposal[]) => Proposal[]) => {
    const next = change(proposalsNow.current);
    if (next === proposalsNow.current) return;
    proposalsNow.current = next;
    setProposals(next);
    /* A proposal that left any way but its clock — answered, dismissed,
       withdrawn, pushed by the engine, crowded past the cap — takes its
       clock with it. */
    clocksRef.current?.keepOnly(next.map((p) => p.id));
  }, []);

  /* Subscribers rather than a state value: a push is an event, and a
     component that reacts to one should not also re-render every time
     another one happens. */
  const liveListeners = useRef(new Set<(item: LiveItem) => void>());
  const expiryListeners = useRef(new Set<(id: string) => void>());

  /*
   * Every proposal stays CATCH_LIFE_MS and then leaves (see catchClock).
   * When its time is up it is marked leaving — the card fades — and taken
   * off the list a moment later. A proposal heard again in that moment is
   * a new arrival: its removal is called off and its clock starts afresh.
   */
  const [proposalClocks, setProposalClocks] = useState<Record<string, CatchClock>>({});
  const [leavingProposals, setLeavingProposals] = useState<string[]>([]);
  const leaveTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  if (!clocksRef.current) {
    clocksRef.current = new CatchClocks((id) => {
      expiryListeners.current.forEach((fn) => fn(id));
      setLeavingProposals((l) => (l.includes(id) ? l : [...l, id]));
      leaveTimers.current.set(id, setTimeout(() => {
        leaveTimers.current.delete(id);
        updateProposals((p) => p.filter((x) => x.id !== id));
        setLeavingProposals((l) => l.filter((x) => x !== id));
      }, PROPOSAL_LEAVE_MS));
    }, setProposalClocks);
  }
  const startProposalClock = useCallback((id: string) => {
    const pending = leaveTimers.current.get(id);
    if (pending) {
      clearTimeout(pending);
      leaveTimers.current.delete(id);
      setLeavingProposals((l) => l.filter((x) => x !== id));
    }
    clocksRef.current?.start(id);
  }, []);
  useEffect(() => {
    const timers = leaveTimers.current;
    return () => {
      clocksRef.current?.dispose();
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, []);

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

    /* Asked once as well as followed. After a reload this started at 'live'
       over a held black, and the operator's status read from it. A change
       heard before the answer lands is newer, so it wins. */
    let screenHeard = false;
    off.push(api.onScreenState?.((s: string) => { screenHeard = true; setScreenState(s as ScreenState); }));
    void api.getScreenState?.()
      .then((s) => { if (!screenHeard && isScreenState(s)) setScreenState(s); })
      .catch(() => undefined);

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
        /* A push the operator made — a step, a go live, a catch sent — goes
           through the engine's preview on its way to the wall. It was not
           heard, so it is not a catch: as one it flashed in the caught pane,
           raised the strip on the other tabs and joined a set. */
        if (d.operatorPush) return;
        const reference = referenceOf(d);
        setLatestReference(reference);

        const verses = d.verses?.length ? d.verses : d.verse != null && d.text ? [{ verse: d.verse, text: d.text }] : [];
        const text = d.text || verses.map((v) => v.text).join(' ');
        if (!text) return;
        const version = d.version || 'KJV';
        /* main.ts writes the literal "Verse N not found" into the text when
           the row is absent. That is a message to the operator, and it must
           never be one press away from the projector. */
        const missing = /\bnot found\b/i.test(text);
        const kind = catchKind(d.recognition);
        /* The same catch arriving in its online Bible (main re-reads it once
           the chapter is here): its card turns into it — same place, same
           clock running — rather than a second card with a fresh one. Gone
           already (sent, dismissed, timed out): nothing is put back. */
        const replaced = d.replaces ? proposalsNow.current.find((x) => x.reference === reference && x.version === d.replaces) : undefined;
        if (d.replaces && !replaced) return;
        /* Heard again while it waits: same place in its set, fresh clock
           (startProposalClock below). Without this, a reference repeated in
           the sentence's final moved to the end of its set. */
        const again = replaced ?? proposalsNow.current.find((x) => x.reference === reference && x.version === version && x.kind === kind);
        /* Strictly increasing, so references that land in the same instant
           — the end of one spoken list — keep the order they were said. */
        const arrivedAt = again?.arrivedAt ?? Math.max(Date.now(), lastArrival.current + 1);
        if (!again) lastArrival.current = arrivedAt;
        const tail = setTail.current;
        const group = again?.group ?? groupFor(kind, arrivedAt, tail, !!tail && proposalsNow.current.some((p) => p.group === tail.group),
          `set-${++setCount.current}`);
        if (kind === 'said' && !again) setTail.current = { group, at: arrivedAt };
        const proposal: Proposal = {
          id: replaced?.id ?? `${d.recognition?.suggestionId ?? reference}@${version}`,
          reference,
          version,
          text,
          /* No invented figure. The trust meter is the product's own promise
             and a made-up number on it is worse than no meter. */
          // Word alignment and story ranking are evidence, not measured accuracy.
          trust: !d.recognition && typeof d.confidence === 'number' ? d.confidence : null,
          recognition: d.recognition,
          slides: buildVerseSlides({ book: d.book, chapter: d.chapter, version }, verses, fitRules(verses)),
          verses,
          missing,
          kind,
          group,
          arrivedAt,
          // A card turned into its online text still says what was heard then.
          heard: replaced ? replaced.heard : lastWords(spokenRef.current) || undefined,
        };
        if (replaced) {
          updateProposals((p) => p.map((x) => (x.id === replaced.id ? proposal : x)));
          return;
        }
        updateProposals((p) => [proposal, ...p.filter((x) => x.id !== proposal.id &&
          !(x.reference === proposal.reference && x.version === proposal.version))].slice(0, PROPOSAL_CAP));
        /* Its six seconds start now — or start again, if it was already up. */
        startProposalClock(proposal.id);
      }),
    );

    off.push(api.onRecognitionWithdrawn?.(({ suggestionId }) => {
      updateProposals(proposals => removeWithdrawnProposals(proposals, suggestionId));
    }));

    /*
     * The engine weighs the likely mishearings of every reference it hears
     * ("John" or "Jonah", "thirteen" or "thirty") and says so right after the
     * preview. Runners-up close to the best are offered on the card as "or".
     */
    off.push(api.onEngineEvent?.('on-candidates', (payload) => {
      const list = ((payload as { candidates?: Candidate[] } | null)?.candidates ?? []).filter((c) => c && c.book);
      const primary = list.find((c) => c.source === 'primary');
      if (!primary) return;
      const top = Math.max(...list.map((c) => c.score));
      const near = list
        .filter((c) => c !== primary && c.score >= top - ALTERNATE_MARGIN)
        .sort((a, b) => b.score - a.score)
        .map(candidateReference)
        .filter((ref, i, all) => all.indexOf(ref) === i && ref !== candidateReference(primary))
        .slice(0, 3);
      if (!near.length) return;
      const said = `${primary.book} ${primary.chapter}:${primary.verse}`;
      updateProposals((p) => {
        const i = p.findIndex((x) => x.reference === said || x.reference.startsWith(`${said}-`));
        return i < 0 ? p : p.map((x, n) => (n === i ? { ...x, alternates: near } : x));
      });
    }));

    /* The engine put something up itself — auto mode, or a push from the
       app window running beside this one. Either way the congregation is
       reading it now and this surface must agree. */
    off.push(
      api.onVerseDetected?.((d: Detection) => {
        setCaps((c) => (c.resolver === 'yes' ? c : { ...c, resolver: 'yes' }));
        const reference = referenceOf(d);
        setLatestReference(reference);
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
        updateProposals((p) => p.filter((x) => !(x.reference === reference && x.version === version)));
        liveListeners.current.forEach((fn) => fn(item));
      }),
    );

    return () => off.forEach((fn) => fn?.());
  }, [api, startProposalClock, updateProposals]);

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
      /* The practice sermon in place of a microphone (stores/practiceStore). */
      if (usePracticeStore.getState().on) {
        api.startListening(PRACTICE_SERMON_DEVICE);
        return;
      }
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

  const dismissProposal = useCallback((id: string) => updateProposals((p) => p.filter((x) => x.id !== id)), [updateProposals]);

  const onEngineLive = useCallback((fn: (item: LiveItem) => void) => {
    liveListeners.current.add(fn);
    return () => liveListeners.current.delete(fn) as unknown as void;
  }, []);

  const holdProposal = useCallback(
    (id: string, held: boolean, reason = 'pointer') => clocksRef.current?.hold(id, held, reason),
    [],
  );

  /* The operator chose one of the runners-up: it takes the proposal's place —
     same card, same set — and the one it replaced becomes the runner-up, so
     the choice can be taken back. A fresh six seconds, as for a verse heard. */
  const swapProposal = useCallback((id: string, reading: Reading) => {
    const m = reading.reference.match(/^(.+?) (\d+):/);
    if (!m) return;
    const book = m[1];
    const chapter = Number(m[2]);
    updateProposals((p) => p.map((x) => x.id !== id ? x : {
      ...x,
      reference: reading.reference,
      version: reading.version,
      text: reading.text,
      verses: reading.verses,
      slides: buildVerseSlides({ book, chapter, version: reading.version }, reading.verses, fitRules(reading.verses)),
      trust: null,
      missing: false,
      alternates: [x.reference, ...(x.alternates ?? []).filter((a) => a !== reading.reference)].slice(0, 3),
    }));
    startProposalClock(id);
  }, [updateProposals, startProposalClock]);

  const onProposalExpired = useCallback((fn: (id: string) => void) => {
    expiryListeners.current.add(fn);
    return () => expiryListeners.current.delete(fn) as unknown as void;
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
      latestReference,
      dismissProposal,
      proposalClocks,
      leavingProposals,
      holdProposal,
      swapProposal,
      onProposalExpired,
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
      latestReference,
      dismissProposal,
      proposalClocks,
      leavingProposals,
      holdProposal,
      swapProposal,
      onProposalExpired,
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
  latestReference: null,
  dismissProposal: () => undefined,
  proposalClocks: {},
  leavingProposals: [],
  holdProposal: () => undefined,
  swapProposal: () => undefined,
  onProposalExpired: () => () => undefined,
  onEngineLive: () => () => undefined,
};

export function useEngine(): EngineValue {
  return useContext(EngineContext) ?? DEAD;
}
