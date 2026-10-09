import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '../../ui';

/** Native modal focus handling keeps the projector controls inactive until a choice is made. */
export function QrProjectionConfirm({ onDiscard, onConfirm }: {
  onDiscard: () => void;
  onConfirm: (dontShowAgain: boolean) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    element.showModal();
    element.querySelector<HTMLButtonElement>('[data-discard] button')?.focus();
    return () => element.close();
  }, []);

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={event => { event.preventDefault(); onDiscard(); }}
      className="tri-rounded-surface m-auto w-[440px] max-w-[calc(100vw-32px)] border-0 bg-[var(--tri-pop)] p-0 text-[var(--tri-ink)] backdrop:bg-[var(--tri-pop-scrim)]"
      style={{ boxShadow: 'inset 0 0 0 1px rgb(255 255 255 / 0.1), 0 24px 60px rgb(0 0 0 / 0.5)' }}
    >
      <div className="p-6">
        <h2 id={titleId} className="text-lg font-semibold">Show the QR code on the projector?</h2>
        <p id={descriptionId} className="mt-2 text-sm leading-relaxed text-[var(--tri-ink-muted)]">
          This will display the phone QR code on the projector for the congregation to scan and open the companion page. Click the QR button again to take it off the screen.
        </p>
        <button
          type="button"
          role="switch"
          aria-checked={dontShowAgain}
          onClick={() => setDontShowAgain(value => !value)}
          className="mt-5 flex w-full items-center justify-between gap-4 rounded-md py-2 text-sm"
        >
          <span>Don’t show again</span>
          <span aria-hidden="true" className="relative h-5 w-9 shrink-0 rounded-full transition-colors duration-150"
            style={{ background: dontShowAgain ? 'rgb(255 255 255 / 0.3)' : 'rgb(255 255 255 / 0.1)', boxShadow: 'inset 0 0 0 1px rgb(255 255 255 / 0.08)' }}>
            <span className="absolute left-[3px] top-[3px] size-[14px] rounded-full bg-[var(--tri-ink)] transition-transform duration-150 motion-reduce:transition-none"
              style={{ transform: `translateX(${dontShowAgain ? 16 : 0}px)` }} />
          </span>
        </button>
        <div className="mt-5 flex justify-end gap-2">
          <span data-discard><Button label="Discard" onClick={onDiscard} /></span>
          <Button label="Yes" tone="gold" onClick={() => onConfirm(dontShowAgain)} />
        </div>
      </div>
    </dialog>
  );
}
