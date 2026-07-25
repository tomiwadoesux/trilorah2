import { create } from 'zustand';

const TRANSCRIPT_CAP = 400;
const VOICE_LOG_CAP = 20;

export interface TranscriptLine {
  id: number;
  text: string;
  ts: number;
}

export interface DisplayedVerse {
  detection: VerseDetection;
  /** Fetched lazily via searchVerse; null while loading or unavailable. */
  text: string | null;
}

let nextLineId = 1;

interface LiveState {
  /** Ring buffer of transcript chunks, oldest first, capped. */
  lines: TranscriptLine[];
  preview: DisplayedVerse | null;
  live: DisplayedVerse | null;
  /** Version currently used for display (onVersionChanged / setDisplayVersion). */
  displayVersion: string | null;
  queue: VerseQueueItem[];
  reviewItems: ReviewItem[];
  /** Newest first, capped. */
  voiceLog: VoiceCommandEvent[];
  /** Live incremental outline from the reasoning loop. */
  notesSnapshot: NotesSnapshot | null;
  /** Full notes produced by GENERATE NOTES (shared with the Notes screen). */
  generatedNotes: SermonNotes | null;
  /** Operator practice mode — a scripted sermon replayed through the engine. */
  practice: { step: number; total: number; coach: string } | null;

  appendTranscript: (text: string) => void;
  setPreview: (preview: DisplayedVerse | null) => void;
  setLive: (live: DisplayedVerse | null) => void;
  setDisplayVersion: (version: string | null) => void;
  setQueue: (queue: VerseQueueItem[]) => void;
  setReviewItems: (items: ReviewItem[]) => void;
  markReviewResolved: (id: string, resolution: ReviewResolution, amendedTo?: VerseRef) => void;
  pushVoiceCommand: (event: VoiceCommandEvent) => void;
  setNotesSnapshot: (snapshot: NotesSnapshot | null) => void;
  setGeneratedNotes: (notes: SermonNotes | null) => void;
  setPractice: (practice: { step: number; total: number; coach: string } | null) => void;
}

export const useLiveStore = create<LiveState>()((set) => ({
  lines: [],
  preview: null,
  live: null,
  displayVersion: null,
  queue: [],
  reviewItems: [],
  voiceLog: [],
  notesSnapshot: null,
  generatedNotes: null,
  practice: null,

  appendTranscript: (text) =>
    set((s) => {
      const trimmed = text.trim();
      if (!trimmed) return s;
      const lines = [...s.lines, { id: nextLineId++, text: trimmed, ts: Date.now() }];
      return { lines: lines.length > TRANSCRIPT_CAP ? lines.slice(-TRANSCRIPT_CAP) : lines };
    }),
  setPreview: (preview) => set({ preview }),
  setLive: (live) => set({ live }),
  setDisplayVersion: (displayVersion) => set({ displayVersion }),
  setQueue: (queue) => set({ queue }),
  setReviewItems: (reviewItems) => set({ reviewItems }),
  markReviewResolved: (id, resolution, amendedTo) =>
    set((s) => ({
      reviewItems: s.reviewItems.map((item) =>
        item.id === id ? { ...item, resolution, amendedTo } : item,
      ),
    })),
  pushVoiceCommand: (event) =>
    set((s) => ({ voiceLog: [event, ...s.voiceLog].slice(0, VOICE_LOG_CAP) })),
  setNotesSnapshot: (notesSnapshot) => set({ notesSnapshot }),
  setGeneratedNotes: (generatedNotes) => set({ generatedNotes }),
  setPractice: (practice) => set({ practice }),
}));
