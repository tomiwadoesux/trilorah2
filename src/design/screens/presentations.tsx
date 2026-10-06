import { isEmptyPreview } from '../emptyPreviewMode';
import { importAndSavePresentation, presentationImageSrc } from '../../lib/presentationImport';
import { useProjector } from './projector';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BACKDROP_BY_CONTENT, Button, ImportIcon, PresentationIcon, SearchField, SearchIcon, SegmentedControl, SlideThumb, SparkleIcon, cx } from '../../ui';
import { FlightPopup } from './songs/FlightPopup';
import { LibraryToolbar } from './LibraryToolbar';
import { LibraryBrowser, LibraryPane, LibrarySearch, useLibrarySelection } from './library';
import { EmptyMark } from './emptyArt';
import { PresentationEmptyArt } from './PresentationEmptyArt';
import { useDrag } from './drag';
import { deckPage, type DeckPageSpec } from './deckPage';
import { readTriLocal, TRI_DECKS_KEY, TRI_DECKS_EVENT } from '../../lib/triClient';

/*
 * S-05 — imported presentation slides.
 *
 * The songs grid with a different noun in the middle, which is the whole
 * claim library.tsx makes: search narrows a grid of cards, a card is a
 * picture of what the congregation would see, one click looks and a second
 * gesture shows. A deck is a container of ordered pages exactly as a song is
 * a container of ordered sections, so the card pages in place and the arrows
 * mean the same thing they mean over a chorus.
 *
 * What is genuinely different is that a deck's picture is not ours. A song
 * card draws its own slide and is always ready to; a deck card is waiting on
 * a file somebody handed the church on a memory stick, which LibreOffice has
 * to open and pdftoppm has to render before there is anything to show. So
 * this grid has a state the songs grid does not: a card that is a real deck
 * with a real page count and no picture yet.
 *
 * That state is why `rendered` is a COUNT and not a done/not-done flag. The
 * import converts page one first and returns, then fills in the rest behind
 * the operator's back — so the honest model of a deck mid-import is "nine of
 * forty pages exist", and every part of the card reads off that one number:
 * the picture appears at one, the pager can only reach what has been made,
 * and the line under the name counts up. A boolean would have forced the
 * card to lie in one direction or the other — claiming a deck was ready when
 * page thirty is not there, or blank when page one is.
 */

interface Deck {
  /** The file's own name. Not retitled on import: the operator recognises
      the deck by whatever it was called on the stick it arrived on. */
  paths?: string[];
  title: string;
  pages: number;
  /**
   * How many pages have been rendered to images so far. Reaches `pages` when
   * the import finishes; 0 for a deck that has only just been dropped.
   */
  rendered: number;
  /**
   * What the OCR pass lifted off the slides — the quiet line under the name,
   * where a song card puts its artist. It is the right thing to put there
   * for the same reason the artist is: it settles ties. Two files called
   * "Sunday" are told apart by what is written inside them, not by their
   * names, and the operator is looking for the one about the building fund.
   *
   * Empty until OCR has run, which is after the pages exist.
   */
  excerpt: string;
  /**
   * A few words off the front of the deck, drawn over the wash while there
   * is no picture. The same trick the song card plays with its lyrics: the
   * placeholder shows the WORDS of the thing so the card is already useful
   * to someone scanning for a deck, instead of a grey rectangle with a name
   * under it.
   */
  sample: string[];
  spec: DeckPageSpec;
}

