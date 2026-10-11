import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { canGuideClick, canGuideWrite, type GuideStep } from '../lib/guideWalkthroughs';

export function guideElement(selector: string): HTMLElement | null {
  return [...document.querySelectorAll<HTMLElement>(selector)].find(element => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return element.isConnected && rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 && rect.top < innerHeight && rect.left < innerWidth && style.visibility !== 'hidden' && style.display !== 'none' && style.opacity !== '0' && !element.closest('[inert]');
  }) ?? null;
}
function pause(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException('Aborted', 'AbortError')); return; }
    const abort = () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); };
    const timer = window.setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, ms);
    signal.addEventListener('abort', abort, { once: true });
  });
}
export function useGuideCursor(panel: RefObject<HTMLElement | null>, avoid: (x: number, y: number) => void) {
  const cursor = useRef<HTMLDivElement>(null);
  const controller = useRef<AbortController | null>(null);
  const animation = useRef<Animation | null>(null);
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [target, setTarget] = useState<string | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [pulse, setPulse] = useState(0);
  const [caption, setCaption] = useState('');
  const [bubble, setBubble] = useState({ x: 0, y: 0 });
  const position = useRef({ x: 0, y: 0 });
  const initialized = useRef(false);
  const cancel = useCallback((hide = true) => {
    controller.current?.abort(); controller.current = null;
    if (animation.current && cursor.current) {
      const live = cursor.current.getBoundingClientRect();
      position.current = { x: live.left, y: live.top };
      cursor.current.style.transform = `translate(${live.left}px, ${live.top}px)`;
      animation.current.cancel(); animation.current = null;
    }
    setBusy(false);
    if (hide) { setVisible(false); setTarget(null); initialized.current = false; }
  }, []);
  useEffect(() => () => cancel(), [cancel]);
  useEffect(() => {
    if (!target) { setRect(null); return; }
    const measure = () => {
      const element = guideElement(target);
      const bounds = element?.getBoundingClientRect();
      const hit = bounds && document.elementFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
      setRect(bounds && hit && (element === hit || element?.contains(hit)) ? bounds : null);
    };
    measure(); const timer = window.setInterval(measure, 180);
    return () => clearInterval(timer);
  }, [target]);

  const run = useCallback(async (step: GuideStep, perform: boolean): Promise<boolean> => {
    cancel(false);
    const control = new AbortController(); controller.current = control;
    const signal = control.signal;
    setBusy(true); setTarget(step.target); setVisible(true); setCaption(step.prompt);
    try {
      let element: HTMLElement | null = null;
      for (let retry = 0; retry < (step.id === 'stock-pick' ? 100 : 20) && !element; retry++) { element = guideElement(step.target); if (!element) await pause(100, signal); }
      if (!element) throw new Error('I can’t see that control. Return to this task, then try again.');
      if (element.matches(':disabled, [aria-disabled="true"]')) throw new Error('That control isn’t available yet.');
      const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      // Re-measure after panel movement and after flight: never click old coordinates.
      for (let attempt = 0; attempt < 3; attempt++) {
        const bounds = element.getBoundingClientRect();
        const x = Math.max(6, Math.min(innerWidth - 24, bounds.left + bounds.width / 2));
        const y = Math.max(6, Math.min(innerHeight - 28, bounds.top + bounds.height / 2));
        avoid(x, y);
        await pause(40, signal);
        if (!initialized.current) {
          const home = panel.current?.getBoundingClientRect();
          position.current = { x: home ? home.left + 26 : innerWidth - 48, y: home ? home.top + 25 : 80 };
          initialized.current = true;
        }
        const from = position.current;
        const node = cursor.current;
        if (!node) throw new Error('The guide cursor is unavailable.');
        const transform = `translate(${x}px, ${y}px)`;
        const motion = node.animate([{ transform: `translate(${from.x}px, ${from.y}px)` }, { transform }], { duration: reduced ? 0 : Math.min(850, Math.max(400, Math.hypot(x - from.x, y - from.y) * .6 + 320)), easing: 'cubic-bezier(0.32, 0.72, 0, 1)', fill: 'forwards' });
        animation.current = motion;
        await motion.finished;
        signal.throwIfAborted();
        setBubble({ x: Math.max(12, Math.min(innerWidth - 256, x + 22)), y: y > innerHeight - 120 ? y - 95 : y + 34 });
        node.style.transform = transform; position.current = { x, y }; motion.cancel(); animation.current = null;
        const live = guideElement(step.target);
        if (live !== element) throw new Error('The screen changed. Let’s find that control again.');
        const next = live.getBoundingClientRect();
        if (Math.abs(next.left + next.width / 2 - x) > 5 || Math.abs(next.top + next.height / 2 - y) > 5) {
          if (attempt === 2) throw new Error('That control is still moving. Try again in a moment.');
          continue;
        }
        const hit = document.elementFromPoint(x, y);
        if (!hit || !(live === hit || live.contains(hit))) throw new Error('Something is covering this control. Close it or move it aside, then retry.');
        if (perform) {
          if (live.matches(':disabled, [aria-disabled="true"]')) throw new Error('That control isn’t available yet.');
          setPulse(n => n + 1);
          setCaption(step.action === 'write' ? 'Writing here…' : step.prompt);
          await pause(reduced ? 0 : 150, signal);
          if (!live.isConnected || guideElement(step.target) !== live) throw new Error('The screen changed before the click. Please retry.');
          const clickBounds = live.getBoundingClientRect();
          const clickHit = document.elementFromPoint(x, y);
          if (live.matches(':disabled, [aria-disabled="true"]') || Math.abs(clickBounds.left + clickBounds.width / 2 - x) > 5 || Math.abs(clickBounds.top + clickBounds.height / 2 - y) > 5 || !clickHit || !(live === clickHit || live.contains(clickHit))) throw new Error('The control moved or became unavailable. Please retry.');
          if (step.action === 'click') {
            if (!canGuideClick(step)) throw new Error('This step needs your click.');
            live.click();
          } else if (step.action === 'focus') live.focus({ preventScroll: true });
          else if (step.action === 'write') {
            if (!canGuideWrite(step) || !(live instanceof HTMLInputElement || live instanceof HTMLTextAreaElement) || live instanceof HTMLInputElement && !['text', 'search'].includes(live.type)) throw new Error('This field needs your input.');
            if (live.readOnly || live.disabled) throw new Error('This field isn’t editable yet.');
            if (!['reference', 'search'].includes(step.field ?? '') && live.value.trim() && live.value !== step.text) throw new Error('There’s already text here. Keep it with “I’ve entered it”, or clear the field before I type.');
            live.focus({ preventScroll: true });
            const setter = Object.getOwnPropertyDescriptor(live instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value')?.set;
            if (!setter) throw new Error('Please type this one yourself.');
            // Dispatch through the native setter so React’s controlled inputs see the change.
            // References validate a whole string; do not send Enter (it publishes).
            const text = step.text!;
            const chunk = reduced || step.field === 'reference' ? Math.max(1, text.length) : Math.max(1, Math.ceil(text.length / 24));
            for (let end = chunk; end < text.length + chunk; end += chunk) {
              signal.throwIfAborted();
              if (!live.isConnected || document.activeElement !== live) throw new Error('You took over. Your text is still here.');
              setter.call(live, text.slice(0, Math.min(end, text.length)));
              live.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: null }));
              await pause(reduced ? 0 : 35, signal);
            }
            if (live.value.trim() !== text.trim()) throw new Error('The field didn’t accept those words. Check them here, then continue.');
            setCaption('Your words are here. Ready for the next step?');
          }
          if (step.done) {
            for (let retry = 0; retry < 25 && !guideElement(step.done); retry++) await pause(100, signal);
            if (!guideElement(step.done)) throw new Error('That didn’t open as expected. Try it again, or take over.');
          }
          await pause(step.holdMs ?? (reduced ? 100 : 500), signal);
        }
        return true;
      }
      return false;
    } catch (error) {
      if (signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) return false;
      throw error;
    } finally { if (controller.current === control) { controller.current = null; setBusy(false); } }
  }, [avoid, cancel, panel]);
  return { cursor, visible, busy, target, rect, pulse, caption, bubble, run, cancel };
}
