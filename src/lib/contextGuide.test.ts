import { describe, expect, it } from 'vitest';
import { guideForControl } from './contextGuide';

describe('contextual control help', () => {
  it('uses the exact live action instead of a similarly named search result', () => {
    const help = guideForControl({ anchor: 'preview-unstage', label: 'Unstage', area: 'operator' });
    expect(help.task?.id).toBe('output.clear-restore');
    expect(help.prompt).toContain('leaves the background');
    expect(help.prompt).toContain('With a different preview, the live screen stays as it is');
    expect(help.prompt).toContain('select the item in its library and press Go live');
  });

  it('explains that song-card Go live publishes the excerpt currently shown', () => {
    const help = guideForControl({ anchor: 'song-card-live-123', label: 'Go live', area: 'songs' });
    expect(help.task?.id).toBe('songs.preview-display-section');
    expect(help.prompt).toContain('excerpt currently displayed');
    expect(help.prompt).toContain('open the song’s slides');
  });

  it('finds a written lesson for an exact control anchor', () => {
    const help = guideForControl({ anchor: 'song-lyrics', label: 'Lyrics', area: 'songs' });
    expect(help.task?.id).toBe('songs.create-edit-slides');
    expect(help.prompt).toContain('blank line');
  });

  it('explains section selection and bulk actions instead of repeating the tooltip', () => {
    const help = guideForControl({ anchor: 'run-section-sermon', label: 'Open sermon', description: 'sermon · drag to reorder · Shift-click' });
    expect(help.prompt).toContain('Drag from an empty gap');
    expect(help.prompt).toContain('Command/Ctrl-click');
    expect(guideForControl({ anchor: 'run-selected-remove', label: 'Remove selected sections' }).prompt).toContain('remain in the libraries');
    expect(guideForControl({ anchor: 'listen', label: 'Start listening' }).prompt).toContain('Audio, at the preview’s bottom left');
  });

  it('describes an unindexed control without inventing a guide topic', () => {
    const help = guideForControl({ label: 'Aardvark', kind: 'switch' });
    expect(help.task).toBeNull();
    expect(help.prompt).toContain('turn this option on or off');
  });

  it('offers help for disabled controls and keeps the reason available', () => {
    const help = guideForControl({ label: 'Continue', description: 'Choose a display before continuing.', disabled: true });
    expect(help.prompt).toBe('Choose a display before continuing. This control is currently unavailable.');
  });
});
