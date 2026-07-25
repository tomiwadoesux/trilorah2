import { create } from 'zustand';

export type TabId =
  | 'live'
  | 'bible'
  | 'songs'
  | 'presentations'
  | 'themes'
  | 'schedule'
  | 'preachers'
  | 'notes'
  | 'settings'
  | 'cloud';

export const TABS: readonly { id: TabId; label: string }[] = [
  { id: 'live', label: 'LIVE' },
  { id: 'bible', label: 'BIBLE' },
  { id: 'songs', label: 'SONGS' },
  { id: 'presentations', label: 'MEDIA' },
  { id: 'themes', label: 'THEMES' },
  { id: 'schedule', label: 'SCHEDULE' },
  { id: 'preachers', label: 'PREACHERS' },
  { id: 'notes', label: 'NOTES' },
  { id: 'settings', label: 'SETTINGS' },
  { id: 'cloud', label: 'CLOUD' },
];

interface AppState {
  tab: TabId;
  /** Settings cache mirrored from the main-process store. */
  settings: AppSettings | null;
  asrStatus: ASRStatus;
  segment: SegmentChange | null;
  activePreacherId: string | null;
  activePreacherName: string | null;
  /** Trust lower bound (0..1) for the active preacher, when known. */
  trustLowerBound: number | null;
  prayerMode: boolean;
  intentState: IntentState;
  /** Rounded dB level while listening, null when idle/unknown. */
  audioLevel: number | null;
  /** Epoch ms when the operator pressed START LISTENING; null when stopped. */
  listeningSince: number | null;
  /** Guided onboarding tour — active step index, null when closed. */
  tourStep: number | null;

  setTab: (tab: TabId) => void;
  setSettings: (settings: AppSettings | null) => void;
  patchSetting: (key: string, value: unknown) => void;
  setAsrStatus: (status: ASRStatus) => void;
  setSegment: (segment: SegmentChange | null) => void;
  setActivePreacher: (id: string | null, name: string | null) => void;
  setTrustLowerBound: (trust: number | null) => void;
  setPrayerMode: (active: boolean) => void;
  setIntentState: (state: IntentState) => void;
  setAudioLevel: (level: number | null) => void;
  setListeningSince: (ts: number | null) => void;
  setTourStep: (step: number | null) => void;
}

export const useAppStore = create<AppState>()((set) => ({
  tab: 'live',
  settings: null,
  asrStatus: 'idle',
  segment: null,
  activePreacherId: null,
  activePreacherName: null,
  trustLowerBound: null,
  prayerMode: false,
  intentState: 'idle',
  audioLevel: null,
  listeningSince: null,
  tourStep: null,

  setTab: (tab) => set({ tab }),
  setSettings: (settings) => set({ settings }),
  patchSetting: (key, value) =>
    set((s) => ({ settings: { ...(s.settings ?? {}), [key]: value } })),
  setAsrStatus: (asrStatus) => set({ asrStatus }),
  setSegment: (segment) => set({ segment }),
  setActivePreacher: (activePreacherId, activePreacherName) =>
    set({ activePreacherId, activePreacherName }),
  setTrustLowerBound: (trustLowerBound) => set({ trustLowerBound }),
  setPrayerMode: (prayerMode) => set({ prayerMode }),
  setIntentState: (intentState) => set({ intentState }),
  setAudioLevel: (audioLevel) => set({ audioLevel }),
  setListeningSince: (listeningSince) => set({ listeningSince }),
  setTourStep: (tourStep) => set({ tourStep }),
}));
