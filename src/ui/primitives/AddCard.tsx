import { PlusIcon } from '../icons';
import { cx } from '../lib/cx';

export interface AddCardProps {
  /** The gesture, in the grid's own voice — "add song", "import slides". */
  label: string;
  /** The second line, where a card carries its artist or its page count. */
  hint?: string;
  onClick?: () => void;
  className?: string;
}

/**
 * The hollow cell every card grid opens with.
 *
 * Sized, captioned and ruled exactly like the cards beside it — same
 * 16/9 picture, same two-line caption, same corner — so the grid's rhythm
 * does not break on it; drawn as a dashed outline over nothing so it can
 * never be mistaken for a real one. The control is the shape of the thing
 * it makes, which explains the button better than the words under it do.
 *
 * It leads the grid rather than trailing it: the way to add something is at
 * the top left where the eye starts, not behind however many rows the
 * library has grown to.
 */
export function AddCard({ label, hint, onClick, className = '' }: AddCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'group/card block w-full pb-3 text-left transition-transform duration-150 ease-out hover:-translate-y-[2px]',
        className,
      )}
      style={{ boxShadow: 'inset 0 -1px 0 rgb(255 255 255 / 0.08)' }}
    >
      <span
        className={cx(
          'tri-rounded-control flex w-full items-center justify-center',
          'bg-[rgb(255_255_255_/_0.02)] transition-colors group-hover/card:bg-[rgb(255_255_255_/_0.05)]',
        )}
        style={{
          aspectRatio: '16 / 9',
          /* Dashed, at the system width: an outline that says "not yet".
             `outline` rather than a border or an inset shadow because it is
             the one stroke that follows the squircle without fattening at
             the corners — see the note in tokens. */
          outline: 'var(--tri-border) dashed rgb(255 255 255 / 0.22)',
          outlineOffset: 'calc(-1 * var(--tri-border))',
        }}
      >
        <PlusIcon
          size={18}
          className="text-[rgb(229_243_242_/_0.55)] transition-colors group-hover/card:text-[var(--tri-ink)]"
        />
      </span>
      <span className="mt-2 block px-0.5">
        <span className="block truncate text-[length:var(--tri-size-sm)] font-semibold leading-[1.25] text-[rgb(229_243_242_/_0.72)] transition-colors group-hover/card:text-[var(--tri-ink)]">
          {label}
        </span>
        {hint ? (
          <span className="mt-[2px] block truncate text-[length:var(--tri-size-xs)] leading-[1.3] text-[rgb(229_243_242_/_0.42)]">
            {hint}
          </span>
        ) : null}
      </span>
    </button>
  );
}
