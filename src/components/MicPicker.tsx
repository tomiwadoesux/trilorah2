import { useEffect, useState } from 'react';
import { SoundwaveIcon } from '../ui';
import { useAppStore } from '../stores/appStore';
import { listAudioInputs, onDeviceChange } from '../lib/audioDevices';
import { usePracticeStore } from '../stores/practiceStore';
import { PRACTICE_SERMON_DEVICE } from '../../shared/practiceSermon';
import { PHONE_MIC_LABEL } from '../../shared/audioInput';
import { PhoneMicPanel } from './PhoneMicPanel';
import { usePhoneMicStore } from '../lib/phoneMic';

/*
 * Which microphone or computer audio the service is heard through.
 *
 * It sits on the LIVE toolbar beside "start listening", because that is the
 * moment the choice matters: the engine binds the device when it starts and
 * reads the saved micDeviceLabel to do so. Locked while listening — a picker
 * that looked live but changed nothing until the next start would be lying
 * about which microphone is open.
 */
export function MicPicker() {
  const asrStatus = useAppStore((s) => s.asrStatus);
  const settings = useAppStore((s) => s.settings);
  const patchSetting = useAppStore((s) => s.patchSetting);
  const [inputs, setInputs] = useState<string[]>([]);

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
  const phone = usePhoneMicStore((s) => s.status);
  const phoneLabel = phone.state === 'connected' && phone.phoneName ? `phone · ${phone.phoneName}` : 'phone (over wi-fi)';

  return (
    <label className="tri-header-control tri-header-audio flex shrink-0 items-center gap-1.5 lowercase" title={busy ? 'stop listening to change the audio input' : 'microphone or computer audio'}>
      <SoundwaveIcon size={12} className="tri-header-icon" />
      <span className="opacity-70">audio</span>
      <select
        value={practice ? PRACTICE_SERMON_DEVICE : saved}
        disabled={busy}
        aria-label="audio input"
        onChange={(e) => {
          if (e.target.value === PRACTICE_SERMON_DEVICE) {
            setPractice(true);
            return;
          }
          setPractice(false);
          patchSetting('micDeviceLabel', e.target.value);
          void window.api?.setSetting('micDeviceLabel', e.target.value);
          if (e.target.value === PHONE_MIC_LABEL) setPhoneOpen(true);
        }}
        className="max-w-[11rem] min-w-0 cursor-pointer truncate bg-transparent text-inherit outline-none disabled:cursor-not-allowed disabled:opacity-60"
      >
        <option value="">system default</option>
        {inputs.map((label) => (
          <option key={label} value={label}>
            {label}
          </option>
        ))}
        {/* Three minutes of scripted preaching through the real engine —
            for trying every kind of catch without speaking. */}
        <option value={PRACTICE_SERMON_DEVICE}>{PRACTICE_SERMON_DEVICE}</option>
        <option value={PHONE_MIC_LABEL}>{phoneLabel}</option>
      </select>
      {/* The phone chosen: a dot for its state, and the way back into its box. */}
      {!practice && saved === PHONE_MIC_LABEL && (
        <button
          type="button"
          aria-label="phone microphone"
          title={phone.state === 'connected' ? `${phone.phoneName} is connected` : 'connect the phone'}
          onClick={(e) => { e.preventDefault(); setPhoneOpen(true); }}
          className="ml-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
        >
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: phone.state === 'connected' ? 'rgb(var(--tri-go-2))' : phone.state === 'pending' || phone.state === 'waiting' || phone.state === 'connecting' ? 'var(--tri-accent-yellow)' : 'rgb(229 243 242 / 0.3)' }}
          />
        </button>
      )}
      <PhoneMicPanel open={phoneOpen} onClose={() => setPhoneOpen(false)} />
    </label>
  );
}
