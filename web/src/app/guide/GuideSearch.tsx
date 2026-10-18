'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { areaTitles, type GuideTask } from './lessons';

const words = (value: string) => value.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/).filter(Boolean);
function distance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) row[j] = Math.min(row[j - 1] + 1, previous[j] + 1, previous[j - 1] + Number(a[i - 1] !== b[j - 1]));
    previous = row;
  }
  return previous[b.length];
}
/** The same typo-tolerant search the app uses: titles and the questions people actually type. */
export function GuideSearch({ lessons }: { lessons: GuideTask[] }) {
  const [query, setQuery] = useState('');
  const results = useMemo(() => {
    const tokens = words(query);
    if (!tokens.length) return null;
    return lessons.map(task => {
      const vocabulary = words(`${task.title} ${(task.asks ?? []).join(' ')}`);
      let score = 0;
      for (const token of tokens) for (const word of vocabulary) {
        if (token === word) { score += 3; break; }
        if (token.length >= 3 && word.startsWith(token)) { score += 1.5; break; }
        if (token.length >= 4 && Math.abs(word.length - token.length) <= 2 && distance(token, word) <= (token.length > 6 ? 2 : 1)) { score += 1.2; break; }
      }
      return { task, score };
    }).filter(hit => hit.score > 0).sort((a, b) => b.score - a.score).map(hit => hit.task);
  }, [query, lessons]);
  const grouped = useMemo(() => {
    const groups = new Map<string, GuideTask[]>();
    for (const task of lessons) { const key = areaTitles[task.area] ?? task.area; groups.set(key, [...(groups.get(key) ?? []), task]); }
    return [...groups];
  }, [lessons]);
  return <>
    <label className="guide-search"><span aria-hidden="true">?</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="how to connect mic…" aria-label="Search the guide" autoComplete="off" /></label>
    {results ? <div className="guide-area"><div className="guide-list">{results.map(task => <Row key={task.id} task={task} />)}</div>{!results.length && <p className="guide-empty">Nothing for that yet. Try “microphone”, “song” or “screen”.</p>}</div>
      : grouped.map(([title, tasks]) => <section className="guide-area" key={title}><h2>{title}</h2><div className="guide-list">{tasks.map(task => <Row key={task.id} task={task} />)}</div></section>)}
  </>;
}
function Row({ task }: { task: GuideTask }) {
  return <Link className="guide-row" href={`/guide/${task.id}`}><span>{task.title}{task.since && <> <small>since {task.since}</small></>}</span><span aria-hidden="true">→</span></Link>;
}
