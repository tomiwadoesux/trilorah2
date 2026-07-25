import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../stores/appStore';
import {
  Button,
  EmptyState,
  EngineNote,
  Panel,
  PanelHeader,
  SectionLabel,
  TextButton,
  hasEngine,
} from '../components/ui';

const SEGMENT_TYPES = [
  'pre-service',
  'worship',
  'announcements',
  'offering',
  'sermon',
  'altar-call',
  'closing',
  'prayer',
];

function SegmentTypeDatalist() {
  return (
    <datalist id="segment-types">
      {SEGMENT_TYPES.map((t) => (
        <option key={t} value={t} />
      ))}
    </datalist>
  );
}

export function Schedule() {
  const settings = useAppStore((s) => s.settings);
  const patchSetting = useAppStore((s) => s.patchSetting);
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<ScheduleImportResult | null>(null);
  const [suggestion, setSuggestion] = useState<ScheduleSuggestion | null>(null);
  const [suggestionNote, setSuggestionNote] = useState<string | null>(null);
  const seeded = useRef(false);

  // Seed once from the settings cache (arrives async on app mount).
  useEffect(() => {
    if (!seeded.current && settings?.serviceSchedule && Array.isArray(settings.serviceSchedule)) {
      seeded.current = true;
      setEntries(settings.serviceSchedule.map((e) => ({ ...e })));
    }
  }, [settings]);

  const update = (index: number, patch: Partial<ScheduleEntry>) => {
    setEntries((list) => list.map((e, i) => (i === index ? { ...e, ...patch } : e)));
    setNote(null);
  };

  const move = (index: number, dir: -1 | 1) => {
    setEntries((list) => {
      const to = index + dir;
      if (to < 0 || to >= list.length) return list;
      const next = [...list];
      const [moved] = next.splice(index, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setNote(null);
  };

  const remove = (index: number) => {
    setEntries((list) => list.filter((_, i) => i !== index));
    setNote(null);
  };

  const add = () => setEntries((list) => [...list, { type: 'worship' }]);

  const apply = (list: ScheduleEntry[] = entries) => {
    const cleaned = list
      .map((e) => ({
        ...e,
        type: e.type.trim(),
        title: e.title?.trim() || undefined,
        time: e.time?.trim() || undefined,
      }))
      .filter((e) => e.type.length > 0);
    window.api?.setServiceSchedule(cleaned);
    patchSetting('serviceSchedule', cleaned);
    setEntries(cleaned);
    setNote(`applied — ${cleaned.length} segments`);
  };

  const importFromPhoto = async () => {
    setImportPreview(null);
    try {
      const res = await window.api?.importScheduleImage();
      if (!res || res.canceled) return;
      setImportPreview(res);
    } catch {
      setImportPreview({ canceled: false, success: false, error: 'import failed' });
    }
  };

  const suggestFromHistory = async () => {
    setSuggestion(null);
    setSuggestionNote(null);
    try {
      const res = await window.api?.scheduleSuggestion();
      if (res?.success && res.suggestion) {
        setSuggestion(res.suggestion);
      } else {
        setSuggestionNote(res?.error ?? 'not enough service history yet (need at least 3 services)');
      }
    } catch {
      setSuggestionNote('could not fetch a suggestion');
    }
  };

  const applySuggestion = async () => {
    try {
      const res = await window.api?.applyScheduleSuggestion();
      if (res?.success && res.entries) {
        setEntries(res.entries.map((e) => ({ ...e })));
        patchSetting('serviceSchedule', res.entries);
        setSuggestion(null);
        setNote(`applied suggested order — ${res.entries.length} segments`);
      } else {
        setSuggestionNote(res?.error ?? 'could not apply suggestion');
      }
    } catch {
      setSuggestionNote('could not apply suggestion');
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight">Schedule</h2>
        <p className="text-sm text-neutral-500">
          The order of service guides the engine's segment awareness — edit it here, import it from
          a photo, or let history suggest one.
        </p>
        {!hasEngine() && <EngineNote />}
      </div>

      <SegmentTypeDatalist />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Panel pad={false} className="self-start">
          <div className="border-b border-hairline px-4 py-3">
            <SectionLabel>service order</SectionLabel>
          </div>
          {entries.length === 0 ? (
            <div className="px-4 py-4">
              <EmptyState>no segments yet — add one below</EmptyState>
            </div>
          ) : (
            <ol className="divide-y divide-hairline">
              {entries.map((entry, i) => (
                <li key={i} className="flex flex-wrap items-baseline gap-x-5 gap-y-2 px-4 py-3">
                  <span className="w-6 text-xs tabular-nums text-neutral-400">{i + 1}</span>
                  <input
                    list="segment-types"
                    value={entry.type}
                    onChange={(e) => update(i, { type: e.target.value })}
                    placeholder="type"
                    className="w-36 text-sm"
                  />
                  <input
                    value={entry.title ?? ''}
                    onChange={(e) => update(i, { title: e.target.value })}
                    placeholder="title (optional)"
                    className="w-56 text-sm"
                  />
                  <input
                    value={entry.time ?? ''}
                    onChange={(e) => update(i, { time: e.target.value })}
                    placeholder="time"
                    className="w-20 text-sm"
                  />
                  <span className="ml-auto flex items-baseline gap-x-4">
                    <TextButton label="↑" onClick={() => move(i, -1)} disabled={i === 0} title="move up" />
                    <TextButton label="↓" onClick={() => move(i, 1)} disabled={i === entries.length - 1} title="move down" />
                    <TextButton label="REMOVE" onClick={() => remove(i)} />
                  </span>
                </li>
              ))}
            </ol>
          )}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-hairline px-4 py-3">
            <Button label="Add segment" onClick={add} />
            <Button label="Apply" variant="solid" onClick={() => apply()} disabled={!hasEngine()} />
            {note && <p className="text-sm text-neutral-500">{note}</p>}
          </div>
        </Panel>

        <div className="space-y-6">
          <Panel className="self-start">
            <PanelHeader>import from photo</PanelHeader>
            <p className="text-sm text-neutral-500">
              Photograph the printed order of service. Only the schedule is kept; the image is discarded.
            </p>
            <div className="mt-3">
              <Button label="Import from photo" onClick={() => void importFromPhoto()} disabled={!hasEngine()} />
            </div>
            {importPreview && (
              <div className="mt-4 space-y-3 border-t border-hairline pt-3">
                {importPreview.success && importPreview.entries && importPreview.entries.length > 0 ? (
                  <>
                    <p className="text-sm text-neutral-500">found {importPreview.entries.length} segments:</p>
                    <ol className="space-y-1">
                      {importPreview.entries.map((e, i) => (
                        <li key={i} className="text-sm">
                          {i + 1}. {e.type}
                          {e.title ? ` — ${e.title}` : ''}
                          {e.time ? ` · ${e.time}` : ''}
                        </li>
                      ))}
                    </ol>
                    {importPreview.unmatchedLines && importPreview.unmatchedLines.length > 0 && (
                      <p className="text-sm italic text-neutral-400">
                        unmatched: {importPreview.unmatchedLines.join(' · ')}
                      </p>
                    )}
                    <div className="flex items-center gap-x-4">
                      <Button
                        label="Confirm & apply"
                        onClick={() => {
                          const imported = importPreview.entries ?? [];
                          setEntries(imported.map((e) => ({ ...e })));
                          apply(imported);
                          setImportPreview(null);
                        }}
                      />
                      <TextButton label="DISCARD" onClick={() => setImportPreview(null)} />
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-neutral-500">
                    {importPreview.error ?? 'could not read a schedule from that image'}
                  </p>
                )}
              </div>
            )}
          </Panel>

          <Panel className="self-start">
            <PanelHeader>suggest from history</PanelHeader>
            <p className="text-sm text-neutral-500">
              Builds an order from how your last services actually ran.
            </p>
            <div className="mt-3">
              <Button label="Suggest from history" onClick={() => void suggestFromHistory()} disabled={!hasEngine()} />
            </div>
            {suggestion && (
              <div className="mt-4 space-y-3 border-t border-hairline pt-3">
                <p className="text-sm text-neutral-500">
                  based on {suggestion.basedOnServices} services · confidence {Math.round(suggestion.confidence * 100)}%
                  {suggestion.modalMatch ? '' : ' · loose match'}
                </p>
                <ol className="space-y-1">
                  {suggestion.segments.map((seg, i) => (
                    <li key={i} className="text-sm">
                      {i + 1}. {seg.type}
                      <span className="pl-3 text-neutral-400">
                        ~{seg.avgDurationMinutes} min · seen {seg.occurrenceCount}×
                      </span>
                    </li>
                  ))}
                </ol>
                <div className="flex items-center gap-x-4">
                  <Button label="Apply suggestion" onClick={() => void applySuggestion()} />
                  <TextButton label="DISCARD" onClick={() => setSuggestion(null)} />
                </div>
              </div>
            )}
            {suggestionNote && <p className="mt-3 text-sm text-neutral-500">{suggestionNote}</p>}
          </Panel>
        </div>
      </div>
    </div>
  );
}
