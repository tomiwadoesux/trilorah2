'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { DEMO_CUES, type DemoActor, type DemoCue, type DemoState } from './service-demo-timeline';
import './service-demo-actors.css';

export interface ServiceDemoActorsProps {
  document: Document | null;
  demo: DemoState;
  running: boolean;
  reduced: boolean;
  playbackRevision: number;
}

type Point = { x: number; y: number };
const SIZE = 38;
const CENTER = SIZE / 2;
const OUT = 'cubic-bezier(.23, 1, .32, 1)';
const TRAVEL = 'cubic-bezier(.32, .72, 0, 1)';
const ACTORS: DemoActor[] = ['circle', 'triangle', 'box'];
const EYES: Record<DemoActor, Point> = {
  circle: { x: 19, y: 45 * SIZE / 258 },
  triangle: { x: 192 * SIZE / 258, y: 100 * SIZE / 258 },
  box: { x: 188 * SIZE / 258, y: 70 * SIZE / 258 },
};
const ROLES = {
  circle: { name: 'Circle', role: 'I listen', text: 'I listen as the service unfolds. While someone speaks or sings, I keep the transcript flowing so the others can find what belongs on screen.' },
  triangle: { name: 'Triangle', role: 'I operate', text: 'I work the controls. I find songs, choose scripture, and move to the next verse. You can follow my little black point to see exactly what I click.' },
  box: { name: 'Square', role: 'I send', text: 'I send songs, scripture, images, and slides to the congregation. When the next item is ready, I put it on the live screen so everyone can follow along.' },
};
const WARNING = 'I have a task—back in a moment.';
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));

function targetFor(doc: Document, cue: DemoCue): { point: Point; element: HTMLElement | null } {
  const element = cue.selector ? doc.querySelector<HTMLElement>(cue.selector) : null;
  const rect = element?.getBoundingClientRect();
  const anchor = cue.anchor ?? [.5, .5];
  return {
    element,
    point: rect ? { x: rect.left + rect.width * anchor[0], y: rect.top + rect.height * anchor[1] }
      : { x: (doc.documentElement.clientWidth || 1600) * anchor[0], y: (doc.documentElement.clientHeight || 940) * anchor[1] },
  };
}

function parkedTarget(doc: Document, actor: DemoActor) {
  return targetFor(doc, {
    id: 'park', actor, at: 0,
    selector: actor === 'box' ? '[data-guide-area="live"]' : actor === 'circle' ? '[data-guide="transcript-open-header"]' : null,
    anchor: actor === 'box' ? [.95, .07] : actor === 'circle' ? [.94, .5] : [.46, .027],
  });
}

function translated(element: HTMLElement, fallback: Point): Point {
  const transform = getComputedStyle(element).transform;
  if (!transform || transform === 'none') return fallback;
  const matrix = new DOMMatrixReadOnly(transform);
  return { x: matrix.m41, y: matrix.m42 };
}

/** The eye can lead a click while staying close to, or inside, its silhouette. */
function leadingEye(actor: DemoActor, direction: Point): Point {
  const distance = Math.hypot(direction.x, direction.y) || 1;
  const point = { x: CENTER + direction.x / distance * 10, y: CENTER + direction.y / distance * 10 };
  if (actor === 'triangle') {
    point.y = clamp(point.y, 9, 24);
    const halfWidth = point.y / Math.sqrt(3) - 2;
    point.x = clamp(point.x, CENTER - halfWidth, CENTER + halfWidth);
  }
  return point;
}

function Body({ actor }: { actor: DemoActor }) {
  return <svg viewBox="0 0 258 258" aria-hidden="true" focusable="false">
    {actor === 'circle' ? <circle cx="129" cy="129" r="129" />
      : actor === 'box' ? <path d="M0 0H258V258H0Z" />
        : <path d="M129 0 240.717 193.5H17.2827Z" />}
  </svg>;
}

