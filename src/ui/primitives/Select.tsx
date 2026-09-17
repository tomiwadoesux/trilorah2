import { useState, useRef, useEffect } from 'react';
import { cx } from '../lib/cx';
import { ChevronDownIcon } from '../icons';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  label?: string;
  value?: string;
  options?: SelectOption[];
  onChange?: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export const TEXT_EFFECT_OPTIONS: SelectOption[] = [
  { value: 'soft-shadow', label: 'soft shadow' },
  { value: 'hard-shadow', label: 'hard shadow' },
  { value: 'glow', label: 'glow' },
  { value: 'neon-outline', label: 'neon outline' },
  { value: 'none', label: 'none' },
];

export function Select({
  /* No default. This used to be 'text effect', which then appeared over every
     Select that did not ask for a label — including the version picker on the
     scriptures tab. Callers that want the label pass it. */
  label,
  value: controlledValue,
  options = TEXT_EFFECT_OPTIONS,
  onChange,
  disabled = false,
  placeholder = 'select option',
  className = '',
}: SelectProps) {
  const [internalValue, setInternalValue] = useState<string>(controlledValue ?? options[0]?.value ?? '');
  const [isOpen, setIsOpen] = useState(false);

  // Sync controlled value if changed from parent
  useEffect(() => {
    if (controlledValue !== undefined) {
      setInternalValue(controlledValue);
    }
  }, [controlledValue]);

  const selectedValue = internalValue;
  /*
   * No fallback to options[0]. It made `placeholder` unreachable — a Select
   * always showed its first option, so there was no way to render one that
   * has not been answered yet ("add a segment"). An uncontrolled Select still
   * starts on options[0] through the initial state above; this only lets a
   * caller pass a value that matches nothing and get the prompt.
   */
  const selectedOption = options.find((opt) => opt.value === selectedValue);

  const containerRef = useRef<HTMLDivElement>(null);

  const handleToggle = () => {
    if (disabled) return;
    setIsOpen((prev) => !prev);
  };

  const handleSelect = (val: string) => {
    setInternalValue(val);
    onChange?.(val);
    // Keep dropdown open when selecting — only close on outside click or trigger toggle
  };

  // Close dropdown overlay when clicking outside or pressing Escape
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className={cx('relative flex flex-col gap-2 lowercase w-full max-w-[360px]', className)}>
      {label && <span className="tri-label text-[var(--tri-ink-muted)]">{label}</span>}

      {/* Select Trigger Button */}
      <button
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-disabled={disabled || undefined}
        onClick={handleToggle}
        className={cx(
          /* px-3, not px-3.5: on a pill this narrow the label was sitting a
             visible step right of the column heading below it. */
          'relative flex h-[var(--tri-field-h)] w-full items-center justify-between px-3 focus:outline-none select-none',
          /*
           * Deliberately not tri-interactive. That class carries both the hover
           * lift and the press scale, and on a trigger this wide the lift fires
           * from anywhere in the row — including the arrow, where the pointer
           * naturally lands on the way to a click. Opening a list is a quiet act;
           * the surface should not answer the approach, only the state.
           */
          /*
           * Open state is a lift in the same neutral, not a switch to teal.
           * tri-surface put the gradient on the trigger while the menu below
           * it stayed near-black, so the pair read as two materials.
           */
          isOpen ? 'bg-[rgb(255_255_255_/_0.07)]' : 'bg-[rgb(0_0_0_/_0.20)]',
          disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer',
        )}
        style={{
          borderRadius: 'var(--tri-radius-control)',
          /* The same hairline the inactive font and verse-layout cards carry.
             It used to stack a --tri-edge layer over the white one, which put
             teal on the closed trigger and made it read as a different control
             from the cards beside it. */
          boxShadow: 'inset 0 0 0 var(--tri-border) rgb(255 255 255 / 0.16)',
        }}
      >
        {/* leading-[1.4] rather than leading-none: the trigger is now only as
            wide as its longest expected label, so a longer one has to be able
            to end in an ellipsis — and overflow-hidden on a 1em line box
            shaves the descenders off "soft shadow" and "glow". The taller box
            is still centred on the same point, so nothing moves. */}
        {/* The field's own value is control text, not meta: it used to sit
            two steps under the label directly above it, which is what made
            an answered field read as fainter than the question. */}
        <span className="min-w-0 truncate text-[length:var(--tri-control-size)] font-normal leading-[1.4] tracking-normal text-[var(--tri-ink,#e5f3f2)]">
          {selectedOption ? selectedOption.label : placeholder}
        </span>

        {/* The glyph carries ~1.75 units of empty box on each side, so at the
            same padding as the label it reads a hair further off the right
            edge than the text does off the left. -mr-px pays that back. */}
        <ChevronDownIcon
          size={11}
          className={cx(
            '-mr-px shrink-0 text-[rgb(255_255_255_/_0.7)] transition-transform duration-200',
            isOpen ? 'rotate-180 text-[var(--tri-ink,#e5f3f2)]' : 'rotate-0',
          )}
        />
      </button>

      {/*
        Dropdown options. The list is the app's panel grey and every highlight —
        selected and hover alike — is white at low alpha, so no teal reaches
        the menu. The selected row is marked by weight plus a flat wash rather
        than tri-surface, which would drag the gradient back in.
      */}
      {isOpen && (
        <ul
          role="listbox"
          className="absolute top-[calc(100%+8px)] left-0 right-0 z-50 flex flex-col p-1.5 gap-1 overflow-hidden"
          style={{
            borderRadius: '16px',
            /*
             * The app's panel grey. Panel paints rgb(255 255 255 / 0.022) over
             * the #0a0a0a canvas; a menu has to be opaque or the rows it covers
             * show through, so this is that pair already composited — the same
             * colour, flattened. Neutral throughout: no green cast.
             */
            backgroundColor: '#101010',
            boxShadow: '0 14px 36px rgb(0 0 0 / 0.75), inset 0 0 0 var(--tri-border) rgb(255 255 255 / 0.16)',
          }}
        >
          {options.map((option) => {
            const isSelected = option.value === selectedValue;
            return (
              <li
                key={option.value}
                role="option"
                aria-selected={isSelected}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  handleSelect(option.value);
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelect(option.value);
                }}
                className={cx(
                  /* --tri-control-size, matching ActionMenu's rows. The two
                     menus open feet apart in the rail and ActionMenu's own
                     comment claims it copies this row's type size — which was
                     only true of its padding and height until now. */
                  'flex h-[var(--tri-option-h)] w-full items-center justify-between px-3.5 rounded-[10px] text-[length:var(--tri-control-size)] lowercase cursor-pointer transition-[opacity,background-color] duration-150 select-none text-[var(--tri-ink,#e5f3f2)]',
                  isSelected
                    ? 'font-medium bg-[rgb(255_255_255_/_0.07)]'
                    : 'opacity-75 hover:opacity-100 hover:bg-[rgb(255_255_255_/_0.05)]',
                )}
              >
                <span>{option.label}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
