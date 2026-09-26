import { useState } from 'react';
import { cx, surface, Button, CheckIcon, PlusIcon } from '../../../ui';
import { Panel, Pill } from '../parts';
import { Expandable } from './expand';
import { FIELD, Toggle } from '../settingsRows';

/*
 * Voice commands — what the pastor can say to the app, and what the app
 * has noticed the pastor saying.
 *
 * Two lists, and the second is the interesting one. The first is the
 * phrases: per command, what it listens for, add one, see them. The second
 * is what the engine caught on its own: during a service it watches the
 * operator as well as the pastor, and when the pastor says the same thing
 * and the operator presses NEXT within a beat of it — four times — that is
 * a command the pastor already has, just not one anyone wrote down. It
 * lands here as a suggestion. The operator accepts it or not; nothing is
 * learned silently, because a phrase that fires a verse change is not the
 * kind of thing to be surprised by mid-sermon.
 *
 * A pastor with a profile gets the suggestion in their own training
 * dashboard instead. A guest, or a pastor too new to have one, gets it here
 * — this tile is the profile they do not have yet.
 */

interface Command {
  id: string;
  label: string;
  phrases: string[];
}

const COMMANDS: Command[] = [
  { id: 'next', label: 'next verse', phrases: ['next verse', 'the next verse', 'verse after that', 'go on'] },
  { id: 'previous', label: 'previous verse', phrases: ['go back', 'previous verse', 'the verse before'] },
  { id: 'clear', label: 'clear the screen', phrases: ['clear the screen', 'take that down'] },
  { id: 'correction', label: 'correction', phrases: ['I meant', 'I said', 'not that one'] },
  { id: 'version', label: 'change version', phrases: ['in the NIV', 'read it in the', 'the King James says'] },
];

interface Suggestion {
  id: string;
  heard: string;
  action: 'next' | 'previous';
  times: number;
  /** Who it was heard from — a guest has no profile to put it in. */
  preacher: string;
  guest: boolean;
}

const NOTICED: Suggestion[] = [
  { id: 's1', heard: "let's keep reading", action: 'next', times: 4, preacher: 'bro. femi', guest: true },
  { id: 's2', heard: 'look at that again', action: 'previous', times: 3, preacher: 'bro. femi', guest: true },
];

const MUTED = 'rgb(229 243 242 / 0.45)';

function Chip({ children, onRemove }: { children: string; onRemove?: () => void }) {
  return (
    <span className="group/chip inline-flex items-center gap-1 rounded-full bg-[rgb(255_255_255_/_0.06)] py-[3px] pl-2.5 pr-1.5 text-[length:var(--tri-size-xs)] lowercase text-[rgb(229_243_242_/_0.8)]">
      "{children}"
      {onRemove && (
        <button type="button" onClick={onRemove} title="remove" className="grid size-[14px] place-items-center rounded-full text-[rgb(229_243_242_/_0.35)] opacity-0 transition-opacity hover:text-[var(--tri-ink)] group-hover/chip:opacity-100">
          <PlusIcon size={8} className="rotate-45" />
        </button>
      )}
    </span>
  );
}

function SuggestionRow({ s, onAccept, onDismiss }: { s: Suggestion; onAccept: () => void; onDismiss: () => void }) {
  return (
    <div className={cx(surface({ tone: 'indigo', shape: 'panel', wide: true }), 'group/sug flex items-center gap-2.5 px-2.5 py-2')} style={{ borderRadius: 10 }}>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[length:var(--tri-size-xs)] text-[var(--tri-ink)]">
          "{s.heard}" <span style={{ color: MUTED }}>→ {s.action === 'next' ? 'next verse' : 'previous verse'}</span>
        </p>
        <p className="truncate text-[length:var(--tri-size-eyebrow)] lowercase" style={{ color: MUTED }}>
          {s.preacher} · you pressed {s.action} within a beat, {s.times} times
        </p>
      </div>
      <button type="button" onClick={onAccept} title="make it a command" className={cx(surface({ tone: 'default', interactive: true }), 'grid size-[22px] place-items-center text-[#8fd3c0] opacity-0 transition-opacity group-hover/sug:opacity-100 focus-visible:opacity-100')} style={{ borderRadius: 7 }}>
        <CheckIcon size={11} />
      </button>
      <button type="button" onClick={onDismiss} title="not a command" className={cx(surface({ tone: 'ash', interactive: true }), 'grid size-[22px] place-items-center text-[rgb(229_243_242_/_0.45)] opacity-0 transition-opacity group-hover/sug:opacity-100 focus-visible:opacity-100')} style={{ borderRadius: 7 }}>
        <PlusIcon size={10} className="rotate-45" />
      </button>
    </div>
  );
}