const DECK_SEED: Deck[] = [
  {
    title: 'Sunday Bulletin — 31 Aug',
    pages: 12,
    rendered: 12,
    excerpt: 'welcome · notices · offering · closing',
    sample: ['Welcome to', 'Grace Chapel'],
    spec: {
      title: 'Welcome to Grace Chapel',
      subtitle: 'Sunday 31 August · 9:30 and 11:15',
      sections: [
        { heading: 'This Morning', bullets: ['Welcome and call to worship', 'Songs of praise', 'The reading', 'The message'] },
        { heading: 'Notices', bullets: ['Church picnic — Saturday 12pm', 'Midweek prayer moves to Thursday', 'New members class begins'] },
        { heading: 'Giving', bullets: ['Online at gracechapel.org/give', 'By transfer — details on the card', 'Thank you for your faithfulness'] },
      ],
    },
  },
  {
    title: 'Missions Update August',
    pages: 24,
    rendered: 24,
    excerpt: 'partners in east africa · water project · what your giving did',
    sample: ['Missions Update', 'August 2026'],
    spec: {
      title: 'Missions Update',
      subtitle: 'What your giving did this year',
      sections: [
        { heading: 'Our Partners', bullets: ['Four families, three countries', 'Two church plants under way', 'Medical clinic reopened in March'] },
        { heading: 'The Water Project', bullets: ['Nine wells drilled', 'Two thousand people served', 'Maintenance training completed'] },
        { heading: 'How to Pray', bullets: ['For safety on the northern road', 'For the new believers class', 'For rest for the Okonkwo family'] },
      ],
    },
  },
  {
    title: 'Youth Camp 2026',
    pages: 31,
    rendered: 31,
    excerpt: 'dates, cost, packing list, consent forms due 12 sept',
    sample: ['Youth Camp', '2026'],
    spec: {
      title: 'Youth Camp 2026',
      subtitle: 'Ages 12–17 · 20–24 October',
      sections: [
        { heading: 'The Week', bullets: ['Four nights at Pine Ridge', 'Morning teaching, afternoon sport', 'Evening worship and small groups'] },
        { heading: 'What to Bring', bullets: ['Sleeping bag and pillow', 'Warm layers — it gets cold', 'Bible, notebook, pen', 'No phones after lights out'] },
        { heading: 'Sign Up', bullets: ['Consent forms due 12 September', 'Cost £145, bursaries available', 'Speak to Dami or Ruth'] },
      ],
    },
  },
  {
    /*
     * The case the whole card design turns on: page one is rendered and the
     * other thirty-three are still converting. The picture is real, the
     * pager reaches one page, and the line under the name counts. Nothing
     * about this card is waiting on the rest of the file.
     */
    title: 'Guest Speaker — Dr Adeyemi',
    pages: 34,
    rendered: 1,
    excerpt: '',
    sample: ['The Kingdom', 'and the City'],
    spec: {
      title: 'The Kingdom and the City',
      subtitle: 'Dr Folake Adeyemi · guest series',
      sections: [
        { heading: 'Where We Are Going', bullets: ['The city in Genesis', 'The city in the prophets', 'The city in Revelation'] },
        { heading: 'Three Questions', bullets: ['What is a city for?', 'Who is it for?', 'What does the church owe it?'] },
        { heading: 'This Week', bullets: ['Read Jeremiah 29', 'Notes at the welcome desk', 'Q and A after the service'] },
      ],
    },
  },
  {
    title: 'Church Vision 2026',
    pages: 18,
    rendered: 18,
    excerpt: 'three priorities · the building · what we are asking of you',
    sample: ['Vision 2026'],
    spec: {
      title: 'Vision 2026',
      subtitle: 'Where we believe God is taking us',
      sections: [
        { heading: 'Three Priorities', bullets: ['Deeper roots in the word', 'Wider doors to the neighbourhood', 'Stronger hands for the next lot'] },
        { heading: 'The Building', bullets: ['Roof works finish in November', 'The hall reopens for midweek', 'Accessible entrance at last'] },
      ],
    },
  },
  {
    /* Dropped seconds ago. No picture at all yet — this is the card the
       placeholder exists for, and it is still worth putting on the grid. */
    title: 'Baptism Class Week 3',
    pages: 9,
    rendered: 0,
    excerpt: '',
    sample: ['Baptism Class', 'Week 3 — Buried and Raised'],
    spec: {
      title: 'Buried and Raised',
      subtitle: 'Baptism class · week three of four',
      sections: [
        { heading: 'What Baptism Says', bullets: ['Union with his death', 'Union with his rising', 'A public word, not a private one'] },
        { heading: 'On the Day', bullets: ['Arrive at 9:00', 'Bring a towel and a change', 'Your testimony — two minutes'] },
      ],
    },
  },
  {
    title: 'Tithes and Offering',
    pages: 6,
    rendered: 6,
    excerpt: 'giving details, qr code, gift aid',
    sample: ['Tithes and', 'Offering'],
    spec: {
      title: 'Tithes and Offering',
      subtitle: 'Every gift, every week, goes further than you see',
      sections: [
        { heading: 'Ways to Give', bullets: ['Scan the code on the screen', 'Standing order — forms at the desk', 'Cash in the baskets as they pass'] },
        { heading: 'Gift Aid', bullets: ['Adds 25p to every pound', 'One form covers every gift', 'Ask Tunde in the office'] },
      ],
    },
  },
  {
    title: 'Christmas Carol Service',
    pages: 21,
    rendered: 21,
    excerpt: 'nine lessons · carol order · candle safety',
    sample: ['Nine Lessons', 'and Carols'],
    spec: {
      title: 'Nine Lessons and Carols',
      subtitle: 'Christmas Eve · 6pm and 11pm',
      sections: [
        { heading: 'The Order', bullets: ['Once in Royal David’s City', 'The first lesson — Genesis 3', 'O Come All Ye Faithful'] },
        { heading: 'Candles', bullets: ['Lit from the front, row by row', 'Hold upright, drip guard on', 'Stewards in every aisle'] },
      ],
    },
  },
  {
    title: 'Welcome and Announcements',
    pages: 8,
    rendered: 8,
    excerpt: 'standing weekly deck — edit the dates before use',
    sample: ['Good morning', 'and welcome'],
    spec: {
      title: 'Good Morning and Welcome',
      subtitle: 'Standing deck — update the dates each week',
      sections: [
        { heading: 'If You Are New', bullets: ['Coffee at the back after', 'The welcome desk is by the door', 'Kids church leaves after the songs'] },
        { heading: 'This Week', bullets: ['Prayer meeting — Wednesday 7pm', 'Men’s breakfast — Saturday 8am', 'Sunday next — communion'] },
      ],
    },
  },
];

