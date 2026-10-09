import { useState } from 'react';
import { isColumnChoice, unanswered, type ForeignAnswers, type ForeignChoice, type ForeignQuestion } from '../../../../shared/foreignImport';
import { Button } from '../../../ui';

interface Props { questions: ForeignQuestion[]; busy: boolean; onAnswer: (answers: ForeignAnswers) => void }

/**
 * The "not sure" cards of an import from another app. Each answer re-reads the
 * chosen files with that answer applied, so the checklist below always shows
 * what will actually be imported.
 */
export function ForeignQuestions({ questions, busy, onAnswer }: Props) {
  if (!questions.length) return null;
  const pending = unanswered(questions);
  return <section className="mb-4 rounded-lg border border-amber-300/25 p-3" aria-label="Import questions">
    <div className="flex items-center justify-between gap-3">
      <p className="text-xs font-semibold">{pending.length ? `${pending.length} ${pending.length === 1 ? 'thing I’m' : 'things I’m'} not sure about` : 'All questions answered'}</p>
      {pending.length > 0 && <Button label="skip the rest" tone="ash" disabled={busy} onClick={() => onAnswer(Object.fromEntries(pending.map(question => [question.id, 'skip' as const])))} />}
    </div>
    <div className="mt-2 space-y-2">{questions.map(question => <QuestionCard key={question.id} question={question} busy={busy} onAnswer={choice => onAnswer({ [question.id]: choice })} />)}</div>
  </section>;
}

const chip = (active: boolean) => `rounded-md border px-2 py-1 text-xs ${active ? 'border-emerald-300/60 bg-emerald-400/15' : 'border-white/15 hover:bg-white/5'} disabled:opacity-50`;

function QuestionCard({ question, busy, onAnswer }: { question: ForeignQuestion; busy: boolean; onAnswer: (choice: ForeignChoice) => void }) {
  const [title, setTitle] = useState<string | undefined>(isColumnChoice(question.answer) ? question.answer.title : isColumnChoice(question.suggested) ? question.suggested.title : undefined);
  const [lyrics, setLyrics] = useState<string | undefined>(isColumnChoice(question.answer) ? question.answer.lyrics : isColumnChoice(question.suggested) ? question.suggested.lyrics : undefined);
  const answered = question.answer !== undefined;
  const describe = (choice: ForeignChoice | undefined) => choice === undefined ? '' : choice === 'skip' ? 'skipped' : choice === 'song' ? 'a song' : choice === 'note' ? 'sermon notes' : `title from “${choice.title}”, lyrics from “${choice.lyrics}”`;
  return <details className="rounded-lg border border-white/10 p-3" open={!answered}>
    <summary className="cursor-pointer text-xs">
      <span className="font-medium">{question.file}</span>
      {question.rows !== undefined && <span className="ml-2 text-[var(--tri-ink-muted)]">{question.rows} {question.rows === 1 ? 'row' : 'rows'}</span>}
      {answered && <span className="ml-2 text-[var(--tri-ink-muted)]">{question.remembered ? 'answered last time' : 'answered'} · {describe(question.answer)}</span>}
    </summary>
    <pre className="my-2 max-h-28 overflow-auto whitespace-pre-wrap font-sans text-xs text-[var(--tri-ink-muted)]">{question.preview.join('\n')}</pre>
    {question.kind === 'text' ? <div className="flex flex-wrap gap-2">
      <p className="w-full text-xs">What is this file?</p>
      {(['song', 'note', 'skip'] as const).map(choice => <button key={choice} type="button" disabled={busy} className={chip(question.answer === choice)} onClick={() => onAnswer(choice)}>{choice === 'song' ? 'Song' : choice === 'note' ? 'Sermon notes' : 'Skip'}</button>)}
    </div> : <div className="space-y-2 text-xs">
      <div><p className="mb-1">Which column holds the song title?</p><div className="flex flex-wrap gap-1">{question.columns?.map(column => <button key={column} type="button" disabled={busy} className={chip(title === column)} onClick={() => { setTitle(column); if (lyrics && lyrics !== column) onAnswer({ title: column, lyrics }); }}>{column}</button>)}</div></div>
      <div><p className="mb-1">Which column holds the lyrics?</p><div className="flex flex-wrap gap-1">{question.columns?.map(column => <button key={column} type="button" disabled={busy} className={chip(lyrics === column)} onClick={() => { setLyrics(column); if (title && title !== column) onAnswer({ title, lyrics: column }); }}>{column}</button>)}</div></div>
      <div className="flex gap-2"><button type="button" disabled={busy} className={chip(question.answer === 'skip')} onClick={() => onAnswer('skip')}>Skip this table</button>{title && lyrics && title !== lyrics && question.answer === undefined && <button type="button" disabled={busy} className={chip(true)} onClick={() => onAnswer({ title, lyrics })}>Use these columns</button>}</div>
    </div>}
  </details>;
}
