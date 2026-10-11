import { destinationFor, type GuideTask } from './productGuide';

export type GuideStep = {
  id: string;
  title: string;
  prompt: string;
  target: string;
  action: 'click' | 'focus' | 'point' | 'input' | 'listen' | 'check' | 'write' | 'choose';
  text?: string;
  field?: keyof GuideAnswers;
  prerequisite?: 'stock' | 'bible';
  done?: string;
  observed?: 'stock-picked' | 'programme-added' | 'display-assigned';
  holdMs?: number;
};
export type GuideAnswers = { reference: string; search: string; programme: string; songTitle: string; lyrics: string };
export const defaultGuideAnswers: GuideAnswers = {
  reference: 'Psalm 23:1', search: 'mountains at sunrise',
  programme: '10:00 Welcome and opening prayer\n10:05 Worship\n10:25 Scripture reading\n10:30 Sermon\n11:00 Closing prayer',
  songTitle: '', lyrics: '',
};
const anchor = (name: string) => `[data-guide="${name}"]`;
const libraryStep = (tab: string, name = tab): GuideStep => ({ id: `tab-${tab}`, title: `Open ${name}?`, prompt: `I’ll take you to the ${name} tab.`, target: anchor(`library-${tab}`), action: 'click', done: `${anchor(`library-${tab}`)}[aria-selected="true"]` });
export const microphoneTask = (task: GuideTask) => ['audio.choose-input', 'audio.troubleshoot', 'audio.start-stop-listening'].includes(task.id);
export const shortTitle = (task: GuideTask): string => ({
  'audio.choose-input': 'Connect a microphone', 'audio.troubleshoot': 'Fix my microphone',
  'audio.start-stop-listening': 'Start listening', 'outputs.assign': 'Set up a screen',
  'bible.lookup-preview-reference': 'Find a Bible passage', 'songs.create-edit-slides': 'Add a song',
  'media.import-preview-local': 'Add pictures or video', 'media.find-online': 'Find an online image', 'run.build-edit': 'Prepare a service',
}[task.id] ?? task.title);

