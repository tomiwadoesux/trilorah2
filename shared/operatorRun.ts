export type QueueSource = 'scripture' | 'song' | 'media' | 'presentation' | 'note';

/** One thing queued inside a segment — a verse, a section, a note. */
export interface QueueItem {
  key: string;
  source: QueueSource;
  label: string;
  /** Media: what was dragged in, so the row can show the image itself. */
  preview?: string;
  /** Scripture: the verse text, carried from the drag. */
  quote?: string;
  /** Song: enough to go live from the row. Media: the file. */
  lines?: string[];
  title?: string;
  section?: string;
  path?: string;
  mediaKind?: 'photo' | 'video';
  /** Song: the library id, so "edit song" finds it after a rename. Optional
      — a row made from the segment's own + menu has only a title. */
  songId?: string;
}

export interface RunSegment {
  key: string;
  type: string;
  label: string;
  /*
   * Anything, regardless of the segment's type.
   *
   * The obvious model is worship-holds-songs and sermon-holds-verses, and
   * it is wrong about real services: worship has a scripture reading in the
   * middle of it and a sermon ends on an altar-call song. Type biases what
   * is offered first and constrains nothing.
   */
  items: QueueItem[];
  /** The plan, when there is one — a scanned programme or the default run
      states them; a segment picked from the + menu has neither. Minutes
      from midnight, and minutes. */
  startMin?: number;
  durationMin?: number;
}

export interface PersistedRun {
  segments: RunSegment[];
  updatedAt: number;
}
