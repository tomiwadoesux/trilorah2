import { useCallback, useEffect, useRef, useState } from 'react';
import type { Spoken } from './types';

/*
 * A pretend sermon, fed to the transcript strip the way Deepgram feeds it.
 *
 * SANDBOX ONLY. Nothing in the app reads this; the Live screen only plays
 * it on the design page (see LiveTranscript), and never once the engine is
 * really listening. It exists so a strip design can be judged moving —
 * a transcript is a thing that happens over time, and a still of one says
 * almost nothing about whether it can be read.
 *
 * What it imitates, because each of these is something a design has to
 * survive:
 *   - words arrive one at a time at preaching pace, ~150 a minute, with the
 *     unevenness of speech (long words take longer);
 *   - the engine commits in UTTERANCES at pauses, not in sentences — a
 *     clause, half a sentence, a two-word aside;
 *   - interim results change their mind: a word is first heard wrong and
 *     corrected on the next update ("forgotten" → "begotten");
 *   - scripture references arrive formatted ("John 3:16"), as smart_format
 *     gives them;
 *   - silences — a pause for effect, a breath before prayer.
 *
 * The three references are the ones the sandbox's proposal cards already
 * show, so the rail and the strip tell the same story.
 */

interface Utterance {
  text: string;
  /** Word index → how the engine first mishears it. */
  mishear?: Record<number, string>;
  /** Silence after it, in ms at 1× (default: by its last character). */
  pause?: number;
}

export const DEMO_SERMON: Utterance[] = [
  { text: 'Good morning, church.', pause: 1200 },
  { text: 'If you have your Bibles, turn with me to John 3:16.', mishear: { 4: "Bible's" }, pause: 1400 },
  { text: 'For God so loved the world,', mishear: { 3: 'love' } },
  { text: 'that he gave his only begotten Son,', mishear: { 5: 'forgotten' } },
  { text: 'that whosoever believeth in him should not perish,' },
  { text: 'but have everlasting life.', pause: 1600 },
  { text: 'Now I want you to notice something.' },
  { text: "It doesn't say God so loved the good people.", pause: 900 },
  { text: 'It says he loved the world,' },
  { text: 'the whole of it, messy as it is.', pause: 1500 },
  { text: 'Keep your finger there,' },
  { text: 'because Paul picks it right back up in Romans 8:28.', mishear: { 5: 'bag', 8: "Roman's" }, pause: 1100 },
  { text: 'And we know that all things work together for good' },
  { text: 'to them that love God.', pause: 1300 },
  { text: 'All things.' , pause: 700 },
  { text: 'Not some things. Not the easy things.', pause: 1200 },
  { text: 'Some of you walked in here this morning carrying something heavy.' },
  { text: "A diagnosis, a bill you can't pay,", mishear: { 1: 'diagnose' } },
  { text: "a child who won't call you back.", pause: 1500 },
  { text: 'I want you to hear me.', pause: 600 },
  { text: 'It is working together for your good.', pause: 1400 },
  { text: "And it isn't because you earned it." },
  { text: 'Look at Ephesians 2:8.', mishear: { 2: 'Ephesian' }, pause: 1200 },
  { text: 'For by grace are ye saved through faith;', mishear: { 2: 'grays' } },
  { text: 'and that not of yourselves:' },
  { text: 'it is the gift of God.', pause: 1600 },
  { text: 'Grace.', pause: 800 },
  { text: 'Say it with somebody next to you.', pause: 900 },
  { text: 'Grace.', pause: 2200 },
  { text: "Let's pray.", pause: 4000 },
];

/** How long a word takes to say at 1×: ~150 wpm, longer words longer. */
function wordMs(word: string) {
  const letters = word.replace(/[^A-Za-z0-9]/g, '').length;
  return 250 + letters * 28 + ((letters * 37) % 70);
}

function pauseAfter(u: Utterance) {
  if (u.pause !== undefined) return u.pause;
  return /[.!?]["”]?$/.test(u.text) ? 800 : 350;
}

/** How many committed lines the demo keeps — the engine keeps a cap too. */
const KEEP = 24;

/**
 * Play the demo sermon while `playing`. Returns the feed and a restart.
 * `speed` scales every gap (2 = twice as fast); it can change mid-play.
 */
export function useDemoSpeech({ playing, speed = 1 }: { playing: boolean; speed?: number }) {
  const [spoken, setSpoken] = useState<Spoken>({ lines: [], partial: '' });
  const at = useRef({ u: 0, w: 0, misheard: false, id: 0 });
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const [epoch, setEpoch] = useState(0);

  const restart = useCallback(() => {
    at.current = { u: 0, w: 0, misheard: false, id: 0 };
    setSpoken({ lines: [], partial: '' });
    setEpoch((e) => e + 1);
  }, []);

  useEffect(() => {
    if (!playing) return;
    let timer = 0;
    const step = () => {
      const p = at.current;
      const u = DEMO_SERMON[p.u % DEMO_SERMON.length];
      const words = u.text.split(' ');
      let wait: number;
      if (p.w < words.length) {
        const wrong = u.mishear?.[p.w];
        if (wrong && !p.misheard) {
          /* Heard wrong first; the next update corrects it. */
          const shown = [...words.slice(0, p.w), wrong].join(' ');
          setSpoken((s) => ({ ...s, partial: shown }));
          p.misheard = true;
          wait = wordMs(wrong);
        } else {
          p.misheard = false;
          p.w += 1;
          const shown = words.slice(0, p.w).join(' ');
          setSpoken((s) => ({ ...s, partial: shown }));
          wait = wordMs(words[p.w - 1]);
        }
      } else {
        /* A pause: the engine commits the utterance as the next line. */
        const id = p.id++;
        setSpoken((s) => ({ lines: [...s.lines.slice(-(KEEP - 1)), { id, text: u.text }], partial: '' }));
        p.u += 1;
        p.w = 0;
        wait = pauseAfter(u);
      }
      timer = window.setTimeout(step, wait / Math.max(0.1, speedRef.current));
    };
    timer = window.setTimeout(step, 500);
    return () => window.clearTimeout(timer);
  }, [playing, epoch]);

  return { spoken, restart };
}
