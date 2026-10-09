import type { CSSProperties } from 'react';
import { TEXT_TRANSITIONS, type TextTransition } from '../../../shared/textTransitions';
import { DISPLAY_FONTS } from '../../../shared/displayFont';
import './textTransitionPicker.css';

/** Four entrances; clicking the selected card replays it too. */
export function TextTransitionPicker({ value, duration, play, onChange }: {
  value: TextTransition;
  duration: number;
  play: number;
  onChange: (next: TextTransition) => void;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <span className="tri-label tri-control-heading text-[var(--tri-ink-muted)]">transition</span>
      <div role="group" aria-label="text transition" className="grid min-w-0 grid-cols-4 gap-3">
        {TEXT_TRANSITIONS.filter(option => option.id !== 'cut').map(option => {
          const selected = value === option.id;
          return (
            <div key={option.id} className="flex min-w-0 flex-col items-center gap-2" style={{ containerType: 'inline-size' }}>
              <button
                type="button"
                aria-label={option.label}
                aria-pressed={selected}
                title={option.blurb}
                onClick={() => onChange(option.id)}
                className="tri-font-card tri-transition-card relative grid aspect-square w-full place-items-center focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--tri-accent-yellow)]"
                style={{ '--transition-radius': 'calc(var(--tri-font-card-round) * 1cqw)', '--sample-ms': `${duration}ms` } as CSSProperties}
              >
                <span aria-hidden className={`tri-transition-inner ${selected ? 'tri-surface' : ''}`} />
                <span
                  key={`${selected ? play : 'idle'}-${option.id}`}
                  aria-hidden
                  className={`tri-transition-sample ${selected && play > 0 ? `tri-sample-${option.id}` : ''}`}
                  style={{ fontFamily: DISPLAY_FONTS.serif, opacity: selected ? 1 : 0.65 }}
                >Aa</span>
              </button>
              <span aria-hidden className="h-[3px] w-5 rounded-full bg-[var(--tri-accent-yellow)]" style={{ opacity: selected ? 1 : 0 }} />
              <span className="tri-label text-[var(--tri-ink-muted)]">{option.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
