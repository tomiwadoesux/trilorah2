import type { ReactNode } from 'react';
import { Sheet, Group, Stage, Note, Spec } from '../Sheet';
import { Panel } from '../screens/parts';
import { HistoryIcon } from '../../ui/icons';
import {
  EmptyMark,
  ListeningArt,
  ChartArt,
  TranscriptArt,
  CompanionArt,
  KeptArt,
} from '../screens/emptyArt';
import { LayeredProgrammeArt } from '../screens/run/LayeredProgrammeArt';
import { ScriptureQuoteArt } from '../screens/ScriptureQuoteArt';
import { SongRackArt } from '../screens/SongRackArt';
import { LibraryEmptyPreview } from './LibraryEmptyPreview';
import { NotificationBellArt } from '../screens/NotificationBellArt';
import { SermonOutlineArt } from '../screens/SermonOutlineArt';

/*
 * D-30 — every empty state in one place.
 *
 * An empty state is the first thing a new church sees and the thing the
 * booth stares at for the ten minutes before a service starts, so these
 * are not edge cases — for a fresh install they ARE the app.
 *
 * WHY NOT AN ICON. The obvious move is a big icon over a line of text, and
 * it is the move every app makes: a grey glyph in a grey box, interchangeable
 * between products. This app already has its own way of drawing — the
 * wireframe traces in CardArt (thin non-scaling lines, graded stroke
 * opacity, a dashed line for the thing that is absent) and the dot fields of
 * the orb. So each state here is drawn in THAT language instead, and each
 * drawing is the empty version of the very thing the panel holds: the run
 * rail shows empty slots waiting for segments, the catches panel shows a
 * flat line that never spiked, the song grid shows a grid gone dark. You are
 * not looking at a symbol FOR the content, you are looking at the content's
 * own skeleton with nothing in it.
 */

/** A region at the size it really occupies, so the surrounding void is honest. */
function Region({
  label,
  w,
  h,
  children,
}: {
  label: string;
  w: number | string;
  h: number;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="font-mono text-[10px] tracking-wide text-neutral-400">{label}</div>
      <div style={{ width: w, height: h }}>{children}</div>
    </div>
  );
}

