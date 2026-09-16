import { useCallback, useEffect, useRef, useState } from 'react';
import { ForesightManager, type HitSlop } from 'js.foresight';

/*
 * Intent without instrumentation. The manager predicts a moving pointer's
 * approach to a small target, so the control can be ready before arrival.
 * Deliberately no devtools import or overlay: prediction remains private to
 * the interaction.
 */
let started = false;

function startForesight() {
  if (started) return;
  started = true;
  ForesightManager.initialize({
    trajectoryPredictionTime: 110,
    positionHistorySize: 10,
    enableMousePrediction: true,
    enableScrollPrediction: false,
    enableTabPrediction: false,
    defaultHitSlop: 0,
  });
}

export function useForesight<T extends HTMLElement>(name: string, hitSlop: HitSlop) {
  const ref = useRef<T>(null);
  const [predicted, setPredicted] = useState(false);
  const slopKey = JSON.stringify(hitSlop);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    startForesight();
    const { unregister } = ForesightManager.instance.register({
      element,
      name,
      hitSlop: JSON.parse(slopKey) as HitSlop,
      callback: () => setPredicted(true),
    });
    return () => {
      unregister();
      setPredicted(false);
    };
  }, [name, slopKey]);

  const relax = useCallback(() => {
    setPredicted(false);
    const element = ref.current;
    if (element) ForesightManager.instance.reactivate(element);
  }, []);

  return { ref, predicted, relax };
}
