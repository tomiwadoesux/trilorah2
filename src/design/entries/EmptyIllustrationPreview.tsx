import { useState, type ComponentType } from 'react';
import { NotificationBellArt } from '../screens/NotificationBellArt';
import { DisplayConnectionArt } from '../screens/DisplayConnectionArt';
import { CompanionBoxesArt } from '../screens/CompanionBoxesArt';
import { AppearancePaletteArt } from '../screens/AppearancePaletteArt';
import { LanguageLettersArt } from '../screens/LanguageLettersArt';
import { PreacherPortraitArt } from '../screens/PreacherPortraitArt';
import { PreacherLecternArt } from '../screens/PreacherLecternArt';
import { MediaSlideArt } from '../screens/MediaSlideArt';
import { MediaFilmArt } from '../screens/MediaFilmArt';
import { GlobeEmptyArt } from '../screens/GlobeEmptyArt';
import { PocketWatchArt } from '../screens/PocketWatchArt';
import { RunningOrderArt } from '../screens/RunningOrderArt';

const illustrations: { name: string; detail: string; Art: ComponentType; motion?: 'hover' | 'clock' | 'static' }[] = [
  { name: 'Notifications', detail: 'Upright bell · surrounding ripples', Art: NotificationBellArt },
  { name: 'Display select', detail: '1 Peter 4:10 · follows the latest called scripture', Art: DisplayConnectionArt },
  { name: 'Preacher portrait', detail: 'A neutral figure · smooth, featureless planes', Art: PreacherPortraitArt },
  { name: 'Preachers', detail: 'Open book · gooseneck microphone · sculpted lectern', Art: PreacherLecternArt },
  { name: 'Sermon notes', detail: 'Live pocket watch · device time', Art: PocketWatchArt, motion: 'clock' },
  { name: 'Media', detail: 'Upright photograph · separating layers', Art: MediaSlideArt },
  { name: 'Film ribbon', detail: 'A still ribbon of three frames', Art: MediaFilmArt, motion: 'static' },
  { name: 'Globe', detail: 'Rotates on hover · brakes where you leave it', Art: GlobeEmptyArt },
  { name: 'Companion', detail: 'Two upright boxes · engraved QR faces', Art: CompanionBoxesArt },
  { name: 'Trust trend · Figure C', detail: 'An upright chart · three rising bars', Art: RunningOrderArt },
  { name: 'Appearance', detail: 'A palette and brush', Art: AppearancePaletteArt },
  { name: 'Language', detail: 'A stays still · 文 lifts gently', Art: LanguageLettersArt },
];

export function EmptyIllustrationPreview() {
  const [playing, setPlaying] = useState<string[]>([]);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-base font-medium text-white/80">Empty-state illustrations</h1>
        <a className="text-xs text-white/50 underline underline-offset-4" href="/empty-preview.html">Open the app with everything empty</a>
        <a className="text-xs text-white/50 underline underline-offset-4" href="/design.html?library-empty-preview">Scripture, songs & slides</a>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {illustrations.map(({ name, detail, Art, motion = 'hover' }) => {
          const active = playing.includes(name);
          return (
            <section key={name} data-illustration={name} className="tri-empty-surface overflow-hidden rounded-xl bg-[#111111] p-4" data-empty-active={active}>
              <h2 className="text-sm font-medium text-white/75">{name}</h2>
              <div className="flex justify-center">
                <div className="h-[230px] w-[245px] max-w-full"><Art /></div>
              </div>
              <p className="min-h-8 text-xs text-white/40">{detail}</p>
              {motion === 'hover' ? <button type="button" aria-pressed={active} className="rounded-md border border-white/15 px-3 py-2 text-xs text-white/65 hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/70"
                onClick={() => setPlaying(current => active ? current.filter(value => value !== name) : [...current, name])}>
                {active ? name === 'Globe' ? 'Pause motion' : 'Reset motion' : 'Preview motion'}
              </button> : <p className="py-2 text-xs text-white/35">{motion === 'clock' ? 'Runs automatically' : 'No hover animation'}</p>}
            </section>
          );
        })}
      </div>
    </div>
  );
}
