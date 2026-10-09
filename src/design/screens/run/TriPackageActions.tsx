import { useEffect, useRef, useState } from 'react';
import { useNoticeNavigation } from '../../../lib/notificationNavigation';
import type { TriSelection, TriSnapshot } from '../../../../shared/triPackage';
import type { TriInspection } from '../../../../shared/triBridge';
import { foreignDependencies, unanswered, type ForeignAnswers, type ForeignQuestion } from '../../../../shared/foreignImport';
import { ForeignQuestions } from './ForeignQuestions';
import {
  applyTriSnapshot, restoreTriRenderer, selectTriItems, selectedTriCount, SERVICE_CATEGORIES,
  triApi, triRendererState, TRI_CATEGORIES, TRI_DECKS_EVENT,
} from '../../../lib/triClient';
import { operatorRunStore } from '../../../stores/operatorRunStore';
import { Button } from '../../../ui';
import { useMediaLibrary } from '../mediaLibrary';
import { useRun } from '../run';
import { FlightPopup } from '../songs/FlightPopup';

type View = 'home' | 'save' | 'export' | 'import';
type ActiveFile = { path?: string; title: string; selection?: TriSelection };

/** File work stays in the operator surface; importing never restarts the app. */
export function TriPackageActions() {
  const run = useRun();
  const media = useMediaLibrary();
  const [open, setOpen] = useState(false);
  const notificationRequest = useNoticeNavigation(s => s.request);
  useEffect(() => {
    const navigation = useNoticeNavigation.getState();
    if (navigation.target === 'run') { setOpen(true); navigation.clear(); }
  }, [notificationRequest]);
  const [view, setView] = useState<View>('home');
  const [active, setActive] = useState<ActiveFile>({ title: 'Untitled service' });
  const [recent, setRecent] = useState<Array<{ path: string; title: string }>>([]);
  const [catalog, setCatalog] = useState<TriSnapshot>({ categories: {} });
  const [selection, setSelection] = useState<TriSelection>({});
  const [title, setTitle] = useState('Untitled service');
  const [token, setToken] = useState<string>();
  const [foreignImport, setForeignImport] = useState(false);
  const [questions, setQuestions] = useState<ForeignQuestion[]>([]);
  const [openService, setOpenService] = useState(false);
  const [saveAs, setSaveAs] = useState(false);
  const [replaceConsent, setReplaceConsent] = useState(false);
  const [confirmNew, setConfirmNew] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [saveState, setSaveState] = useState('');
  const [revision, setRevision] = useState(0);
  const revisionRef = useRef(0);
  const savedRevision = useRef(0);
  const failedRevision = useRef(-1);
  const busyRef = useRef(false);
  const activeRef = useRef(active);
  activeRef.current = active;
  const trigger = useRef<HTMLSpanElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const desktop = !!triApi()?.triCatalog;
  const dependencies: TriSelection = view === 'import' && foreignImport ? foreignDependencies(catalog, selection) : {};
  const effectiveSelection: TriSelection = { ...selection };
  for (const category of ['songs', 'media'] as const) {
    if (dependencies[category]?.length) effectiveSelection[category] = [...new Set([...(selection[category] ?? []), ...dependencies[category]!])];
  }

  const markChanged = () => {
    revisionRef.current += 1;
    setRevision(revisionRef.current);
    if (activeRef.current.path) setSaveState('Unsaved changes');
  };

  async function refreshStatus() {
    const api = triApi();
    const [status, files] = await Promise.all([api?.triStatus?.(), api?.triRecent?.()]);
    if (status) { setActive(status); activeRef.current = status; }
    if (files) setRecent(files);
    return status;
  }

  useEffect(() => {
    void (async () => {
      await operatorRunStore.hydrate();
      await restoreTriRenderer();
      const status = await refreshStatus();
      savedRevision.current = revisionRef.current;
      if (status?.pendingOpen) void inspectRef.current(true);
    })().catch(() => setNotice('Could not restore package details. Your local run is still available.'));
    const unsubscribe = operatorRunStore.subscribe(markChanged);
    /* The empty rail's own .tri button — see askRun in RunHeaderActions. */
    const openFiles = () => { setOpen(true); setView('home'); void refreshStatus(); };
    window.addEventListener('trilorah-open-tri', openFiles);
    window.addEventListener('trilorah-theme-changed', markChanged);
    window.addEventListener(TRI_DECKS_EVENT, markChanged);
    window.addEventListener('trilorah-package-imported', markChanged);
    window.addEventListener('trilorah-library-changed', markChanged);
    window.addEventListener('presentations-updated', markChanged);
    return () => {
      unsubscribe();
      window.removeEventListener('trilorah-open-tri', openFiles);
      window.removeEventListener('trilorah-theme-changed', markChanged);
      window.removeEventListener(TRI_DECKS_EVENT, markChanged);
      window.removeEventListener('trilorah-package-imported', markChanged);
      window.removeEventListener('trilorah-library-changed', markChanged);
      window.removeEventListener('presentations-updated', markChanged);
    };
  }, []);

  const previousMedia = useRef(media);
  useEffect(() => {
    if (previousMedia.current !== media) { previousMedia.current = media; markChanged(); }
  }, [media]);

  async function guard(action: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setNotice('');
    try { await action(); }
    catch (error) { setNotice(error instanceof Error ? error.message : 'The package operation failed. Try again.'); }
    finally { busyRef.current = false; setBusy(false); }
  }

  async function savePackage(picked: TriSelection, options: { saveAs?: boolean; exportOnly?: boolean; automatic?: boolean } = {}) {
    const api = triApi();
    if (!api?.triSave) return;
    const atRevision = revisionRef.current;
    if (!options.exportOnly) setSaveState('Saving…');
    try {
      const result = await api.triSave({
        title: options.automatic ? activeRef.current.title : title.trim() || activeRef.current.title,
        selection: picked, state: triRendererState(), saveAs: options.saveAs, exportOnly: options.exportOnly,
      });
      if (result.error) throw new Error(result.error);
      if (result.canceled) { if (!options.exportOnly) setSaveState('Save canceled'); return; }
      setWarnings(result.warnings ?? []);
      if (!options.exportOnly) {
        savedRevision.current = atRevision;
        failedRevision.current = -1;
        await refreshStatus();
        setSaveState(revisionRef.current === atRevision ? 'Saved' : 'Unsaved changes');
      }
      if (!options.automatic) {
        setNotice(`${options.exportOnly ? 'Exported' : 'Saved'} ${result.title ?? title}.tri${result.warnings?.length ? ' — review the notes below.' : ''}`);
        setView('home');
      }
    } catch (error) {
      if (!options.exportOnly) { setSaveState('Save failed'); failedRevision.current = atRevision; }
      throw error;
    }
  }

  useEffect(() => {
    if (!active.path || !active.selection || busy || revision <= savedRevision.current || revision === failedRevision.current) return;
    const timer = window.setTimeout(() => void guard(() => savePackage(activeRef.current.selection ?? {}, { automatic: true })), 1800);
    return () => window.clearTimeout(timer);
  }, [revision, busy, active.path, active.selection]);

  async function prepareSave(exportOnly: boolean, as = false, pastorsOnly = false) {
    await guard(async () => {
      const contents = await triApi()?.triCatalog?.(triRendererState());
      if (!contents) return;
      setCatalog(contents);
      setSelection(pastorsOnly ? selectTriItems(contents, ['preachers']) : !exportOnly && active.selection ? active.selection : selectTriItems(contents, exportOnly ? undefined : SERVICE_CATEGORIES));
      setTitle(pastorsOnly ? 'Pastor profile and learning' : active.title);
      setSaveAs(as);
      setWarnings([]);
      setView(exportOnly ? 'export' : 'save');
    });
  }

  async function inspect(asService: boolean, path?: string) {
    setOpen(true);
    await guard(async () => {
      const result = await triApi()?.triInspect?.(path);
      if (!result || result.canceled) return;
      if (result.error) throw new Error(result.error);
      if (!result.manifest || !result.token) throw new Error('This package does not contain a readable manifest.');
      if (token) await triApi()?.triDiscardPreview?.(token);
      setForeignImport(false);
      setQuestions([]);
      const contents: TriSnapshot = { categories: result.manifest.categories };
      setCatalog(contents);
      setSelection(selectTriItems(contents));
      setTitle(result.manifest.title);
      setToken(result.token);
      setOpenService(asService && !!contents.categories.service?.length);
      setReplaceConsent(false);
      setWarnings(result.warnings ?? []);
      setView('import');
    });
  }

  function stageForeign(result: TriInspection) {
    if (!result.manifest || !result.token) throw new Error('No readable content was found in these files.');
    const contents = { categories: result.manifest.categories };
    setCatalog(contents);
    setSelection(result.suggestedSelection ?? selectTriItems(contents));
    setTitle(result.manifest.title);
    setToken(result.token);
    setForeignImport(true);
    setQuestions(result.questions ?? []);
    setOpenService(false);
    setReplaceConsent(false);
    setWarnings(result.warnings ?? []);
    setView('import');
  }

  async function inspectForeign() {
    await guard(async () => {
      const result = await triApi()?.triInspectForeign?.();
      if (!result || result.canceled) return;
      if (result.error) throw new Error(result.error);
      if (token) await triApi()?.triDiscardPreview?.(token);
      stageForeign(result);
    });
  }

  /** Each answer re-reads the files, so the checklist shows exactly what the answer adds. */
  async function answerForeign(answers: ForeignAnswers) {
    if (!token) return;
    await guard(async () => {
      const result = await triApi()?.triAnswerForeign?.({ token, answers });
      if (!result || result.canceled) return;
      if (result.error) throw new Error(result.error);
      stageForeign(result);
    });
  }

  function chooseAll() {
    const selected = selectTriItems(catalog);
    if (view === 'import' && foreignImport && selected.themes) selected.themes = selected.themes.slice(0, 1);
    setSelection(selected);
  }

  const inspectRef = useRef(inspect);
  inspectRef.current = inspect;
  useEffect(() => triApi()?.onTriOpenRequested?.(() => void inspectRef.current(true)), []);

  async function importPackage() {
    if (!token) return;
    await guard(async () => {
      const openingRun = openService && !!selection.service?.length;
      await operatorRunStore.flush();
      const result = await triApi()?.triImport?.({ token, selection: effectiveSelection, openService: openingRun });
      if (!result || result.canceled) return;
      if (result.error) throw new Error(result.error);
      if (!result.snapshot) throw new Error('The package did not return any imported content.');
      applyTriSnapshot(result.snapshot, openingRun);
      setToken(undefined);
      await operatorRunStore.flush();
      await refreshStatus();
      if (openingRun) savedRevision.current = revisionRef.current;
      setSaveState(openingRun ? 'Opened' : 'Unsaved changes');
      setWarnings(result.warnings ?? []);
      setNotice(openingRun ? `Opened ${title}. Included resources are now on this laptop’s library.` : 'Selected resources copied into this laptop’s library.');
      setView('home');
    });
  }

  async function newService() {
    await guard(async () => {
      await operatorRunStore.flush();
      await triApi()?.triNew?.();
      operatorRunStore.update([]);
      await operatorRunStore.flush();
      savedRevision.current = revisionRef.current;
      await refreshStatus();
      setSaveState('');
      setConfirmNew(false);
      setNotice('New service ready. Your library is available to use.');
    });
  }

  function trapFocus(event: KeyboardEvent) {
    if (event.key !== 'Tab') return;
    const dialog = body.current?.closest('[role="dialog"]');
    const focusable = Array.from(dialog?.querySelectorAll<HTMLElement>('button, input, select, textarea, [tabindex="0"]') ?? []).filter(item => !item.hasAttribute('disabled'));
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => body.current?.querySelector<HTMLElement>('input, button')?.focus(), 350);
    window.addEventListener('keydown', trapFocus);
    return () => { window.clearTimeout(timer); window.removeEventListener('keydown', trapFocus); };
  }, [open, view]);

  const count = selectedTriCount(effectiveSelection);
  const replacing = view === 'import' && openService && !!selection.service?.length && run.segments.length > 0;
  const reviewing = view !== 'home';
  const packageNotes = warnings.length > 0 && <div className="my-3 rounded-lg border border-amber-300/20 p-3 text-xs"><p className="font-semibold">Import notes</p><ul className="mt-2 list-disc space-y-1 pl-4">{warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></div>;
  const close = () => { if (!busyRef.current) { if (token) void triApi()?.triDiscardPreview?.(token); setToken(undefined); setOpen(false); trigger.current?.querySelector('button')?.focus(); } };

  return <>
    <span ref={trigger} className="inline-flex">
      <Button label=".tri" title={`${active.title}${active.path ? ` · ${saveState || 'saved service'}` : ' · service files'}`} onClick={() => { setOpen(true); setView('home'); void refreshStatus(); }} />
    </span>
    <FlightPopup open={open} size={{ w: 680, h: 640 }} label="Trilorah service files" onRequestClose={close}
      header={<><h2 className="text-lg font-semibold">{view === 'home' ? 'Service files' : view === 'import' ? foreignImport ? 'Review import' : `Import from ${title}` : view === 'export' ? 'Export a .tri package' : 'Save service'}</h2><p className="mt-1 text-xs text-[var(--tri-ink-muted)]">{active.title} {active.path ? `· ${saveState || 'Saved'}` : '· not saved to a .tri file yet'}</p></>}
      footer={reviewing && desktop ? <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-white/10 px-6 py-4">
        <span className="text-xs text-[var(--tri-ink-muted)]">{count} {count === 1 ? 'item' : 'items'} selected</span>
        <div className="flex gap-2"><Button label="back" tone="ash" disabled={busy} onClick={() => setView('home')} /><Button label={busy ? 'working…' : view === 'import' ? openService && selection.service?.length ? 'open service' : 'import selected' : view === 'export' ? 'export .tri' : 'save .tri'} disabled={busy || !count || (view === 'import' && unanswered(questions).length > 0) || (replacing && !replaceConsent) || (view !== 'import' && !title.trim()) || (view === 'save' && !selection.service?.length)} onClick={() => view === 'import' ? void importPackage() : void guard(() => savePackage(selection, { exportOnly: view === 'export', saveAs }))} /></div>
      </footer> : undefined}>
      <div ref={body} className="min-h-0 flex-1 overflow-y-auto px-6 py-4 text-sm text-[var(--tri-ink)]">
        {!desktop ? <p>Portable .tri files need the Trilorah desktop app. Open this service in the desktop app to save, open, or import a package.</p> : <>
          {view === 'home' ? <>
            <p className="mb-4 text-xs leading-relaxed text-[var(--tri-ink-muted)]">Save your service and its resources in one portable file. Import all of a package or choose individual songs, slides, layouts, and pastor learning.</p>
            <div className="flex flex-wrap gap-2">
              <Button label="new service" disabled={busy} onClick={() => run.segments.length ? setConfirmNew(true) : void newService()} />
              <Button label="open .tri" disabled={busy} onClick={() => void inspect(true)} />
              <Button label="save" disabled={busy} onClick={() => active.path && active.selection ? void guard(() => { setTitle(active.title); return savePackage(active.selection!, { automatic: true }); }) : void prepareSave(false)} />
              <Button label="save as…" disabled={busy} onClick={() => void prepareSave(false, true)} />
              <Button label="import from .tri" disabled={busy} onClick={() => void inspect(false)} />
              <Button label="import from another app…" disabled={busy || !triApi()?.triInspectForeign} onClick={() => { setWarnings([]); setNotice(''); void inspectForeign(); }} />
              <Button label="export selected…" disabled={busy} onClick={() => void prepareSave(true)} />
              <Button label="export pastor & learning" disabled={busy} onClick={() => void prepareSave(true, true, true)} />
              {active.path && <Button label="change included content…" tone="ash" disabled={busy} onClick={() => void prepareSave(false)} />}
            </div>
            {confirmNew && <div role="alertdialog" aria-label="Start a new service?" className="mt-4 rounded-xl border border-amber-300/30 p-4"><p>Start a new service? This clears the current {run.segments.length} segments. Save your current service first if you want a separate file.</p><div className="mt-3 flex gap-2"><Button label="keep current service" tone="ash" onClick={() => setConfirmNew(false)} /><Button label="start new service" tone="caution" disabled={busy} onClick={() => void newService()} /></div></div>}
            <p className="mt-4 text-xs leading-relaxed text-[var(--tri-ink-muted)]">After saving, run and layout edits are saved automatically to the active file. Its selected resources and any resources used by the service are included. Use “change included content” to add more.</p>
            {active.path && <p className="mt-2 break-all text-xs text-[var(--tri-ink-muted)]">{active.path}</p>}
            {recent.length > 0 && <div className="mt-6"><h3 className="mb-2 font-semibold">Recent services</h3><ul className="space-y-2">{recent.map(file => <li key={file.path}><button type="button" disabled={busy} className="w-full rounded-lg border border-white/10 px-3 py-2 text-left hover:bg-white/5 disabled:opacity-50" onClick={() => void inspect(true, file.path)}><span className="block">{file.title}</span><span className="block truncate text-xs text-[var(--tri-ink-muted)]">{file.path}</span></button></li>)}</ul></div>}
          </> : <>
            {view !== 'import' && <label className="mb-4 block"><span className="mb-1 block text-xs">Package name</span><input className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2" value={title} onChange={event => setTitle(event.target.value)} maxLength={160} /></label>}
            {view === 'import' ? <p className="mb-3 text-xs leading-relaxed text-[var(--tri-ink-muted)]">{foreignImport ? 'Pick any files from your old app: exports, databases, songs, pictures. Selected resources are copied into this laptop’s library. Existing items are kept. Required songs and media are selected automatically. Themes are staged in preview.' : <>Resources are copied into this laptop’s library. Existing items are kept; imported copies use new identities. {openService ? 'This opens the included run of service. Opening part of a package creates a new service you can Save As.' : 'Any selected run of service is appended to your current run.'} Imported layouts are staged in preview for your next go live.</>}</p> : <p className="mb-3 text-xs leading-relaxed text-[var(--tri-ink-muted)]">Choose what travels in the file. Pastor learning contains saved corrections and recognition evidence, with no voice recordings. Media used by selected content is included automatically.</p>}
            {view === 'import' && foreignImport && <ForeignQuestions questions={questions} busy={busy} onAnswer={answers => void answerForeign(answers)} />}
            {view === 'import' && packageNotes}
            {view === 'import' && foreignImport && !!catalog.categories.service?.length && <label className="mb-3 flex gap-2 text-xs"><input type="checkbox" disabled={busy} checked={openService} onChange={event => { setOpenService(event.target.checked); setReplaceConsent(false); }} /><span>Open as a new service instead of adding to my current run</span></label>}
            <div className="mb-3 flex flex-wrap gap-2"><Button label="select all" tone="ash" disabled={busy} onClick={chooseAll} /><Button label="clear selection" tone="ash" disabled={busy} onClick={() => setSelection({})} />{view !== 'import' && <Button label="pastor learning only" tone="ash" disabled={busy} onClick={() => setSelection(selectTriItems(catalog, ['preachers']))} />}</div>
            {TRI_CATEGORIES.map(category => {
              const items = catalog.categories[category.id] ?? [];
              if (!items.length) return null;
              const chosen = effectiveSelection[category.id] ?? [];
              const singleTheme = view === 'import' && foreignImport && category.id === 'themes';
              return <details key={category.id} className="mb-2 rounded-lg border border-white/10 p-3" open={category.id === 'preachers' || category.id === 'service'}>
                <summary className="cursor-pointer"><label className="ml-1 inline-flex items-center gap-2" onClick={event => event.stopPropagation()}><input type="checkbox" checked={singleTheme ? chosen.length > 0 : chosen.length === items.length} disabled={busy} aria-label={singleTheme ? 'Include a theme' : `Include all ${category.label}`} onChange={event => setSelection(previous => ({ ...previous, [category.id]: event.target.checked ? (singleTheme ? [items[0].id] : items.map(item => item.id)) : [] }))} /><span className="font-medium">{category.label}</span><span className="text-xs text-[var(--tri-ink-muted)]">{chosen.length}/{items.length}</span></label></summary>
                <p className="my-2 text-xs text-[var(--tri-ink-muted)]">{category.detail}</p>
                <div className="space-y-2">{items.map(item => <div key={item.id}><label className="flex items-start gap-2 text-xs"><input type="checkbox" className="mt-0.5" disabled={busy || dependencies[category.id]?.includes(item.id)} checked={chosen.includes(item.id)} onChange={event => setSelection(previous => ({ ...previous, [category.id]: event.target.checked ? (singleTheme ? [item.id] : [...(previous[category.id] ?? []), item.id]) : (previous[category.id] ?? []).filter(id => id !== item.id) }))} /><span className="break-words">{item.label}{dependencies[category.id]?.includes(item.id) && <span className="ml-2 text-[var(--tri-ink-muted)]">required by selection</span>}</span></label>{view === 'import' && foreignImport && category.id === 'songs' && <details className="ml-6 mt-1 text-xs text-[var(--tri-ink-muted)]"><summary className="cursor-pointer">Preview lyrics</summary><pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap font-sans">{item.data.sections?.map((section: { label: string; lines: string[] }) => `${section.label}\n${section.lines.join('\n')}`).join('\n\n')}</pre></details>}</div>)}</div>
              </details>;
            })}
            {!Object.values(catalog.categories).some(items => items?.length) && <p className="py-4 text-[var(--tri-ink-muted)]">{unanswered(questions).length ? 'Answer the questions above to see what these files contain.' : 'There is no content in this package.'}</p>}
            {view === 'save' && !selection.service?.length && <p className="mt-3 text-xs text-amber-200">A service file must include its run of service. Use Export for a resource-only package.</p>}
            {replacing && <label className="mt-4 flex gap-2 rounded-lg border border-amber-300/30 p-3 text-xs"><input type="checkbox" checked={replaceConsent} onChange={event => setReplaceConsent(event.target.checked)} /><span>Replace my current {run.segments.length} segments with the service in this file. I have saved anything I want to keep.</span></label>}
          </>}
        </>}
        <p role="status" aria-live="polite" className="mt-4 text-xs leading-relaxed">{busy ? 'Working…' : notice}</p>
        {view !== 'import' && packageNotes}
      </div>
    </FlightPopup>
  </>;
}