interface QuickSlideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (deck: Deck) => void;
}

function QuickSlideModal({ isOpen, onClose, onCreate }: QuickSlideModalProps) {
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [align, setAlign] = useState<'left' | 'center' | 'right'>('center');

  const titleRef = useRef<HTMLInputElement>(null);
  /* Each open starts clean. */
  useEffect(() => {
    if (!isOpen) return;
    setTitle('');
    setSubtitle('');
    setBodyText('');
    setAlign('center');
    /* The caret goes to the title once the box has landed. */
    const t = setTimeout(() => titleRef.current?.focus(), 380);
    return () => clearTimeout(t);
  }, [isOpen]);

  const handleCreate = () => {
    if (!title.trim()) return;
    const bullets = bodyText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    const newDeck: Deck = {
      title: title.trim(),
      pages: 1,
      rendered: 1,
      excerpt: subtitle.trim() || 'quick presentation slide',
      sample: [title.trim(), subtitle.trim()].filter(Boolean),
      spec: {
        title: title.trim(),
        subtitle: subtitle.trim() || undefined,
        sections: bullets.length > 0 ? [{ heading: '', bullets }] : [],
      },
    };

    onCreate(newDeck);
    onClose();
  };

  const input =
    'tri-rounded-control w-full border-0 bg-[rgb(0_0_0_/_0.20)] px-3.5 text-[length:var(--tri-control-size)] text-[var(--tri-ink)] placeholder:text-[rgb(229_243_242_/_0.34)] focus:outline-none focus:shadow-[inset_0_0_0_var(--tri-border)_rgb(var(--tri-go-2)_/_0.45)]';

  /* The brand's own opening, fields and buttons — see songs/FlightPopup. */
  return (
    <FlightPopup
      open={isOpen}
      size={{ w: 520, h: 500 }}
      label="quick slide"
      onRequestClose={onClose}
      header={
        <div>
          <h2 className="text-[20px] font-semibold tracking-tight text-[var(--tri-ink)]">quick slide</h2>
          <p className="mt-1 text-[length:var(--tri-size-xs)] leading-relaxed text-[rgb(229_243_242_/_0.5)]">
            a title, a line under it, and a few points. it joins your decks as a one-page slide.
          </p>
        </div>
      }
      footer={
        <footer className="flex shrink-0 justify-end px-6 pb-5">
          <Button label="create slide" tone="go" icon={<SparkleIcon size={12} />} disabled={!title.trim()} onClick={handleCreate} />
        </footer>
      }
    >
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-6 pb-4 pt-4">
        <input ref={titleRef} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="title — welcome to church" aria-label="slide title" className={cx(input, 'h-[var(--tri-field-h)] shrink-0')} />
        <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="line under it (optional) — sunday service · 10:00" aria-label="subtitle" className={cx(input, 'h-[var(--tri-field-h)] shrink-0')} />
        <SegmentedControl
          label="alignment"
          size="sm"
          options={[
            { id: 'left', label: 'left' },
            { id: 'center', label: 'centre' },
            { id: 'right', label: 'right' },
          ]}
          value={align}
          onChange={setAlign}
        />
        <textarea
          value={bodyText}
          onChange={(e) => setBodyText(e.target.value)}
          placeholder="points or notes, one per line (optional)"
          aria-label="points"
          className={cx(input, 'min-h-[88px] flex-1 resize-none py-3 leading-[1.55]')}
        />
      </div>
    </FlightPopup>
  );
}

