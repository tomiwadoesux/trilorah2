import { useMemo, useState } from 'react';
import { AddCard, BACKDROP_BY_CONTENT, SearchField, SlideThumb, cx } from '../../ui';
import { LibraryBrowser, LibraryPane, useLibrarySelection } from './library';
import { useDrag } from './drag';
import { deckPage, type DeckPageSpec } from './deckPage';

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

  if (!isOpen) return null;

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-white/15 bg-[rgb(16_22_24)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h3 className="text-[15px] font-semibold text-white">Quick Slide Maker</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-white/40 hover:bg-white/10 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-3.5 p-5">
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-white/60">
              Slide Header / Title
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Welcome to Church"
              className="w-full rounded-xl border border-white/15 bg-black/40 px-3.5 py-2 text-[13px] text-white placeholder:text-white/25 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-white/60">
              Subheader (optional)
            </label>
            <input
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="e.g. Sunday Morning Service · 10:00 AM"
              className="w-full rounded-xl border border-white/15 bg-black/40 px-3.5 py-2 text-[13px] text-white placeholder:text-white/25 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-white/60">
              Text Alignment
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['left', 'center', 'right'] as const).map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAlign(a)}
                  className={cx(
                    'rounded-lg border py-1.5 text-[12px] font-medium capitalize transition-colors',
                    align === a
                      ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                      : 'border-white/10 bg-white/5 text-white/60 hover:text-white',
                  )}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-white/60">
              Bullets or Announcement Notes (optional)
            </label>
            <textarea
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              rows={3}
              placeholder="Enter bullet points (one per line)..."
              className="w-full resize-none rounded-xl border border-white/15 bg-black/40 p-3 text-[12px] leading-relaxed text-white placeholder:text-white/25 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <button
            type="button"
            disabled={!title.trim()}
            onClick={handleCreate}
            className="mt-2 flex items-center justify-center rounded-xl bg-emerald-500 px-4 py-2.5 text-[13px] font-semibold text-black hover:bg-emerald-400 disabled:opacity-40 transition-colors shadow-md"
          >
            Create Slide
          </button>
        </div>
      </div>
    </div>
  );
}

const DECKS = DECK_SEED.map((deck, i) => ({ ...deck, id: `deck-${i}`, seed: i }));
type LoadedDeck = (typeof DECKS)[number];

export function SlidesBrowser() {
  const drag = useDrag();
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

  const allDecks = useMemo(() => [...customDecks, ...DECKS], [customDecks]);

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
  };

  /* Which page each card is showing, once paged off its first. Sparse and
     keyed by deck, exactly as the songs grid keeps its verses: filter the
     grid and come back, and the card is where it was left. */
  const [pageAt, setPageAt] = useState<Record<string, number>>({});
  const pageOf = (deck: LoadedDeck) => Math.min(pageAt[deck.id] ?? 0, Math.max(0, deck.rendered - 1));
  const stepPage = (deck: LoadedDeck, delta: -1 | 1) =>
    setPageAt((m) => {
      const cur = m[deck.id] ?? 0;
      const next = Math.min(deck.rendered - 1, Math.max(0, cur + delta));
      return next === cur ? m : { ...m, [deck.id]: next };
    });

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
    idOf: (d) => d.id,
    labelOf: (d) => `${d.title} — slide ${pageOf(d) + 1}`,
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
        framed
        search={
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder="type a deck name or anything written on a slide..."
          />
        }
      >
        <LibraryPane header={false}>
          {matches.length === 0 ? (
            <div className="flex h-full items-center justify-center px-5">
              <p className="text-[length:var(--tri-size-xs)] lowercase text-[rgb(229_243_242_/_0.38)]">
                nothing matches
              </p>
            </div>
          ) : (
            <div ref={sel.listRef}>
              <div className="grid auto-rows-min grid-cols-5 gap-x-3 gap-y-4 px-5 pt-4 pb-5">
                {needle === '' ? (
                  <>
                    <AddCard
                      label="quick slide"
                      hint="header, subheader & layout"
                      onClick={() => setQuickModalOpen(true)}
                    />
                    <AddCard
                      label="import slides"
                      hint={importNote ?? 'pptx, ppt or odp'}
                      onClick={() => {
                        setImportNote('importing…');
                        void window.api
                          ?.importPresentation()
                          .then((res) =>
                            setImportNote(
                              res?.success
                                ? `imported ${res.data?.slides?.length ?? 0} slides — open them in the MEDIA tab`
                                : res?.error === 'Cancelled'
                                  ? null
                                  : (res?.error ?? 'import failed'),
                            ),
                          )
                          .catch(() => setImportNote('import failed'));
                      }}
                    />
                  </>
                ) : null}

              {matches.map((deck, i) => {
                const at = pageOf(deck);
                const ready = deck.rendered > 0;
                const importing = deck.rendered < deck.pages;
                const live = sel.isLive(i);
                const selected = sel.preview === i;
                const preview = ready ? deckPage(deck.seed, at, deck.spec) : undefined;
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
                      onSelect={() => sel.setPreview(i)}
                      onSend={() => sel.send(i)}
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
