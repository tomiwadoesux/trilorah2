import { guideTasks, searchGuideTasks, type GuideTask } from './productGuide';

export const CONTEXT_GUIDE_EVENT = 'trilorah-guide-control';
export const GUIDE_ACTION_SELECTOR = 'button, a[href], summary, select, [role="button"], [role="tab"], [role="switch"], [role="checkbox"], [role="slider"], [role="menuitem"], [role="menuitemradio"], [data-guide]';

export function requestControlGuide(target: HTMLElement) {
  window.dispatchEvent(new CustomEvent(CONTEXT_GUIDE_EVENT, { detail: target }));
}

type ControlInfo = { anchor?: string; label: string; description?: string; area?: string; kind?: string; disabled?: boolean };
export type ControlGuide = { title: string; prompt: string; task: GuideTask | null };

const controlHelp: Record<string, { task: string; prompt: string }> = {
  listen: { task: 'audio.start-stop-listening', prompt: 'Start listening transcribes the selected microphone. Press it again to stop. Choose your input from Audio, at the preview’s bottom left.' },
  'go-live': { task: 'output.publish-preview', prompt: 'Send the preview to the live output. Check the preview first; the room sees the change when you press Go live.' },
  'preview-unstage': { task: 'output.clear-restore', prompt: '× removes the staged item from preview. When that item is also live, it clears the projected words and leaves the background in place. With a different preview, the live screen stays as it is. To show cleared words again, select the item in its library and press Go live.' },
  'run-list': { task: 'run.build-edit', prompt: 'Click a section to open its items. Drag from an empty gap to select several sections, Shift-click for a range, or Command/Ctrl-click to add a section. Drag selected cards to reorder them; right-click for move and remove actions. Double-click a selected section to open it.' },
  'run-add': { task: 'run.build-edit', prompt: 'Add a section to the run of show, then add the songs, verses, slides, or notes needed for that part of the service.' },
  'run-section-select': { task: 'run.build-edit', prompt: 'Add this section to the selection, or remove it from the selection. Select several sections to move or remove them together. Shift-click a section for a range.' },
  'run-section-remove': { task: 'run.build-edit', prompt: 'Remove this section and its scheduled items from the run of show. Songs, verses, and media remain available in their libraries.' },
  'run-selected-earlier': { task: 'run.build-edit', prompt: 'Move the selected sections one position earlier, keeping their order together. You can also press Alt + Up Arrow.' },
  'run-selected-later': { task: 'run.build-edit', prompt: 'Move the selected sections one position later, keeping their order together. You can also press Alt + Down Arrow.' },
  'run-selected-remove': { task: 'run.build-edit', prompt: 'Remove all selected sections and their scheduled items from the run of show. Their original songs, verses, and media remain in the libraries. Delete or Backspace does the same while this selection is focused.' },
  'run-selection-clear': { task: 'run.build-edit', prompt: 'Deselect every section without changing your run of show. Escape also clears the selection.' },
  'song-card-previous': { task: 'songs.preview-display-section', prompt: 'Show an earlier lyric excerpt on this song card. Browse the lyrics here without opening the song or changing the live screen.' },
  'song-card-next': { task: 'songs.preview-display-section', prompt: 'Show the next lyric excerpt on this song card. Browse the lyrics here without opening the song or changing the live screen.' },
  'song-card-live': { task: 'songs.preview-display-section', prompt: 'Send the lyric excerpt currently displayed on this card to the live screen and open the song’s slides. Use the card’s left and right arrows to choose the excerpt before pressing Go live.' },
  'songs-search-titles': { task: 'songs.find-local', prompt: 'Search song titles and artists. Start typing anywhere in the Songs tab to send your words into its search field. Choose Lyrics when you want to find words inside a song.' },
  'songs-search-lyrics': { task: 'songs.find-local', prompt: 'Search words inside your saved songs. Type a phrase from the lyrics, then choose a matching song to view its slides.' },
  'catches-song-search': { task: 'songs.find-local', prompt: 'Find songs using the most recent spoken words, then keep listening for matches. Suggested songs stay available until you clear the results.' },
};

/** Resolves help only. It never executes a control or starts a walkthrough. */
export function guideForControl(info: ControlInfo): ControlGuide {
  const title = info.label.trim() || info.anchor?.replace(/[-_.]/g, ' ') || 'This control';
  const direct = info.anchor ? controlHelp[info.anchor]
    ?? (info.anchor === 'run' || info.anchor.startsWith('run-section-') || info.anchor.startsWith('run-schedule-') ? controlHelp['run-list'] : undefined)
    ?? (info.anchor.startsWith('song-card-live-') ? controlHelp['song-card-live'] : undefined)
    ?? (info.anchor.startsWith('run-add-') ? controlHelp['run-add'] : undefined) : undefined;
  const lesson = info.anchor ? guideTasks.flatMap(task => (task.lesson ?? []).filter(point => point.anchor === info.anchor).map(point => ({ task, point })))[0] : undefined;
  const matches = searchGuideTasks(`${title} ${info.anchor?.replace(/[-_.]/g, ' ') ?? ''}`)
    .filter(task => task.status === 'wired' && !task.area.startsWith('web'));
  const task = (direct && guideTasks.find(item => item.id === direct.task)) || lesson?.task
    || matches.find(item => item.area === info.area || item.near?.includes(info.area ?? '')) || matches[0] || null;
  const interaction = info.kind === 'tab' ? `Select ${title} to open that library. Start typing to search within the active tab.`
    : info.kind === 'switch' || info.kind === 'checkbox' ? `Select ${title} to turn this option on or off.`
      : info.kind === 'slider' ? `Drag ${title} to adjust its value. When focused, use the arrow keys for small changes.`
        : info.kind === 'select' ? `Open ${title}, then choose an option from the list.`
          : `Choose ${title} to use this control.`;
  const prompt = direct?.prompt || info.description?.trim() || lesson?.point.say[0] || interaction;
  return { title, prompt: info.disabled ? `${prompt} This control is currently unavailable.` : prompt, task };
}

export function describeGuideControl(element: HTMLElement): ControlGuide {
  const labelledBy = element.getAttribute('aria-labelledby')?.split(/\s+/).map(id => document.getElementById(id)?.textContent ?? '').join(' ');
  const describedBy = element.getAttribute('aria-describedby')?.split(/\s+/).map(id => document.getElementById(id)?.textContent ?? '').join(' ');
  const anchor = element.closest<HTMLElement>('[data-guide]')?.dataset.guide;
  const label = (element.getAttribute('aria-label') || labelledBy || element.getAttribute('title') || element.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 140);
  const title = element.getAttribute('title');
  return guideForControl({
    anchor,
    label,
    description: element.getAttribute('data-guide-help') || describedBy || (title !== label ? title : undefined) || undefined,
    area: element.closest<HTMLElement>('[data-guide-area]')?.dataset.guideArea,
    kind: element.getAttribute('role') || element.tagName.toLowerCase(),
    disabled: element.matches(':disabled, [aria-disabled="true"]'),
  });
}
