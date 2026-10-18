import type { Metadata } from 'next';
import { GuideSearch } from './GuideSearch';
import { lessons, mapVersion } from './lessons';
import './guide.css';

export const metadata: Metadata = { title: 'Trilorah guide', description: 'Short lessons for running a service with Trilorah. The same lines the Messenger says inside the app.' };

export default function GuidePage() {
  return <main className="guide">
    <div className="guide-kicker"><Mark />The Messenger</div>
    <h1>Ask it the way you’d ask a person.</h1>
    <p className="guide-lede">These are the lessons the triangle teaches inside Trilorah. Same words, same order. In the app it also walks to the control and, when you let it, presses it for you.</p>
    <GuideSearch lessons={lessons} />
    <p className="guide-meta">Written for Trilorah {mapVersion}. Lessons update with the app.</p>
  </main>;
}
export function Mark() {
  return <svg viewBox="0 0 28 25" fill="none" aria-hidden="true"><path d="M14 1.5 26.5 22.5H1.5Z" fill="currentColor" /><circle cx="20.25" cy="12" r="3.6" fill="#0a0a0a" /></svg>;
}
