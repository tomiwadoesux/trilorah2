/** Different wording for the same measured state, never different advice. */
export const ORB_PHRASES: Record<string, readonly string[]> = {
  idle: ['Mic is off. Start listening when ready.', 'Ready when you are. Turn on listening.', 'Start listening to catch the next verse.'],
  connecting: ['Connecting to speech. One moment.', 'Getting listening ready. Please wait.', 'The speech connection is starting.'],
  listening: ['Listening for verses. You’re all set.', 'Listening is on. No action needed.', 'Ready to catch the next reference.'],
  'in preview': ['Preview ready. Go live when you’re ready.', 'Your next item is staged. Check it, then go live.', 'Ready in preview. You decide when it goes live.'],
  live: ['Content is live. Use Next or Previous.', 'Your content is on screen. Move on when ready.', 'You’re live. Next and Previous are ready.'],
  'auto live': ['Auto mode is live. Watch for verse changes.', 'Verses are advancing automatically. Keep an eye on them.', 'Automatic display is on. Review each new verse.'],
  correction: ['Checking the verse. One moment.', 'Reviewing that reference. Please wait.', 'A verse correction is being checked.'],
  'prayer mode': ['Prayer pause is on. Resume when ready.', 'Holding for prayer. Continue when you’re ready.', 'Prayer pause is keeping the screen still.'],
  'practice mode': ['Practice mode. The projector is unchanged.', 'You’re rehearsing. The audience screen stays as it is.', 'This is practice. Nothing changes on the projector.'],
  'output frozen': ['Output is held. Review the display controls.', 'The screen is paused. Check output when ready.', 'Holding the output. Open display controls to continue.'],
  'media / QR': ['Media is live. Clear it when finished.', 'Media is on screen. Clear the output when ready.', 'Your media is showing. Keep it up until you’re done.'],
  'engine error': ['Listening stopped. Check speech settings.', 'Speech needs attention. Open its settings.', 'The speech connection needs a check.'],
  'no display': ['No audience display. Connect a screen.', 'Choose a display for the audience.', 'The audience screen needs connecting.'],
  'no mic signal': ['No mic sound. Check your input and volume.', 'The mic is quiet. Check its connection.', 'No sound is coming through. Check the mic.'],
};

/** Advance only when a new hover/focus interaction begins. */
export function nextOrbPhrase(state: string, previous?: string): string {
  const phrases = ORB_PHRASES[state] ?? ORB_PHRASES.idle;
  return phrases[(phrases.indexOf(previous ?? '') + 1) % phrases.length];
}
