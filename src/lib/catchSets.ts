/*
 * How caught verses are arranged in the right half of the verses card
 * (owner, 2026-10-06 — layout "C, spotlight").
 *
 * One catch is up in the spotlight; the rest wait as rows under it.
 * References the preacher names one straight after another ("Genesis 3:5,
 * John 3:16 and Romans 5:8") are ONE entry — a numbered set in the order he
 * said them — because he will read them in that order: the spotlight shows
 * the first, and sending it brings the next one up. Only the one that is up
 * spends its six seconds; the others wait their turn (see catchClock).
 *
 * A guess — a named passage, a story the engine recognised — never takes
 * the spotlight from a verse the preacher actually said or read; it waits
 * in the rows until the sure one has gone.
 *
 * Pure: the engine provider assigns sets as verses arrive, the screen asks
 * these functions what to draw and what to stage.
 */
import type { ScriptureRecognition } from '../../shared/types';

export type CatchKind = 'said' | 'read' | 'named' | 'story';

export function catchKind(recognition?: Pick<ScriptureRecognition, 'source'> | null): CatchKind {
  if (!recognition) return 'said';
  if (recognition.source === 'quote') return 'read';
  if (recognition.source === 'named') return 'named';
  return 'story';
}

/** The preacher said it or read it out — not the engine's reading of a story. */
export const isSure = (kind: CatchKind) => kind === 'said' || kind === 'read';

/**
 * References named this close together, one after another, are one set.
 * Six seconds because a spoken list arrives slowly: the resolver holds a
 * reference until the next words show the preacher has moved past it, so in
 * "Romans five eight, Ephesians two eight, and first John four nineteen" the
 * last two only land when the sentence ends — 4.5 s after the first, in the
 * practice sermon (2026-10-07).
 */
export const SET_GAP_MS = 6000;

export interface SetTail {
  group: string;
  at: number;
}

/**
 * The set a new catch belongs to. A plain reference said within SET_GAP_MS
 * of the last one joins its set, as long as that set still has a verse
 * waiting; anything else starts a set of its own (`fresh`).
 */
export function groupFor(kind: CatchKind, now: number, tail: SetTail | null, tailOpen: boolean, fresh: string): string {
  if (kind === 'said' && tail && tailOpen && now - tail.at <= SET_GAP_MS) return tail.group;
  return fresh;
}

export interface CatchItem {
  id: string;
  reference: string;
  kind: CatchKind;
  group: string;
  arrivedAt: number;
}

/** A verse of a set that has already been sent to the wall. */
export interface SentStep {
  reference: string;
  arrivedAt: number;
}

export type CatchStep<T> = { state: 'waiting'; item: T } | { state: 'sent'; reference: string };

export interface CatchEntry<T extends CatchItem> {
  group: string;
  /** Still waiting, in the order they were said. */
  waiting: T[];
  /** The one that is up: the operator's pick while it waits, otherwise the first said. */
  current: T;
  /** The whole set in spoken order — what is waiting and what has gone up — for the numbered strip. */
  steps: CatchStep<T>[];
  sure: boolean;
  /** When its newest verse arrived. Entries are ordered newest first. */
  newestAt: number;
}

export function catchEntries<T extends CatchItem>(
  items: readonly T[],
  sent: Readonly<Record<string, readonly SentStep[]>> = {},
  picked: Readonly<Record<string, string>> = {},
): CatchEntry<T>[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const list = groups.get(item.group);
    if (list) list.push(item);
    else groups.set(item.group, [item]);
  }
  const entries: CatchEntry<T>[] = [];
  for (const [group, list] of groups) {
    const waiting = [...list].sort((a, b) => a.arrivedAt - b.arrivedAt);
    const current = waiting.find((w) => w.id === picked[group]) ?? waiting[0];
    const steps = [
      ...waiting.map((item) => ({ at: item.arrivedAt, step: { state: 'waiting', item } as CatchStep<T> })),
      ...(sent[group] ?? []).map((s) => ({ at: s.arrivedAt, step: { state: 'sent', reference: s.reference } as CatchStep<T> })),
    ]
      .sort((a, b) => a.at - b.at)
      .map((s) => s.step);
    entries.push({
      group,
      waiting,
      current,
      steps,
      sure: isSure(current.kind),
      newestAt: Math.max(...waiting.map((w) => w.arrivedAt)),
    });
  }
  return entries.sort((a, b) => b.newestAt - a.newestAt);
}

/** Which entry is in the spotlight: the newest sure one, else the newest. -1 when none. */
export function spotlightIndex<T extends CatchItem>(entries: readonly CatchEntry<T>[]): number {
  if (!entries.length) return -1;
  const sure = entries.findIndex((e) => e.sure);
  return sure >= 0 ? sure : 0;
}

/** The verse the spotlight would show for these items, or null. */
export function spotlightItem<T extends CatchItem>(
  items: readonly T[],
  sent?: Readonly<Record<string, readonly SentStep[]>>,
  picked?: Readonly<Record<string, string>>,
): T | null {
  const entries = catchEntries(items, sent, picked);
  const i = spotlightIndex(entries);
  return i < 0 ? null : entries[i].current;
}

/** Verses waiting their turn behind the one that is up in their set. Their clocks are held. */
export function queuedIds<T extends CatchItem>(entries: readonly CatchEntry<T>[]): string[] {
  return entries.flatMap((e) => e.waiting.filter((w) => w.id !== e.current.id).map((w) => w.id));
}

/** The next verse of a set after `id`, in the order they were said, or null. */
export function nextInSet<T extends CatchItem>(entry: CatchEntry<T>, id: string): T | null {
  const i = entry.waiting.findIndex((w) => w.id === id);
  const rest = entry.waiting.filter((w) => w.id !== id);
  if (!rest.length) return null;
  return entry.waiting.slice(i + 1).find((w) => w.id !== id) ?? rest[0];
}