function ServiceActor({ actor, document: nativeDocument, demo, running, reduced, playbackRevision }: ServiceDemoActorsProps & { actor: DemoActor }) {
  const button = useRef<HTMLButtonElement>(null);
  const body = useRef<HTMLSpanElement>(null);
  const hoverBody = useRef<HTMLSpanElement>(null);
  const spin = useRef<HTMLSpanElement>(null);
  const eye = useRef<HTMLSpanElement>(null);
  const ripple = useRef<HTMLSpanElement>(null);
  const bubble = useRef<HTMLSpanElement>(null);
  const animations = useRef(new Set<Animation>());
  const hoverAnimation = useRef<Animation>();
  const memory = useRef({ cue: '', click: '', nativePress: '', look: '', revision: -1, document: null as Document | null, reduced, position: { x: 0, y: 0 }, eye: EYES[actor], target: { x: 0, y: 0 }, nativeTarget: null as HTMLElement | null });
  const conversation = useRef({ cursor: 0, visited: false, warning: false });
  const [openMode, setOpenMode] = useState<'hover' | 'focus' | 'pinned' | null>(null);
  const [text, setText] = useState('');
  const id = useId();
  const open = openMode !== null;
  const info = ROLES[actor];
  const closeConversation = useCallback(() => setOpenMode(null), []);

  const animate = useCallback((element: Element, frames: Keyframe[], options: KeyframeAnimationOptions) => {
    const animation = element.animate(frames, options);
    animations.current.add(animation);
    animation.onfinish = () => animations.current.delete(animation);
    animation.oncancel = () => animations.current.delete(animation);
    if (!running) animation.pause();
    return animation;
  }, [running]);

  useEffect(() => {
    const active = animations.current;
    return () => {
      active.forEach(animation => animation.cancel());
      active.clear();
      hoverAnimation.current?.cancel();
    };
  }, []);

  useEffect(() => {
    for (const animation of animations.current) {
      if (animation.playState === 'finished') continue;
      if (demo.complete) animation.cancel();
      else if (running) animation.play();
      else animation.pause();
    }
  }, [running, demo.complete]);

  useEffect(() => {
    if (!open) return;
    const doc = button.current?.ownerDocument;
    if (!doc) return;
    const outside = (event: PointerEvent) => {
      if (!button.current?.contains(event.target as Node)) closeConversation();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeConversation();
    };
    doc.addEventListener('pointerdown', outside, true);
    doc.addEventListener('keydown', escape, true);
    return () => {
      doc.removeEventListener('pointerdown', outside, true);
      doc.removeEventListener('keydown', escape, true);
    };
  }, [open, closeConversation]);

  useEffect(() => {
    if (!open) return;
    const chat = conversation.current;
    const words = info.text.split(' ');
    const prefix = chat.visited ? 'As I was saying… ' : '';
    chat.visited = true;
    chat.warning = false;
    setText(prefix + words.slice(0, chat.cursor).join(' '));
    if (reduced) {
      chat.cursor = words.length;
      setText(prefix + info.text);
      return;
    }
    const timer = window.setInterval(() => {
      if (chat.warning || chat.cursor >= words.length) {
        clearInterval(timer);
        return;
      }
      chat.cursor++;
      setText(prefix + words.slice(0, chat.cursor).join(' '));
    }, 105);
    return () => clearInterval(timer);
  }, [open, info.text, reduced]);

  useEffect(() => {
    if (!open || !running) return;
    const task = DEMO_CUES.find(cue => cue.actor === actor && cue.clickAt !== undefined && cue.clickAt > demo.elapsed);
    if (task && task.at - demo.elapsed <= 2000 && !conversation.current.warning) {
      conversation.current.warning = true;
      setText(WARNING);
    }
  }, [actor, demo.elapsed, open, running]);

  useLayoutEffect(() => {
    const el = button.current;
    if (!nativeDocument || !el || !eye.current || !spin.current || !body.current || !ripple.current) return;
    const state = memory.current;
    const cue = demo.actors[actor];
    const reset = state.revision !== playbackRevision || state.document !== nativeDocument || state.reduced !== reduced;
    if (reset) {
      animations.current.forEach(animation => animation.cancel());
      animations.current.clear();
      hoverAnimation.current?.cancel();
      if (hoverBody.current) hoverBody.current.style.transform = 'scale(1)';
      state.cue = ''; state.look = '';
      // Seeking is an immediate snapshot, not a replay of a past click.
      state.click = demo.clicks.find(click => click.actor === actor)?.id ?? '';
      state.nativePress = cue.clickAt !== undefined && cue.clickAt <= demo.elapsed ? cue.id : '';
      state.revision = playbackRevision;
      state.document = nativeDocument;
      state.reduced = reduced;
      closeConversation();
    }
    const freshCue = state.cue !== cue.id;
    if (freshCue) {
      if (conversation.current.warning && cue.clickAt !== undefined) {
        closeConversation();
      }
      let measured = targetFor(nativeDocument, cue);
      const hasTarget = !cue.selector || !!measured.element;
      if (!hasTarget) measured = parkedTarget(nativeDocument, actor);
      const from = translated(el, state.position);
      const distance = Math.hypot(measured.point.x - from.x - CENTER, measured.point.y - from.y - CENTER);
      const nextEye = cue.clickAt !== undefined && hasTarget
        ? leadingEye(actor, { x: measured.point.x - from.x - CENTER, y: measured.point.y - from.y - CENTER }) : EYES[actor];
      const destination = cue.clickAt !== undefined && hasTarget
        ? { x: measured.point.x - nextEye.x, y: measured.point.y - nextEye.y }
        : { x: measured.point.x - CENTER, y: measured.point.y - CENTER };
      const remaining = cue.clickAt === undefined ? 600 : Math.max(0, cue.clickAt - demo.elapsed - 85);
      const duration = reduced || reset || cue.at === 0 ? 0 : Math.min(remaining, clamp(450 + distance / 6, 450, 600));
      const to = `translate3d(${destination.x}px, ${destination.y}px, 0)`;
      el.getAnimations().forEach(animation => animation.cancel());
      el.style.transform = to;
      el.style.opacity = '1';
      el.dataset.target = cue.selector ?? 'rest';
      el.dataset.targetX = String(measured.point.x);
      el.dataset.targetY = String(measured.point.y);
      el.dataset.hotspotX = String(nextEye.x);
      el.dataset.hotspotY = String(nextEye.y);
      if (duration) animate(el, [{ transform: `translate3d(${from.x}px, ${from.y}px, 0)` }, { transform: to }], { duration, easing: TRAVEL });
      const eyeFrom = getComputedStyle(eye.current).transform;
      const eyeTo = `translate3d(${nextEye.x - EYES[actor].x}px, ${nextEye.y - EYES[actor].y}px, 0)`;
      eye.current.getAnimations().forEach(animation => animation.cancel());
      eye.current.style.transform = eyeTo;
      if (duration) animate(eye.current, [{ transform: eyeFrom === 'none' ? 'translate3d(0,0,0)' : eyeFrom }, { transform: eyeTo }], { duration: 150, easing: OUT });
      const spinFrom = getComputedStyle(spin.current).transform;
      spin.current.getAnimations().forEach(animation => animation.cancel());
      spin.current.style.transform = 'rotate(0deg)';
      if (duration && actor !== 'circle' && distance > 35) {
        const matrix = new DOMMatrixReadOnly(spinFrom === 'none' ? undefined : spinFrom);
        const angle = Math.atan2(matrix.m12, matrix.m11) * 180 / Math.PI;
        const turns = distance < 250 ? 1 : distance < 700 ? 2 : 3;
        const direction = measured.point.x >= from.x + CENTER ? 1 : -1;
        animate(spin.current, [{ transform: `rotate(${angle}deg)` }, { transform: `rotate(${direction * turns * 360}deg)` }], { duration, easing: TRAVEL });
      }
      state.cue = cue.id; state.position = destination; state.eye = nextEye;
      state.target = measured.point; state.nativeTarget = hasTarget ? measured.element : null; state.look = '';
      if (bubble.current) {
        bubble.current.dataset.side = destination.y > 670 ? 'above' : 'below';
        bubble.current.style.left = `${clamp(CENTER, 160 - destination.x, 1440 - destination.x)}px`;
      }
    }

    // A restrained glance anticipates the next destination. It is independent
    // of body rotation, hover scale and button press, and never bounces.
    const upcoming = DEMO_CUES.find(item => item.actor === actor && item.at > demo.elapsed);
    if (running && !reduced && upcoming && upcoming.at - demo.elapsed <= 150 && state.look !== upcoming.id) {
      const destination = targetFor(nativeDocument, upcoming).point;
      const dx = destination.x - state.position.x - state.eye.x;
      const dy = destination.y - state.position.y - state.eye.y;
      const length = Math.hypot(dx, dy) || 1;
      const glancePoint = { x: state.eye.x + dx / length * 3, y: state.eye.y + dy / length * 3 };
      const radius = Math.hypot(glancePoint.x - CENTER, glancePoint.y - CENTER);
      if (radius > 12.5) {
        glancePoint.x = CENTER + (glancePoint.x - CENTER) / radius * 12.5;
        glancePoint.y = CENTER + (glancePoint.y - CENTER) / radius * 12.5;
      }
      const glance = `translate3d(${glancePoint.x - EYES[actor].x}px, ${glancePoint.y - EYES[actor].y}px, 0)`;
      const from = getComputedStyle(eye.current).transform;
      eye.current.getAnimations().forEach(animation => animation.cancel());
      eye.current.style.transform = glance;
      animate(eye.current, [{ transform: from === 'none' ? 'translate3d(0,0,0)' : from }, { transform: glance }], { duration: 150, easing: OUT });
      state.look = upcoming.id;
    }

    // Give the actual native control a short press before its result replaces
    // the snapshot. This never invokes app handlers or changes playback time.
    const untilClick = cue.clickAt === undefined ? Infinity : cue.clickAt - demo.elapsed;
    if (!reset && running && untilClick <= 170 && untilClick >= -100 && state.nativePress !== cue.id) {
      const target = nativeDocument.querySelector<HTMLElement>(cue.selector ?? '') ?? state.nativeTarget;
      if (target?.isConnected) {
        const original = nativeDocument.defaultView?.getComputedStyle(target).transform ?? 'none';
        const base = original === 'none' ? '' : original;
        if (!reduced) animate(target, [
          { transform: `${base} scale(1)` },
          { transform: `${base} scale(.985)`, offset: .45 },
          { transform: `${base} scale(1)` },
        ], { duration: 160, easing: OUT });
      }
      state.nativePress = cue.id;
    }
    const click = demo.clicks.find(item => item.actor === actor);
    if (!reset && click && state.click !== click.id) {
      const ring = ripple.current;
      ring.style.left = `${state.eye.x - 12}px`;
      ring.style.top = `${state.eye.y - 12}px`;
      ring.getAnimations().forEach(animation => animation.cancel());
      animate(ring, reduced ? [{ opacity: .45 }, { opacity: 0 }] : [
        { transform: 'scale(.4)', opacity: .65 }, { transform: 'scale(2.2)', opacity: 0 },
      ], { duration: reduced ? 180 : 650, easing: OUT });
      if (!reduced) animate(body.current, [
        { transform: 'scale(1)' }, { transform: 'scale(.9)', offset: .42 }, { transform: 'scale(1)' },
      ], { duration: 160, easing: OUT });
      state.click = click.id;
      if (conversation.current.warning) {
        closeConversation();
      }
    }
  }, [nativeDocument, demo, actor, playbackRevision, reduced, animate, running, closeConversation]);

  function hover(enter: boolean, pointerType: string) {
    if (pointerType !== 'mouse' || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    setOpenMode(current => enter ? current === 'pinned' ? current : 'hover' : current === 'pinned' ? current : null);
    const target = hoverBody.current;
    if (!target || reduced) return;
    const from = getComputedStyle(target).transform;
    hoverAnimation.current?.cancel();
    target.style.transform = enter ? 'scale(1.025)' : 'scale(1)';
    hoverAnimation.current = target.animate(enter ? [
      { transform: from === 'none' ? 'scale(1)' : from },
      { transform: 'scale(.94)', offset: .23 },
      { transform: 'scale(1.065)', offset: .68 },
      { transform: 'scale(1.025)' },
    ] : [{ transform: from === 'none' ? 'scale(1)' : from }, { transform: 'scale(1)' }], { duration: enter ? 320 : 180, easing: OUT });
  }

  return <button ref={button} type="button" className={`sda-actor sda-${actor}`} data-actor={actor}
    disabled={!nativeDocument} aria-label={`${info.name}: ${info.role.toLowerCase()}. Learn what I do.`}
    aria-describedby={`${id}-description`} aria-expanded={open}
    onPointerEnter={event => hover(true, event.pointerType)} onPointerLeave={event => hover(false, event.pointerType)}
    onFocus={event => { if (event.currentTarget.matches(':focus-visible')) setOpenMode('focus'); }}
    onBlur={closeConversation}
    onClick={() => setOpenMode(current => current === null ? 'pinned' : null)}
    onKeyDown={event => { if (event.key === 'Escape') closeConversation(); }}>
    <span className="sda-ripple" ref={ripple} aria-hidden="true" />
    <span className="sda-press" ref={body} aria-hidden="true"><span className="sda-hover" ref={hoverBody}><span className="sda-spin" ref={spin}><Body actor={actor} /></span></span></span>
    <span className="sda-eye" ref={eye} data-click-point aria-hidden="true"><svg viewBox="0 0 258 258" focusable="false"><circle cx={EYES[actor].x * 258 / SIZE} cy={EYES[actor].y * 258 / SIZE} r="45" /></svg></span>
    <span className="sda-description" id={`${id}-description`}>{info.text}</span>
    <span className="sda-bubble" ref={bubble} data-open={open} aria-hidden="true">
      <span className="sda-bubble-reserve">As I was saying… {info.text}</span>
      <span className="sda-bubble-copy">{text || '…'}</span>
    </span>
  </button>;
}

/** Render inside the same 1600×940 canvas as the native iframe, outside aria-hidden. */
export function ServiceDemoActors(props: ServiceDemoActorsProps) {
  return <div className="sda-actors" role="group" aria-label="Meet the three service helpers">
    {ACTORS.map(actor => <ServiceActor key={actor} actor={actor} {...props} />)}
  </div>;
}