const DECKS = DECK_SEED.map((deck, i) => ({ ...deck, id: `deck-${i}`, seed: i }));
type LoadedDeck = (typeof DECKS)[number];

export function SlidesBrowser() {
  const drag = useDrag();
  const projector = useProjector();
  const [query, setQuery] = useState('');
  const [importNote, setImportNote] = useState<string | null>(null);
  const [quickModalOpen, setQuickModalOpen] = useState(false);
  const [customDecks, setCustomDecks] = useState<LoadedDeck[]>(() => {
    try {
      const raw = localStorage.getItem('trilorah_custom_presentation_decks');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [importedDecks, setImportedDecks] = useState<LoadedDeck[]>([]);
  useEffect(() => {
    const reload = () => setCustomDecks(readTriLocal<LoadedDeck[]>(TRI_DECKS_KEY, []));
    window.addEventListener(TRI_DECKS_EVENT, reload);
    return () => window.removeEventListener(TRI_DECKS_EVENT, reload);
  }, []);
  useEffect(() => {
    const reload = () => { void window.api?.loadPresentations().then(items => setImportedDecks(items.map(d => ({
      id: d.id, title: d.title, paths: d.slides, pages: d.slides.length, rendered: d.slides.length,
      seed: 0, excerpt: '', sample: [], spec: { title: d.title, sections: [] },
    })))).catch(() => setImportNote('Could not load presentations. Try reopening Slides.')); };
    reload();
    window.addEventListener('presentations-updated', reload);
    return () => window.removeEventListener('presentations-updated', reload);
  }, []);
  const allDecks = useMemo(() => [...importedDecks, ...customDecks, ...(isEmptyPreview ? [] : DECKS)], [importedDecks, customDecks]);

  const handleCreateQuickDeck = (deck: Deck) => {
    const loaded: LoadedDeck = {
      ...deck,
      id: `custom-deck-${Date.now()}`,
      seed: Math.floor(Math.random() * 100),
    };
    setCustomDecks((prev) => {
      const updated = [loaded, ...prev];
      try {
        localStorage.setItem('trilorah_custom_presentation_decks', JSON.stringify(updated));
      } catch {}
      return updated;
    });
    window.dispatchEvent(new Event('trilorah-library-changed'));
  };

  /* Which page each card is showing, once paged off its first. Sparse and
     keyed by deck, exactly as the songs grid keeps its verses: filter the
     grid and come back, and the card is where it was left. */
  const [pageAt, setPageAt] = useState<Record<string, number>>({});
  useEffect(() => {
    const item = projector.preview;
    if (item?.deckId && item.deckIndex != null) setPageAt(current => ({ ...current, [item.deckId!]: item.deckIndex! }));
  }, [projector.preview]);
  const pageOf = (deck: LoadedDeck) => Math.min(pageAt[deck.id] ?? 0, Math.max(0, deck.rendered - 1));
  const stepPage = (deck: LoadedDeck, delta: -1 | 1) =>
    setPageAt((m) => {
      const cur = m[deck.id] ?? 0;
      const next = Math.min(deck.rendered - 1, Math.max(0, cur + delta));
      return next === cur ? m : { ...m, [deck.id]: next };
    });

  const searchRow = useRef<HTMLDivElement>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const importSlides = () => {
    setImportNote('importing…');
    void importAndSavePresentation().then(deck => {
      setImportNote(deck ? `Imported ${deck.slides.length} slides. Select the deck to preview.` : null);
    }).catch(error => setImportNote(error instanceof Error ? error.message : 'Import failed. Try another file.'));
  };

  const needle = query.trim().toLowerCase();
  const matches = useMemo(
    () =>
      allDecks.filter((d) => {
        if (needle === '') return true;
        const hay = [
          d.title,
          d.excerpt,
          ...d.sample,
          d.spec.title,
          d.spec.subtitle ?? '',
          ...d.spec.sections.flatMap((s) => [s.heading, ...s.bullets]),
        ]
          .join(' ')
          .toLowerCase();
        return hay.includes(needle);
      }),
    [needle, allDecks],
  );

  const sel = useLibrarySelection({
    items: matches,
    source: 'presentation',
    idOf: (d) => `${d.id}:${pageOf(d)}`,
    labelOf: (d) => `${d.title} — slide ${pageOf(d) + 1}`,
    contentOf: d => {
      const paths = d.paths ?? Array.from({ length: d.rendered }, (_, i) => deckPage(d.seed, i, d.spec));
      return { path: paths[pageOf(d)], deckPaths: paths, deckIndex: pageOf(d), deckId: d.id, title: d.title, mediaKind: 'photo', origin: 'operator' };
    },
    selectFirst: false,
  });

  return (
    <>
      <QuickSlideModal
        isOpen={quickModalOpen}
        onClose={() => setQuickModalOpen(false)}
        onCreate={handleCreateQuickDeck}
      />
      <LibraryBrowser
        gap={16}
        search={
          searchOpen || allDecks.length === 0 || importNote ? <div ref={searchRow} className="flex min-w-0 flex-1 items-center gap-3">
            {searchOpen || allDecks.length === 0 ? (
            <LibrarySearch disabled={allDecks.length === 0}>
            <SearchField
              value={query}
              onChange={setQuery}
              placeholder="type a deck name or anything written on a slide..."
            />
            </LibrarySearch>
            ) : null}
            {/* What the import said, where the "import slides" card used to
                say it. Only while there is something to say. */}
            {importNote ? (
              <span className="max-w-[45%] shrink-0 truncate text-[length:var(--tri-size-xs)] lowercase text-[var(--tri-ink-muted)]">
                {importNote}
              </span>
            ) : null}
          </div> : null
        }
        dock={
          <LibraryToolbar
            label="presentations"
            searchActions={[
              {
                id: 'search',
                label: 'search slides',
                disabled: allDecks.length === 0,
                text: 'search slides',
                icon: <SearchIcon size={13} />,
                active: searchOpen,
                onClick: () => {
                  setSearchOpen(!searchOpen);
                  if (searchOpen) setQuery('');
                  else requestAnimationFrame(() => searchRow.current?.querySelector('input')?.focus());
                },
              },
            ]}
            actions={[
              {
                id: 'import',
                label: window.api?.importPresentation ? 'import slides — pptx, ppt or odp' : 'importing slides needs the desktop app',
                text: 'import slides',
                icon: <ImportIcon size={13} />,
                disabled: !window.api?.importPresentation,
                onClick: importSlides,
              },
              {
                id: 'quick',
                label: 'quick slide — a title, a line under it, and where they sit',
                text: 'quick slide',
                icon: <PresentationIcon size={13} />,
                onClick: () => setQuickModalOpen(true),
              },
            ]}
          />
        }
      >
        <LibraryPane header={false}>
          {matches.length === 0 ? (
            <EmptyMark w={220} h={220} plain art={<PresentationEmptyArt />}
              line={allDecks.length === 0 ? 'no presentations yet' : 'nothing matches'}
              hint={allDecks.length === 0 ? 'import a deck or create your first slide' : 'try a different deck name or a line from a slide'}
              below={<div className="mt-4 flex gap-2">
                {allDecks.length === 0 ? <>
                  {window.api?.importPresentation && <Button label="import slides" icon={<ImportIcon size={14} />} onClick={importSlides} />}
                  <Button label="quick slide" tone="go" icon={<PresentationIcon size={14} />} onClick={() => setQuickModalOpen(true)} />
                </> : <Button label="clear search" onClick={() => setQuery('')} />}
              </div>}
            />
          ) : (
            <div ref={sel.listRef}>
              <div
                className="grid auto-rows-min grid-cols-4 gap-4 px-4 pb-1"
              >
              {matches.map((deck, i) => {
                const at = pageOf(deck);
                const ready = deck.rendered > 0;
                const importing = deck.rendered < deck.pages;
                const live = sel.isLive(i);
                const selected = sel.preview === i;
                const preview = ready ? (deck.paths ? presentationImageSrc(deck.paths[at]) : deckPage(deck.seed, at, deck.spec)) : undefined;
                return (
                  <div
                    key={deck.id}
                    {...drag.bind(() => ({
                      source: 'presentation' as const,
                      label: `${deck.title} — slide ${at + 1}`,
                      /* The chip carries the page itself. A deck dragged
                         into the run is unrecognisable as a word — every
                         deck's name is a date or a noun — and completely
                         recognisable as a picture. */
                      preview,
                    }))}
                    className="group/card pb-3 transition-transform duration-150 ease-out hover:-translate-y-[2px]"
                    style={{ boxShadow: 'inset 0 -1px 0 rgb(255 255 255 / 0.08)' }}
                  >
                    <SlideThumb
                      index={i}
                      label={deck.title}
                      /* The real first page the moment there is one. Until
                         then the wash carries the words off the front of the
                         deck, as the song card carries its verse. */
                      preview={preview}
                      stanzas={ready ? undefined : [deck.sample]}
                      backdropStyle={BACKDROP_BY_CONTENT.presentation}
                      /* Only what exists can be paged to. A count of 34 over
                         a deck with one rendered page would put the operator
                         on an arrow that does nothing. */
                      pager={
                        deck.rendered > 1
                          ? {
                              at,
                              count: deck.rendered,
                              onStep: (delta) => stepPage(deck, delta),
                            }
                          : undefined
                      }
                      /* The count, held on the picture, for a card that has
                         no pager to hold it: this is a real file of a known
                         length whose pages are on their way. */
                      badge={ready ? undefined : `${deck.pages} slides`}
                      showCaption={false}
                      selected={selected}
                      live={live}
                      onSelect={() => { if (ready) sel.setPreview(i); }}
                      onSend={() => { if (ready) sel.send(i); }}
                    />

                    {/*
                      Name over what is written inside it — the song card's
                      two lines exactly, with the artist's slot doing the
                      same job for a different noun. The name is the file's,
                      set in the same weight and colour, and it goes gold on
                      the one card that is on the projector.
                    */}
                    <div className="mt-2 px-0.5" title={deck.excerpt ? `${deck.title} — ${deck.excerpt}` : deck.title}>
                      <p
                        className={cx(
                          'truncate text-[length:var(--tri-size-sm)] font-semibold leading-[1.25] transition-colors',
                          live
                            ? 'text-[var(--tri-accent-yellow)]'
                            : selected
                              ? 'text-[var(--tri-ink)]'
                              : 'text-[rgb(229_243_242_/_0.86)] group-hover/card:text-[var(--tri-ink)]',
                        )}
                      >
                        {deck.title}
                      </p>
                      {/*
                        Three things want this line and only one can have it,
                        so they are ranked by how long they last. A deck that
                        is still converting says so and counts, because that
                        is the only line on the card that changes and the
                        operator is waiting on it. A finished deck gives up
                        the progress it no longer has and shows its words —
                        which is what the line is for the rest of the deck's
                        life. A deck whose OCR has not landed falls back to
                        its length, which is at least true.
                      */}
                      <p className="mt-[2px] truncate text-[length:var(--tri-size-xs)] leading-[1.3] text-[rgb(229_243_242_/_0.42)]">
                        {importing
                          ? `converting · ${deck.rendered} of ${deck.pages}`
                          : deck.excerpt || `${deck.pages} slides`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </LibraryPane>
    </LibraryBrowser>
  </>
);
}
