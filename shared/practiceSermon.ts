/*
 * The practice sermon (owner, 2026-10-07: "test all these features ... not
 * with voice ... dummy preaching, maybe 3 minutes, that mentions lyrics of
 * the song, multiple scriptures, single, story").
 *
 * Choosing PRACTICE_SERMON_DEVICE in the audio picker makes "start listening"
 * play this script through the real engine instead of a microphone — word by
 * word, the way a recogniser hears speech, at about 136 words a minute
 * (electron/asr/practiceSermon.ts). Everything downstream is real: the
 * transcript, the catches, sets, the six-second clocks, song search, find
 * scripture, the projector. Nothing reaches the phone page or the service
 * record while it plays.
 *
 * Each line carries a note — what it is there to test, or what to press —
 * shown in the status line on the toolbar as the line starts.
 */

/** The audio "device" that is not a microphone. */
export const PRACTICE_SERMON_DEVICE = 'practice sermon (no microphone)';

export interface SermonLine {
  /** Silence before the line starts, ms. */
  pause: number;
  /** What the preacher says. */
  say: string;
  /** What the line tests, or what the operator should press. */
  note: string;
}

export const PRACTICE_SERMON: SermonLine[] = [
  { pause: 800, say: 'Good morning church, it is so good to see everyone here this morning.', note: 'ordinary talk: nothing should be caught' },
  { pause: 1500, say: 'Let us stand and sing together.', note: 'press search song now' },
  { pause: 4000, say: 'Amazing grace, how sweet the sound, that saved a wretch like me.', note: 'singing: Amazing Grace' },
  { pause: 1200, say: 'When peace like a river attendeth my way, when sorrows like sea billows roll.', note: 'singing: It Is Well With My Soul' },
  { pause: 1000, say: 'It is well, it is well with my soul.', note: 'singing: the chorus' },
  { pause: 1500, say: 'Blessed assurance, Jesus is mine, O what a foretaste of glory divine.', note: 'singing: Blessed Assurance' },
  { pause: 2000, say: 'Amen, you may be seated.', note: 'press stop search now' },
  { pause: 3000, say: 'This morning, turn with me to John chapter three verse sixteen.', note: 'one verse said: John 3:16' },
  { pause: 2500, say: 'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.', note: 'the verse read aloud: a quote match' },
  { pause: 3000, say: 'Now write these down: Romans five eight, Ephesians two eight, and first John four nineteen.', note: 'three in one breath: a numbered set' },
  { pause: 2500, say: 'But God commendeth his love toward us, in that, while we were yet sinners, Christ died for us.', note: 'Romans 5:8 read aloud: heard again' },
  { pause: 3500, say: 'Let us look at Genesis chapter three, verses three to five.', note: 'a range: one slide that fits, verse numbers raised' },
  { pause: 3000, say: 'Think about the parable of the prodigal son.', note: 'a named passage: Luke 15' },
  { pause: 3000, say: 'Remember when Abraham took his only son up the mountain to offer him, and God provided a ram caught in the thicket.', note: 'a story, with no reference said' },
  { pause: 3000, say: 'Think about Noah.', note: 'a name for the next sentence' },
  { pause: 1200, say: 'He kept building for years while people laughed, and then the rain came.', note: 'press find scripture now: "he" is Noah' },
  { pause: 6000, say: 'Church, the word of God is a lamp unto our feet and a light unto our path.', note: 'a verse echoed, not said: Psalm 119:105' },
  { pause: 2500, say: 'And the psalmist says, Psalm one hundred and nineteen, verses one to sixteen.', note: 'a long range: pages of whole verses, step with next on the live panel' },
  { pause: 3000, say: 'Next Sunday the car park will be closed for repairs, so please park on the street.', note: 'ordinary talk: nothing should be caught' },
  { pause: 2500, say: 'The Lord bless thee, and keep thee.', note: 'a blessing read aloud' },
  { pause: 2000, say: 'Let us pray. Father, thank you for your word. In Jesus name, amen.', note: 'prayer: the screen holds until amen' },
];
