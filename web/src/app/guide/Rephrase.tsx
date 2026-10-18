'use client';
import { useState } from 'react';

/** One point, said one way at a time. The button cycles the written rephrases; nothing is generated. */
export function Point({ say, yours }: { say: string[]; yours: boolean }) {
  const [phrase, setPhrase] = useState(0);
  const line = say[phrase % say.length];
  return <li className="guide-point" data-yours={yours || undefined}>
    <p key={phrase}>{line}</p>
    <footer>
      <button type="button" disabled={say.length < 2} onClick={() => setPhrase(n => n + 1)} aria-label="Say it another way">another way <em>{(phrase % say.length) + 1}/{say.length}</em></button>
    </footer>
  </li>;
}
