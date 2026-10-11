import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { SoundwaveIcon, ChevronDownIcon, CheckIcon, cx } from '../ui';
import { usePopupPlacement, popupBounds } from '../ui/primitives/usePopupPlacement';
import { useAppStore } from '../stores/appStore';
import { listAudioInputs, onDeviceChange } from '../lib/audioDevices';
import { usePracticeStore } from '../stores/practiceStore';
import { PRACTICE_SERMON_DEVICE } from '../../shared/practiceSermon';
import { PHONE_MIC_LABEL } from '../../shared/audioInput';
import { PhoneMicPanel } from './PhoneMicPanel';
import { usePhoneMicStore } from '../lib/phoneMic';
import { useNoticeNavigation } from '../lib/notificationNavigation';

/*
 * Which microphone or computer audio the service is heard through.
 *
 * It sits on the LIVE toolbar beside "start listening", because that is the
 * moment the choice matters: the engine binds the device when it starts and
 * reads the saved micDeviceLabel to do so. Locked while listening — a picker
 * that looked live but changed nothing until the next start would be lying
 * about which microphone is open.
 *
 * The button says "audio" and no more than a nickname for the input: the
 * full device names ("MacBook Air Microphone") took a third of the toolbar.
 * The names are in the menu it opens, and in the tooltip.
 */

/** Seven letters and an ellipsis — enough to tell two inputs apart. */
function nickname(label: string) {
  if (label.length <= 7) return label;
  return `${label.slice(0, 7).replace(/[^a-z0-9]+$/i, '')}…`;
}

