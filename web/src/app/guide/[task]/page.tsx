import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Mark } from '../page';
import { Point } from '../Rephrase';
import { lessonById, lessons, yours } from '../lessons';
import '../guide.css';

export function generateStaticParams() { return lessons.map(task => ({ task: task.id })); }
export async function generateMetadata({ params }: { params: Promise<{ task: string }> }): Promise<Metadata> {
  const task = lessonById((await params).task);
  return { title: task ? `${task.title} · Trilorah guide` : 'Trilorah guide', description: task?.lesson?.[0]?.say[0] };
}

export default async function LessonPage({ params }: { params: Promise<{ task: string }> }) {
  const task = lessonById((await params).task);
  if (!task) notFound();
  return <main className="guide">
    <Link className="guide-back" href="/guide">← all lessons</Link>
    <div className="guide-kicker"><Mark />The Messenger</div>
    <h1>{task.title}</h1>
    {task.asks?.length ? <ul className="guide-asks" aria-label="Questions this answers">{task.asks.slice(0, 5).map(ask => <li key={ask}>“{ask}”</li>)}</ul> : null}
    <ol className="guide-points">{task.lesson!.map(point => <Point key={point.id} say={point.say} yours={yours(point)} />)}</ol>
    <p className="guide-note"><strong>In the app,</strong> open the guide at the top right and ask the same thing. The triangle walks to each control. {task.consequential ? 'Anything that goes to the wall waits for your press.' : 'Choose “Show me” and it presses for you; choose “I’ll do it” and it only points.'}</p>
    {task.since && <p className="guide-meta">Since Trilorah {task.since}.</p>}
  </main>;
}