export function EmptyStates() {
  return (
    <Sheet
      id="D-30"
      title="Empty states"
      status="draft"
      summary="Every region of the app with nothing in it yet, at the size it really occupies. Not a stock icon over a sentence — each one is the panel's own content drawn as an empty wireframe, in the same line language as the dashboard's card art."
    >
      <Group title="Library empty states" hint="scripture, songs, and presentations · visible search, disabled while empty">
        <LibraryEmptyPreview />
      </Group>
      <Group
        title="First run"
        hint="a fresh install, nothing configured, nobody listening — the actual first screen"
      >
        <Stage>
          <div className="flex gap-4">
            <Region label="run rail · 352 × 470" w={352} h={470}>
              <Panel title="run of service (0)" className="h-full">
                <EmptyMark
                  art={<LayeredProgrammeArt />}
                  w={220}
                  h={220}
                  plain
                  line="nothing in the run yet"
                  hint="use + to build one, or the clock for the default order"
                />
              </Panel>
            </Region>
            <Region label="catches · 352 × 330 · engine idle" w={352} h={330}>
              <Panel className="h-full" bodyClass="pt-3">
                <EmptyMark
                  art={<ScriptureQuoteArt />}
                  w={220}
                  h={220}
                  plain
                  line="verses caught land here"
                  hint="start listening and catches land here"
                />
              </Panel>
            </Region>
            <Region label="recent services · 352 × 330" w={352} h={330}>
              <Panel
                title="recent services"
                icon={<HistoryIcon size={13} />}
                className="h-full"
                bodyClass="pt-3"
              >
                <EmptyMark art={<ChartArt />} line="no services recorded yet" />
              </Panel>
            </Region>
          </div>
        </Stage>
      </Group>

      <Group
        title="Empty on purpose"
        hint="the service is running and these are meant to be empty — a waiting state, not a missing one"
      >
        <Stage>
          <div className="flex gap-4">
            <Region label="catches · listening, nothing yet" w={352} h={330}>
              <Panel className="h-full" bodyClass="pt-3">
                <EmptyMark art={<ListeningArt />} line="listening — nothing caught yet" />
              </Panel>
            </Region>
            <Region label="songs · query matches nothing" w={352} h={330}>
              <Panel className="h-full" bodyClass="pt-3">
                <EmptyMark
                  art={<SongRackArt />}
                  w={220}
                  h={220}
                  plain
                  line="nothing matches"
                  hint="try a line of the words instead"
                />
              </Panel>
            </Region>
          </div>
        </Stage>
      </Group>

      <Group
        title="Idle against listening"
        hint="the same panel, two states — the difference has to be visible from the booth"
      >
        <Stage>
          <div className="flex gap-4">
            <Region label="not listening · quotation marks" w={352} h={330}>
              <Panel className="h-full" bodyClass="pt-3">
                <EmptyMark w={220} h={220} plain art={<ScriptureQuoteArt />} line="verses caught land here" />
              </Panel>
            </Region>
            <Region label="listening · the field is live" w={352} h={330}>
              <Panel className="h-full" bodyClass="pt-3">
                <EmptyMark art={<ListeningArt />} line="listening — nothing caught yet" />
              </Panel>
            </Region>
          </div>
        </Stage>
      </Group>

      <Group
        title="The rest of the dashboard"
        hint="five more cards, each drawn as its own content with nothing in it"
      >
        <Stage>
          <div className="flex flex-wrap gap-4">
            <Region label="preacher transcript · 352 × 300" w={352} h={300}>
              <Panel title="preacher transcript" className="h-full" bodyClass="pt-3">
                <EmptyMark
                  art={<TranscriptArt />}
                  line="nothing heard yet"
                  hint="start listening and the sermon lands here"
                />
              </Panel>
            </Region>
            <Region label="notifications · 352 × 300" w={352} h={300}>
              <Panel title="notifications" className="h-full" bodyClass="pt-3">
                <EmptyMark
                  art={<NotificationBellArt />}
                  w={170} h={170} plain
                  line="all quiet for now"
                  hint="what the service does will be kept here"
                />
              </Panel>
            </Region>
            <Region label="sermon notes · 352 × 300" w={352} h={300}>
              <Panel title="sermon notes" className="h-full" bodyClass="pt-3">
                <EmptyMark
                  art={<SermonOutlineArt />}
                  w={170} h={170} plain
                  line="no outline yet"
                  hint="the engine builds it as the sermon is preached"
                />
              </Panel>
            </Region>
            <Region label="companion · 300 × 300" w={300} h={300}>
              <Panel title="companion" className="h-full" bodyClass="pt-3">
                <EmptyMark art={<CompanionArt />} w={150} h={150} line="no code yet" hint="starts when you open the service" />
              </Panel>
            </Region>
            <Region label="the kept room · 352 × 240" w={352} h={240}>
              {/* The one card with a title of its own rather than a blank
                  header: a card whose header band is empty where every
                  sibling has one is the thing that reads as a render that
                  failed halfway. A word in it makes the emptiness a
                  decision someone took. */}
              <Panel title="kept" className="h-full" bodyClass="pt-3">
                <EmptyMark art={<KeptArt />} line="room kept for what this band needs next" />
              </Panel>
            </Region>
          </div>
        </Stage>
      </Group>

      <Group title="Against the old one" hint="text alone, then the drawing, same region">
        <Stage>
          <div className="flex gap-4">
            <Region label="before · text only" w={352} h={330}>
              <Panel className="h-full" bodyClass="pt-3">
                <div className="flex h-full items-center justify-center px-4 text-center">
                  <span className="text-[length:var(--tri-size-xs)] leading-relaxed text-[rgb(229_243_242_/_0.3)]">
                    nothing in the run yet — use + to build one, or the clock for the default order
                  </span>
                </div>
              </Panel>
            </Region>
            <Region label="after · the rail, drawn empty" w={352} h={330}>
              <Panel className="h-full" bodyClass="pt-3">
                <EmptyMark
                  art={<LayeredProgrammeArt />}
                  w={220}
                  h={220}
                  plain
                  line="nothing in the run yet"
                  hint="use + to build one, or the clock for the default order"
                />
              </Panel>
            </Region>
          </div>
        </Stage>
      </Group>

      <Group title="What each one says" hint="the copy, split into the state and the way out">
        <Spec
          rows={[
            ['run rail', 'nothing in the run yet · use + to build one, or the clock for the default order'],
            ['catches · idle', 'not listening yet · start listening and catches land here'],
            ['catches · listening', 'listening — nothing caught yet'],
            ['songs · no match', 'nothing matches · try a line of the words instead'],
            ['recent services', 'no services recorded yet'],
            ['preacher transcript', 'nothing heard yet · start listening and the sermon lands here'],
            ['notifications', 'nothing has happened yet · what the service does will be kept here'],
            ['sermon notes', 'no outline yet · the engine builds it as the sermon is preached'],
            ['companion', 'no code yet · starts when you open the service'],
            ['the kept room', 'room kept for what this band needs next'],
          ]}
        />
      </Group>

      <Note>
        <strong>Two house numbers, because the viewBox lies.</strong> Every drawing is authored in a
        150&times;92 box and rendered into 190&times;112, so one unit is about 1.27px on screen.
        That makes two rules hard: keep gaps at <strong>4 units or more</strong> or hairlines mush
        into one grey smear, and keep <code>strokeOpacity</code> at <strong>0.13 or more</strong> or
        the wrapper&rsquo;s own 0.72 takes it under the floor where a 1px line stops rendering on a
        dark panel at a booth&rsquo;s viewing angle. Three marks in the first pass were below that
        floor and simply were not there.
      </Note>

      <Note>
        <strong>Faint data is still data.</strong> The rule that decided half the choices here: a
        drawing cannot buy its way out of looking like content by getting dimmer, because the
        objection is about <em>kind</em>, not brightness. A faint solid wobble over the catches
        baseline is a waveform, and a waveform in that panel says the mic is open when it is not. A
        faint filled pip on a run-of-service row is a slide count. Only the dash says absent, so
        anything that cannot carry a dash cannot carry absence — which is why the run rail&rsquo;s
        slide count is a dashed stub rather than three dots, and why the companion draws no finder
        patterns at all.
      </Note>

      <Note>
        <strong>Waiting, not loading.</strong> Every drawing moves, and none of it is a spinner. A
        spinner says &ldquo;work is happening, stand by&rdquo;; these panels are not working, they
        are ready and unused, so the motion is slow (4–14s), low-amplitude and never resolves. The
        run rail&rsquo;s dashes crawl like a held-open placeholder, the idle baseline gets one
        scanning sweep, the song grid dims left to right as if a search ran the row and found
        nothing, and the chart&rsquo;s columns rehearse the rise they will have once services
        exist. All CSS on geometry that is already drawn — transforms, opacity and dash offset, no
        timers and no re-renders, so a panel costs nothing to leave up for the ten minutes before a
        service.
      </Note>

      <Note>
        <strong>The listening field is the only thing that twinkles.</strong> It is the one state
        here where something really is happening — the engine is up and hearing a room. Each dot
        carries its own period and phase, taken from the same seeded scatter that places it, so no
        two are ever in step: a field blinking together would read as a strobe, one drifting
        independently reads as noise being heard. Idle and listening share the sweep gesture but
        not its rate, because from the booth you read &ldquo;faster&rdquo; before
        &ldquo;brighter&rdquo;.
      </Note>

      <Note>
        <strong>Why not an icon.</strong> A large glyph over a sentence is what every app does, and
        it is interchangeable between them — a grey book in a grey box could belong to any product.
        These drawings are the panel&rsquo;s own content with nothing in it: slots waiting for
        segments, a waveform that never spiked, a song grid gone dark, an axis with no line yet. The
        operator is looking at the shape the panel will take once it fills, which is a better answer
        to &ldquo;what goes here&rdquo; than a symbol is.
      </Note>

      <Note>
        <strong>Dashed means absent.</strong> Borrowed from <code>CardArt</code>&rsquo;s outermost
        orbit: a solid line is a thing that exists, a dashed one is a place where a thing will go.
        So the first run-of-service slot is solid and the two under it are dashed, and the catches
        panel draws the spikes it has not had as dashes rather than leaving the space blank —
        blank says &ldquo;this panel is short&rdquo;, dashed says &ldquo;this panel is waiting&rdquo;.
      </Note>

      <Note>
        <strong>Idle and listening are different pictures.</strong> Every other empty state in the
        app says the same thing whether the engine is running or not. Here the flat line means no
        signal and the drifting field means the engine is up and nothing has come yet — the orb
        already uses that field to mean exactly that, so the two surfaces agree.
      </Note>

      <Note>
        <strong>Still open.</strong> <code>EmptyState</code> in <code>components/ui.tsx</code> is
        italic neutral-400 and still backs eleven regions in <code>src/screens/</code>, and{' '}
        <code>TimersTile</code> / <code>PreachersTile</code> have no empty branch at all. Both need
        a decision before this shape can go in everywhere.
      </Note>

      <Note>
        <strong>Under reduced motion it all stops.</strong> Not shortened, not softened — removed.
        The test is whether the movement carries information the drawing and the sentence do not,
        and here it does not: every state is fully told standing still. That is what makes the
        motion safe to have at all.
      </Note>
    </Sheet>
  );
}
