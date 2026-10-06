import { useState } from 'react';
import { Button, SearchField, Select, ScriptureReferenceInput } from '../../ui';
import { BOOKS, CHAPTER_COUNTS } from '../../lib/books';
import { LibraryBrowser, LibraryPane, LibrarySearch } from '../screens/library';
import { ScriptureLibraryEmpty } from '../screens/ScriptureLibraryEmpty';
import { EmptyMark } from '../screens/emptyArt';
import { SongRackArt } from '../screens/SongRackArt';
import { PresentationEmptyArt } from '../screens/PresentationEmptyArt';

const books = BOOKS.map((name, index) => ({ name, chapters: CHAPTER_COUNTS[index] }));

/** Temporary empty libraries for inspection; never writes to the real library. */
export function LibraryEmptyPreview() {
  const [tab, setTab] = useState<'scripture' | 'songs' | 'slides'>('scripture');
  const [version, setVersion] = useState('KJV');
  const [notice, setNotice] = useState('Preview only — no library content is changed.');
  return (
    <div className="space-y-3" data-library-empty-preview>
      <a className="inline-block text-xs text-white/50 underline underline-offset-4" href="/design.html?empty-art-preview">New illustrations: notifications, displays, notes, preachers & more</a>
      <div className="flex flex-wrap gap-2" role="group" aria-label="empty library previews">
        {(['scripture', 'songs', 'slides'] as const).map(name => (
          <button key={name} type="button" aria-pressed={tab === name}
            className="rounded-lg border border-white/15 px-4 py-2 text-sm text-white/60 aria-pressed:bg-white/10 aria-pressed:text-white"
            onClick={() => { setTab(name); setNotice('Preview only — no library content is changed.'); }}>
            {name}
          </button>
        ))}
      </div>
      <div className="h-[480px] rounded-xl bg-[#111111] px-3 py-3">
        <LibraryBrowser search={tab === 'scripture' ? <>
          <div className="w-[68px] shrink-0"><Select options={['KJV', 'BBE'].map(value => ({ value, label: value }))}
            value={version} onChange={value => { setVersion(value); setNotice(`Preview: ${value} selected. In the app, changing versions loads the selected chapter again.`); }} /></div>
          <LibrarySearch disabled><ScriptureReferenceInput books={books} className="min-w-0 flex-1" /></LibrarySearch>
        </> : <LibrarySearch disabled>
          <SearchField placeholder={tab === 'songs' ? 'type a song name or lyrics...' : 'type a deck name or anything written on a slide...'} />
        </LibrarySearch>}>
          <LibraryPane header={tab === 'scripture'} title={tab === 'scripture' ? <><span className="w-[150px] shrink-0">reference</span><span>scripture text</span></> : undefined}>
            {tab === 'scripture' ? <ScriptureLibraryEmpty status="error" error="Database not connected" version={version}
              onRetry={() => setNotice('In the app, Try again reloads the selected chapter and restores search when it succeeds.')} />
              : <EmptyMark w={220} h={220} plain art={tab === 'songs' ? <SongRackArt /> : <PresentationEmptyArt />}
                line={tab === 'songs' ? 'no songs yet' : 'no presentations yet'}
                hint={tab === 'songs' ? 'add your first song to the library' : 'import a deck or create your first slide'}
                below={<div className="mt-4"><Button label={tab === 'songs' ? 'add a song' : 'quick slide'} tone={tab === 'slides' ? 'go' : 'default'}
                  onClick={() => setNotice(tab === 'songs' ? 'In the app, Add a song opens the song editor.' : 'In the app, Quick slide opens the slide editor.')} /></div>} />}
          </LibraryPane>
        </LibraryBrowser>
      </div>
      <p role="status" className="text-xs text-neutral-400">{notice}</p>
    </div>
  );
}
