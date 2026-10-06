export type ClockHands = {
  hour: number;
  minute: number;
  second: number;
};

/** Read local wall time afresh; elapsed timers never determine the clock's time. */
export function deviceClockHands(date: Date): ClockHands {
  const seconds = date.getSeconds();
  const minutes = date.getMinutes() + seconds / 60;
  return {
    hour: ((date.getHours() % 12) + minutes / 60) * 30,
    minute: minutes * 6,
    second: seconds * 6,
  };
}

function nearestTurn(previous: number, target: number) {
  return previous + ((((target - previous) % 360) + 540) % 360 - 180);
}

/** Preserve the equivalent turn nearest the displayed hand, including 59 → 00. */
export function alignClockHands(previous: ClockHands, target: ClockHands): ClockHands {
  const next = {
    hour: nearestTurn(previous.hour, target.hour),
    minute: nearestTurn(previous.minute, target.minute),
    second: nearestTurn(previous.second, target.second),
  };
  return next.hour === previous.hour && next.minute === previous.minute && next.second === previous.second
    ? previous
    : next;
}

type ClockEnvironment = {
  visibility: EventTarget & { readonly visibilityState: DocumentVisibilityState };
  focus: EventTarget;
};

/** Sample promptly while visible, suspend completely while hidden, and resync on return. */
export function observeDeviceClock(
  onChange: (hands: ClockHands) => void,
  environment: ClockEnvironment = { visibility: document, focus: window },
) {
  let timer: ReturnType<typeof setInterval> | undefined;
  let previous: ClockHands | undefined;

  const sample = () => {
    const hands = deviceClockHands(new Date());
    if (previous && previous.hour === hands.hour && previous.minute === hands.minute && previous.second === hands.second) return;
    previous = hands;
    onChange(hands);
  };

  const stop = () => {
    if (timer !== undefined) clearInterval(timer);
    timer = undefined;
  };

  const sync = () => {
    stop();
    if (environment.visibility.visibilityState === 'hidden') return;
    sample();
    timer = setInterval(sample, 100);
  };

  environment.visibility.addEventListener('visibilitychange', sync);
  environment.focus.addEventListener('focus', sync);
  sync();

  return () => {
    stop();
    environment.visibility.removeEventListener('visibilitychange', sync);
    environment.focus.removeEventListener('focus', sync);
  };
}
