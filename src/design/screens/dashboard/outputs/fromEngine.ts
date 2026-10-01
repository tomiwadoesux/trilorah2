import { useEffect, useState } from 'react';
import type { DisplayInfo } from '../../settingsRows';
import type { Role, Screen } from './types';

/*
 * The outputs as the engine has them.
 *
 * The card and the Settings display map were drawn from specimens, so every
 * church saw an Epson, a BlackMagic and a Dell whatever was on their desk.
 * `get-outputs-status` (electron/output/outputsStatus.ts) answers with the
 * displays that are really connected and where each output is or will open;
 * this asks it, asks again whenever the engine says something moved, and
 * turns the answer into what the two surfaces draw.
 */

/**
 * The engine's answer, kept current. Null until it arrives, and for good
 * where there is no engine to ask (a plain browser tab). `enabled` false
 * asks nothing, for a surface that only sometimes draws the displays.
 */
export function useOutputsStatus(enabled = true): OutputsStatus | null {
  const [status, setStatus] = useState<OutputsStatus | null>(null);
  useEffect(() => {
    const api = typeof window === 'undefined' ? undefined : window.api;
    if (!enabled || !api?.getOutputsStatus) return;
    let alive = true;
    /* Answers can land out of order; only the newest question's counts. */
    let asked = 0;
    const load = () => {
      const n = ++asked;
      void api
        .getOutputsStatus?.()
        .then((s) => {
          if (alive && n === asked && s) setStatus(s);
        })
        .catch(() => undefined);
    };
    load();
    const offs = [api.onOutputsChanged?.(load), api.onScreenState?.(load)];
    return () => {
      alive = false;
      offs.forEach((off) => off?.());
    };
  }, [enabled]);
  return status;
}

/** One card screen per output, named after the display it is really on. */
export function screensFrom(status: OutputsStatus): Screen[] {
  const byId = new Map(status.displays.map((d) => [d.id, d]));
  return status.outputs.map((o) => {
    const d = o.fullscreen && o.displayId !== null ? byId.get(o.displayId) : undefined;
    return {
      id: o.id,
      role: o.role,
      display: o.disabled ? 'no screen — off' : d ? d.name : 'no screen — on this laptop',
      disabled: o.disabled,
      size: d ? { w: d.w, h: d.h } : null,
      windowed: !d && !o.disabled,
      state: o.open ? status.screenState : 'off',
    };
  });
}

/** The display picker's first entry: no pinned display, externals in order. */
export const AUTOMATIC = 'automatic';
export const NO_SCREEN = 'no screen — off';

export function displayOptions(status: OutputsStatus): string[] {
  return [NO_SCREEN, AUTOMATIC, ...status.displays.map((d) => d.name)];
}

/** What an output's display picker reads: its pinned display, or automatic. */
export function displayChoice(status: OutputsStatus, outputId: string): string {
  if (status.outputs.find((o) => o.id === outputId)?.disabled) return NO_SCREEN;
  const pinned = status.outputs.find((o) => o.id === outputId)?.chosenDisplayId;
  return status.displays.find((d) => d.id === pinned)?.name ?? AUTOMATIC;
}

/** The Settings display map: every connected display, lit with the job it has. */
export function displayMapFrom(status: OutputsStatus): DisplayInfo[] {
  return status.displays.map((d) => ({
    id: String(d.id),
    name: d.name,
    w: d.w,
    h: d.h,
    role: status.outputs.find((o) => o.fullscreen && o.displayId === d.id)?.role ?? null,
    isOperator: d.primary,
  }));
}

/* Writes merge into what the store holds, so the outputs not being changed
   keep their own jobs and displays. The engine repaints and moves the open
   windows on these keys, then says so, and the card redraws from that. */
async function held(key: string): Promise<Record<string, unknown>> {
  const v = await window.api?.getSetting(key);
  return v && typeof v === 'object' ? { ...(v as Record<string, unknown>) } : {};
}

export async function saveRole(outputId: string, role: Role): Promise<void> {
  const api = window.api;
  if (!api) return;
  await api.setSetting('outputRoles', { ...(await held('outputRoles')), [outputId]: role });
}

/** Pin an output to a display by id, or unpin it with null. */
export async function saveDisplay(outputId: string, displayId: number | 'none' | null): Promise<void> {
  const api = window.api;
  if (!api) return;
  const next = await held('outputDisplays');
  const previous = next[outputId];
  if (displayId === null) delete next[outputId];
  else next[outputId] = displayId;
  await api.setSetting('outputDisplays', next);
  // Reselecting an unchanged display must also reopen a closed output.
  if (displayId !== 'none' && previous === next[outputId]) api.openOutput?.(outputId);
}