export function walkthroughFor(task: GuideTask, demo = false, answers: GuideAnswers = defaultGuideAnswers): GuideStep[] {
  if (task.status !== 'wired' || task.area.startsWith('web')) return [];
  if (microphoneTask(task)) return demo ? [
    { id: 'demo-open', title: 'First, open Audio.', prompt: 'Watch the triangle open the input menu.', target: anchor('demo-audio'), action: 'click', done: anchor('demo-input') },
    { id: 'demo-input', title: 'Choose an input.', prompt: 'This example microphone stays inside the demo.', target: anchor('demo-input'), action: 'click', done: anchor('demo-selected') },
    { id: 'demo-listen', title: 'Now start listening.', prompt: 'The demo is ready to hear a sentence.', target: anchor('demo-listen'), action: 'click', done: `${anchor('demo-listen')}[aria-pressed="true"]` },
    { id: 'demo-speech', title: 'Sound, then words.', prompt: 'Both checks need to respond.', target: anchor('demo-speech'), action: 'click', done: anchor('demo-transcript'), holdMs: 1600 },
  ] : [
    { id: 'audio-open', title: 'Open your audio inputs?', prompt: 'They’re just beneath the preview.', target: anchor('audio-input'), action: 'click', done: anchor('audio-options') },
    { id: 'audio-pick', title: 'Which input are you using?', prompt: 'Pick your microphone or soundboard feed.', target: anchor('audio-options'), action: 'input' },
    { id: 'audio-listen', title: 'Ready to listen?', prompt: 'Press Start listening. This uses your speech service.', target: anchor('listen'), action: 'listen' },
    { id: 'audio-check', title: 'Say a few words.', prompt: 'I’m checking for sound and new transcript text.', target: anchor('listen'), action: 'check' },
  ];
  if (task.id === 'songs.create-edit-slides') return [
    libraryStep('songs'),
    { id: 'song-add', title: 'Shall we add a song?', prompt: 'This opens the song editor.', target: anchor('toolbar-songs-add'), action: 'click', done: anchor('song-entry') },
    { id: 'song-title', title: 'Start with its name.', prompt: 'Give the song a title here.', target: anchor('song-title'), action: answers.songTitle ? 'write' : 'focus', field: 'songTitle', text: answers.songTitle },
    { id: 'song-lyrics', title: 'And the words go here.', prompt: 'Paste your lyrics. Blank lines separate slides.', target: anchor('song-lyrics'), action: answers.lyrics ? 'write' : 'focus', field: 'lyrics', text: answers.lyrics },
  ];
  if (task.id === 'run.build-edit') return [
    { id: 'run-paste', title: 'Have a service programme?', prompt: 'Let’s open the programme box.', target: anchor('run-paste'), action: 'click', done: anchor('run-text') },
    { id: 'run-write', title: 'What’s the order of service?', prompt: 'Edit this example, or paste your own programme below.', target: anchor('run-text'), action: 'write', field: 'programme', text: answers.programme },
    { id: 'run-read', title: 'Shall we read it?', prompt: 'I’ll turn the text into a list you can review.', target: anchor('run-read'), action: 'click', done: `${anchor('run-programme')}[data-guide-state="review"]` },
    { id: 'run-review', title: 'Does the order look right?', prompt: 'Check times and types. Add to run when you’re ready; this updates the service schedule.', target: anchor('run-apply'), action: 'choose', observed: 'programme-added' },
  ];
  if (task.id === 'outputs.assign' || task.id === 'outputs.preferences') return [
    { id: 'outputs-open', title: 'Set up a screen?', prompt: 'Let’s look at your output settings.', target: anchor('dashboard-outputs'), action: 'click', done: anchor('outputs-settings') },
    { id: 'outputs-picker', title: 'See the available displays?', prompt: 'I’ll open the display picker. You choose where this output goes.', target: '[data-guide="outputs-settings"] [data-guide$=".display"] button', action: 'click', done: '[data-guide="outputs-settings"] [data-guide$=".display"] button[aria-expanded="true"]' },
    { id: 'outputs-display', title: 'Which display should the room see?', prompt: 'Choose a display for the projector. This can open an output window.', target: '[data-guide="outputs-settings"] [data-guide$=".display"] button', action: 'choose' },
    { id: 'outputs-check', title: 'Check the room’s screen.', prompt: 'Confirm it shows the intended output before the service.', target: anchor('outputs-settings'), action: 'choose' },
  ];
  const destination = destinationFor(task);
  if (['scripture', 'themes', 'songs', 'slides', 'media', 'online'].includes(destination ?? '')) {
    const tab = destination === 'scripture' ? 'verses' : destination!;
    const steps = [libraryStep(tab)];
    if (destination === 'scripture') steps.push(
      { id: 'bible-reference', title: 'Which passage?', prompt: 'I’ll type the reference. Choose a verse to preview it.', target: '[data-scripture-browser] input', action: 'write', field: 'reference', text: answers.reference, prerequisite: 'bible' },
      { id: 'bible-preview', title: 'Read it in preview.', prompt: 'Click your verse once. Enter or a double-click sends it live.', target: '[data-scripture-browser] [data-row]', action: 'choose' },
    );
    if (destination === 'online') steps.push(
      { id: 'stock-query', title: 'What image are we looking for?', prompt: 'Try a scene, subject, or mood. You can change these words.', target: '[data-guide="stock-search"] input[aria-label="search online media"]', action: 'write', field: 'search', text: answers.search, prerequisite: 'stock' },
      { id: 'stock-pick', title: 'Which one fits the service?', prompt: 'Choose an image to download and preview. It won’t go live.', target: '[data-guide="stock-result"]', action: 'choose', observed: 'stock-picked', prerequisite: 'stock' },
    );
    if (destination === 'media') steps.push({ id: 'media-local', title: 'Your files live here.', prompt: 'This filter shows what’s on this laptop.', target: '.media-browser button[aria-label="show what is on this laptop"]', action: 'click', done: '.media-browser button[aria-label="show what is on this laptop"][aria-pressed="true"]' });
    if (destination === 'media') steps.push({ id: 'media-import', title: 'Have a picture or video ready?', prompt: 'Use Add from laptop to choose your file, then click its card to preview it.', target: anchor('media-import'), action: 'choose' });
    return steps;
  }
  return [];
}

// Only these known, non-publishing controls may be clicked by the companion.
// Never derive an executable selector from a typed request or map prose.
export const guideClickTargets = new Set([
  ...['verses', 'themes', 'songs', 'slides', 'media', 'online'].map(tab => anchor(`library-${tab}`)),
  '[data-guide="outputs-settings"] [data-guide$=".display"] button',
  anchor('toolbar-songs-add'), anchor('audio-input'), anchor('run-paste'), anchor('run-read'), anchor('dashboard-outputs'),
  ...['audio', 'input', 'listen', 'speech'].map(id => anchor(`demo-${id}`)),
  '.media-browser button[aria-label="show what is on this laptop"]',
]);
export function canGuideClick(step: GuideStep): boolean { return step.action === 'click' && guideClickTargets.has(step.target); }

export const guideWriteTargets = new Set([
  '[data-scripture-browser] input', '[data-guide="stock-search"] input[aria-label="search online media"]',
  anchor('run-text'), anchor('song-title'), anchor('song-lyrics'),
]);
export function canGuideWrite(step: GuideStep): boolean {
  return step.action === 'write' && guideWriteTargets.has(step.target) && typeof step.text === 'string' && step.text.length <= 12000 && !step.text.includes('\0');
}
