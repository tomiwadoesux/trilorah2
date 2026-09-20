import { cx } from '../lib/cx';
import { SearchIcon } from '../icons';

/*
 * A plain search box, at field height.
 *
 * Deliberately the dumb one. The scriptures tab needs a field that refuses
 * impossible keystrokes because its vocabulary is closed and known; a song
 * library is neither, so the same machinery there would only get in the way
 * of someone typing half a lyric they half remember.
 */

export interface SearchFieldProps {
  value?: string;
  onChange?: (next: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Enter. */
  onSubmit?: (value: string) => void;
  className?: string;
}

export function SearchField({
  value = '',
  onChange,
  placeholder = 'search...',
  disabled = false,
  onSubmit,
  className = '',
}: SearchFieldProps) {
  return (
    <div
      className={cx(
        'tri-rounded-control flex h-[var(--tri-field-h)] w-full items-center gap-2.5 px-3.5 lowercase',
        disabled ? 'opacity-40' : 'bg-[rgb(0_0_0_/_0.20)]',
        className,
      )}
    >
      <SearchIcon size={13} className="shrink-0 text-[rgb(229_243_242_/_0.45)]" />
      <input
        type="text"
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        spellCheck={false}
        autoComplete="off"
        onChange={(e) => onChange?.(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSubmit?.(value);
        }}
        className={cx(
          /* Control size: this is text the operator types, in a box a
             --tri-field-h tall. At the meta step it was a 10px line floating
             in a 38px field. */
          'min-w-0 flex-1 bg-transparent text-[length:var(--tri-control-size)] leading-none tracking-normal',
          'text-[var(--tri-ink,#e5f3f2)] placeholder:text-[rgb(229_243_242_/_0.34)]',
          'focus:outline-none disabled:cursor-not-allowed',
          /* No rule of its own. The app's base stylesheet underlines every
             bare <input> (index.css — the legacy forms rely on it), and
             inside a filled, rounded box that hairline read as a stray line
             cutting the field in two. The box is the field; the input is
             only where the caret lives. */
          'border-0',
        )}
      />
    </div>
  );
}