export function MicPicker({ compact = false }: { compact?: boolean } = {}) {
  const asrStatus = useAppStore((s) => s.asrStatus);
  const settings = useAppStore((s) => s.settings);
  const patchSetting = useAppStore((s) => s.patchSetting);
  const [inputs, setInputs] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const position = usePopupPlacement(open, triggerRef, menuRef, 'left');

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      void listAudioInputs().then((list) => {
        if (!cancelled) setInputs(list.map((d) => d.label));
      });
    };
    load();
    const unsub = onDeviceChange(load);
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  const saved = typeof settings?.micDeviceLabel === 'string' ? settings.micDeviceLabel : '';
  const busy = asrStatus === 'listening' || asrStatus === 'connecting';
  /* The practice sermon is one more input in the list, but it is never
     saved: see stores/practiceStore. */
  const practice = usePracticeStore((s) => s.on);
  const setPractice = usePracticeStore((s) => s.setOn);
  /* The phone over Wi-Fi is one more input; choosing it opens its box. */
  const [phoneOpen, setPhoneOpen] = useState(false);
  const noticeRequest = useNoticeNavigation(s => s.request);
  useEffect(() => {
    const navigation = useNoticeNavigation.getState();
    if (navigation.target === 'audio') { setOpen(true); navigation.clear(); }
    if (navigation.target === 'phone') { setPhoneOpen(true); navigation.clear(); }
  }, [noticeRequest, compact]);
  const phone = usePhoneMicStore((s) => s.status);
  const phoneLabel = phone.state === 'connected' && phone.phoneName ? `phone · ${phone.phoneName}` : 'phone (over wi-fi)';

  const options = [
    { value: '', label: 'system default' },
    ...inputs.map((label) => ({ value: label, label })),
    /* Three minutes of scripted preaching through the real engine — for
       trying every kind of catch without speaking. */
    { value: PRACTICE_SERMON_DEVICE, label: PRACTICE_SERMON_DEVICE },
    { value: PHONE_MIC_LABEL, label: phoneLabel },
  ];
  /* A "Default - …" label saved before those copies were hidden means
     "follow the system", which is what system default says. */
  const current = practice ? PRACTICE_SERMON_DEVICE : /^default - /i.test(saved) ? '' : saved;
  const currentLabel = options.find((o) => o.value === current)?.label ?? current;

  /* Close when listening starts, but allow a problem link to open the picker
     while already listening, including when it mounts after navigation. */
  const previousBusy = useRef(busy);
  useEffect(() => {
    if (busy && !previousBusy.current) setOpen(false);
    previousBusy.current = busy;
  }, [busy]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!menuRef.current?.contains(t) && !triggerRef.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  /* Opening lands on the input in use, so the arrows start from there. Once
     per opening: a later re-placement must not pull focus back. */
  const placed = position !== null;
  useEffect(() => {
    if (!open || !placed) return;
    menuRef.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus();
  }, [open, placed]);

  const choose = async (value: string) => {
    setOpen(false);
    triggerRef.current?.focus();
    if (value === PHONE_MIC_LABEL) { setPhoneOpen(true); return; }
    if (value === PRACTICE_SERMON_DEVICE) {
      if (busy) window.api?.stopListening();
      setPractice(true);
      return;
    }
    setPractice(false);
    await window.api?.setSetting('micDeviceLabel', value);
    patchSetting('micDeviceLabel', value);
    if (busy && value !== PHONE_MIC_LABEL) {
      window.api?.stopListening();
      window.api?.startListening(value || undefined);
    }
  };

  const onMenuKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const rows = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? []);
    const at = rows.indexOf(document.activeElement as HTMLButtonElement);
    const next = e.key === 'ArrowDown' ? (at + 1) % rows.length : (at - 1 + rows.length) % rows.length;
    rows[next]?.focus();
  };

  const phoneDot = !practice && saved === PHONE_MIC_LABEL;

  return (
    <>
      <button
        ref={triggerRef}
        data-guide="audio-input"
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`audio input: ${currentLabel || 'system default'}`}
        title={busy ? 'change audio input — listening restarts when you select a device' : currentLabel || 'microphone or computer audio'}
        onClick={() => setOpen((o) => !o)}
        className={compact
          ? 'relative flex h-[var(--tri-field-h)] w-[var(--library-pill-width)] shrink-0 items-center gap-2 rounded-[var(--tri-radius-control)] border border-white/[0.12] bg-[#111111] pl-3 pr-4 text-left text-[length:var(--tri-control-size)] lowercase text-[rgb(229_243_242_/_0.58)] hover:bg-white/[0.04] hover:text-[rgb(229_243_242_/_0.85)]'
          : 'tri-header-control tri-header-audio flex shrink-0 items-center gap-1.5 lowercase'}
      >
        <SoundwaveIcon size={compact ? 14 : 12} className={compact ? "shrink-0 opacity-60" : "tri-header-icon"} />
        <span>audio</span>
        {!compact && current && <span className="opacity-70">{nickname(currentLabel)}</span>}
        {/* The phone chosen: a dot for its state. */}
        {!compact && phoneDot && (
          <span
            aria-hidden
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ background: phone.state === 'connected' ? 'rgb(var(--tri-go-2))' : phone.state === 'pending' || phone.state === 'waiting' || phone.state === 'connecting' ? 'var(--tri-accent-yellow)' : 'rgb(229 243 242 / 0.3)' }}
          />
        )}
        <ChevronDownIcon
          size={10}
          className={cx('shrink-0 opacity-70 transition-transform duration-200', compact && 'absolute right-1', open && 'rotate-180')}
        />
      </button>
      {/* The same panel grey and white washes as the app's Select menu. */}
      {open && createPortal(
        <div
          ref={menuRef}
          data-guide="audio-options"
          role="menu"
          aria-label="audio input"
          onKeyDown={onMenuKey}
          className="fixed z-[100] flex min-w-[14rem] flex-col gap-1 p-1.5"
          style={{
            ...popupBounds,
            left: position?.left ?? 0,
            top: position?.top ?? 0,
            visibility: position ? 'visible' : 'hidden',
            borderRadius: '8px',
            backgroundColor: '#101010',
            boxShadow: '0 14px 36px rgb(0 0 0 / 0.75), inset 0 0 0 var(--tri-border) rgb(255 255 255 / 0.16)',
          }}
        >
          {busy && <p className="px-3 py-2 text-xs text-neutral-400">Choosing an input restarts listening. Phone audio opens setup first.</p>}
          {options.map((o) => {
            const on = o.value === current;
            return (
              <button
                key={o.value || 'default'}
                type="button"
                role="menuitemradio"
                aria-checked={on}
                onClick={() => { void choose(o.value).catch(() => undefined); }}
                className={cx(
                  'flex h-[var(--tri-option-h)] w-full shrink-0 items-center justify-between gap-3 rounded-[6px] px-3.5 text-left text-[length:var(--tri-control-size)] lowercase text-[var(--tri-ink,#e5f3f2)] outline-none transition-[opacity,background-color] duration-150',
                  on
                    ? 'bg-[rgb(255_255_255_/_0.07)] font-medium'
                    : 'opacity-75 hover:bg-[rgb(255_255_255_/_0.05)] hover:opacity-100 focus-visible:bg-[rgb(255_255_255_/_0.05)] focus-visible:opacity-100',
                )}
              >
                <span className="min-w-0 truncate">{o.label}</span>
                {on && <CheckIcon size={12} className="shrink-0 opacity-80" />}
              </button>
            );
          })}
        </div>,
        document.body,
      )}
      <PhoneMicPanel open={phoneOpen} onClose={() => setPhoneOpen(false)} />
    </>
  );
}