function PhraseEditor() {
  const [commands, setCommands] = useState(COMMANDS);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const add = (id: string) => {
    const text = (drafts[id] ?? '').trim();
    if (!text) return;
    setCommands((cs) => cs.map((c) => (c.id === id ? { ...c, phrases: [...c.phrases, text] } : c)));
    setDrafts((d) => ({ ...d, [id]: '' }));
  };
  const remove = (id: string, phrase: string) =>
    setCommands((cs) => cs.map((c) => (c.id === id ? { ...c, phrases: c.phrases.filter((p) => p !== phrase) } : c)));

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between py-4" style={{ boxShadow: 'inset 0 -1px 0 rgb(255 255 255 / 0.06)' }}>
        <div>
          <div className="text-[length:var(--tri-size)] font-semibold text-[var(--tri-ink)]">Voice commands</div>
          <p className="mt-1 text-[length:var(--tri-size-xs)] text-[rgb(229_243_242_/_0.5)]">Recognised from the pastor's own speech. Off, and the app only listens for scripture.</p>
        </div>
        <Toggle on onChange={() => undefined} />
      </div>
      {commands.map((c) => (
        <div key={c.id} className="py-4" style={{ boxShadow: 'inset 0 -1px 0 rgb(255 255 255 / 0.06)' }}>
          <div className="text-[length:var(--tri-size)] font-semibold lowercase text-[var(--tri-ink)]">{c.label}</div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {c.phrases.map((p) => (
              <Chip key={p} onRemove={() => remove(c.id, p)}>
                {p}
              </Chip>
            ))}
            <input
              className={cx(FIELD, 'h-[26px] w-[160px] px-2.5 text-[length:var(--tri-size-xs)]')}
              placeholder="add a phrase…"
              value={drafts[c.id] ?? ''}
              onChange={(e) => setDrafts((d) => ({ ...d, [c.id]: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') add(c.id);
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function VoiceCommandsTile({ className }: { className?: string }) {
  const [noticed, setNoticed] = useState(NOTICED);
  const phraseCount = COMMANDS.reduce((n, c) => n + c.phrases.length, 0);

  return (
    <Expandable
      className={className}
      title="Voice commands"
      blurb="What the pastor can say to the app from the pulpit — and what the app has noticed them saying."
      size={{ w: 640, h: 620 }}
      tile={({ onOpen }) => (
        <Panel className="min-h-0 flex-1" bodyClass="pt-3">
          <div className="flex h-full min-h-0 flex-col gap-2">
            <button type="button" onClick={onOpen} className="flex shrink-0 items-baseline justify-between text-left">
              <span className="text-[length:var(--tri-size-eyebrow)] font-semibold uppercase tracking-[0.16em] text-[rgb(229_243_242_/_0.55)]">voice commands</span>
              <span className="text-[length:var(--tri-size-eyebrow)] lowercase tabular-nums" style={{ color: MUTED }}>
                {COMMANDS.length} commands · {phraseCount} phrases ›
              </span>
            </button>

            {/* What was noticed leads: it is the only thing here that is
                waiting on a person. The phrases are the door. */}
            {noticed.length > 0 ? (
              <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden">
                <div className="flex items-center gap-2">
                  <Pill tone="auto">noticed</Pill>
                  <span className="text-[length:var(--tri-size-eyebrow)] lowercase" style={{ color: MUTED }}>
                    said it, and you pressed the button
                  </span>
                </div>
                {noticed.map((s) => (
                  <SuggestionRow key={s.id} s={s} onAccept={() => setNoticed((n) => n.filter((x) => x.id !== s.id))} onDismiss={() => setNoticed((n) => n.filter((x) => x.id !== s.id))} />
                ))}
              </div>
            ) : (
              <button type="button" onClick={onOpen} className="flex min-h-0 flex-1 flex-wrap content-start gap-1.5 overflow-hidden text-left">
                {COMMANDS.flatMap((c) => c.phrases.slice(0, 2)).map((p) => (
                  <Chip key={p}>{p}</Chip>
                ))}
              </button>
            )}

            <div className="flex shrink-0 justify-end">
              <Button label="add a phrase" icon={<PlusIcon size={11} />} onClick={onOpen} />
            </div>
          </div>
        </Panel>
      )}
    >
      <PhraseEditor />
    </Expandable>
  );
}
