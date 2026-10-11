import mapText from '../../docs/product-guide/product-map.json?raw';

export interface GuideTask {
  id: string; title: string; area: string; entry: string;
  controls: string[]; status: 'wired' | 'partial' | 'unverified';
}
export const guideTasks: GuideTask[] = JSON.parse(mapText).tasks;
export type GuideDestination = 'keys' | 'audio' | 'phone' | 'speech' | 'language' | 'scripture' | 'themes' | 'songs' | 'slides' | 'media' | 'online' | 'run' | 'outputs' | 'notes' | 'timers' | 'profile' | 'cloud' | 'appearance' | 'church' | 'settings' | 'companion' | 'notifications' | 'mobile';

const aliases: Record<string, string> = {
  'audio.choose-input': 'connect microphone mic soundboard hear pastor preacher audio input setup',
  'audio.troubleshoot': 'microphone mic stopped broken not working no sound cannot hear quiet silent permission',
  'audio.phone-microphone': 'connect phone iphone android microphone mic wireless audio',
  'outputs.assign': 'connect projector monitor display screen second hdmi television',
  'songs.create-edit-slides': 'add song lyrics words worship music slides create',
  'media.find-online': 'search online images pictures photos video stock pexels pixabay mountains ocean background api key',
  'media.import-preview-local': 'add upload import photo picture video file computer media',
  'bible.lookup-preview-reference': 'find bible scripture verse passage reference search preview',
  'themes.change-background': 'background wallpaper photo behind words lyrics video',
  'run.build-edit': 'prepare sunday service plan order schedule programme program',
  'files.save-open-transfer': 'save open export import tri transfer move service another computer',
  'remote.pair': 'connect phone remote control',
};
const stop = new Set('i me my the a an to how do does can could would please help want need you it is with for of in on get this guide show'.split(' '));
function words(value: string): string[] {
  return value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').split(/[^a-z0-9]+/).filter(word => word && !stop.has(word));
}
function distance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) row[j] = Math.min(row[j - 1] + 1, previous[j] + 1, previous[j - 1] + Number(a[i - 1] !== b[j - 1]));
    previous = row;
  }
  return previous[b.length];
}
export function searchGuideTasks(query: string): GuideTask[] {
  const tokens = words(query);
  if (!tokens.length) return guideTasks;
  return guideTasks.map(task => {
    const title = words(task.title);
    const vocabulary = [...title, ...words(`${task.area} ${aliases[task.id] ?? ''}`)];
    let matched = 0;
    let score = 0;
    for (const token of tokens) {
      let best = 0;
      for (const word of vocabulary) {
        if (token === word) best = Math.max(best, title.includes(word) ? 3 : 2.5);
        else if (token.length >= 3 && word.startsWith(token)) best = Math.max(best, 1.5);
        else if (token.length >= 4 && Math.abs(word.length - token.length) <= 2 && distance(token, word) <= (token.length > 6 ? 2 : 1)) best = Math.max(best, 1.2);
      }
      if (best) matched++;
      score += best;
    }
    // Rank candidates only. Search never runs a task or treats similarity as certainty.
    return { task, score: score + matched / tokens.length, matched };
  }).filter(hit => hit.matched > 0).sort((a, b) => b.score - a.score || a.task.title.localeCompare(b.task.title)).map(hit => hit.task);
}

export function destinationFor(task: GuideTask): GuideDestination | null {
  if (task.status !== 'wired' || task.area.startsWith('web')) return null;
  if (task.id === 'navigation.open-library') return 'scripture';
  if (task.id === 'notifications.resolve') return 'notifications';
  if (task.id === 'remote.pair') return 'mobile';
  if (task.id === 'audio.phone-microphone') return 'phone';
  if (task.id === 'audio.start-stop-listening' || task.area === 'audio') return 'audio';
  if (task.id === 'speech.configure-language') return 'language';
  if (task.area === 'speech') return 'speech';
  if (task.area === 'preachers') return 'profile';
  if (task.area === 'scripture' || task.area === 'output') return task.id === 'outputs.assign' || task.id === 'outputs.preferences' ? 'outputs' : 'scripture';
  if (task.id === 'media.find-online') return 'online';
  if (task.area === 'run' || task.area === 'service files') return 'run';
  if (task.area === 'cloud') return 'cloud';
  if (task.area === 'companion') return 'companion';
  if (task.area === 'dashboard') return 'timers';
  if (task.area === 'remote') return null;
  if (task.id === 'settings.appearance') return 'appearance';
  if (task.area === 'settings' || task.area === 'navigation') return 'settings';
  if (['themes', 'songs', 'slides', 'media', 'notes'].includes(task.area)) return task.area as GuideDestination;
  return null;
}

export const microphoneSteps = [
  { title: 'Choose your microphone', body: 'Open Audio beneath the preview. Choose your microphone or soundboard feed. System default follows your computer’s selected input.' },
  { title: 'Start listening', body: 'Press Start listening at the bottom left. If it is already listening, you can continue. This uses your current speech service.' },
  { title: 'Say a few words', body: 'Speak a short sentence. We’ll check for a fresh audio signal and new transcript text. A connection alone doesn’t confirm both.' },
  { title: 'Your input is responding', body: 'Audio and new transcript text arrived during this check. Read the transcript to make sure the words are correct.' },
] as const;

export function microphoneCheckComplete(input: { bridge: boolean; practice: boolean; listening: boolean; paused: boolean; checkStartedAt: number; signalAt: number; transcriptAt: number }): boolean {
  return input.bridge && !input.practice && input.listening && !input.paused && input.checkStartedAt > 0 && input.signalAt >= input.checkStartedAt && input.transcriptAt >= input.checkStartedAt;
}
