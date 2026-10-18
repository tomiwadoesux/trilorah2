import { useEffect, useRef, type RefObject } from 'react';
import { flushSync } from 'react-dom';
import type { ScriptureReferenceInputHandle } from '../ui/primitives/ScriptureReferenceInput';
import { hasOpenTypingInteraction, ownsTextInput, shouldRouteOperatorTyping } from './operatorTyping';

/** One initial focus, then typing on demand. Never refocus after blur. */
export function useOperatorTyping({ enabled, root, search, revealSearch, activeLibrary = 'scriptures', skipNextEntryFocus }: {
  enabled: boolean;
  root: RefObject<HTMLElement | null>;
  search: RefObject<ScriptureReferenceInputHandle | null>;
  revealSearch: () => void;
  activeLibrary?: string;
  /** An explicit navigation destination wins over the default entry field. */
  skipNextEntryFocus?: RefObject<boolean>;
}) {
  const reveal = useRef(revealSearch);
  reveal.current = revealSearch;
  const library = useRef(activeLibrary);
  library.current = activeLibrary;

  useEffect(() => {
    if (!enabled) return;
    const document = root.current?.ownerDocument;
    const window = document?.defaultView;
    if (!document || !window) return;
    const libraryInput = () => [...(root.current?.querySelectorAll<HTMLInputElement>('[data-library-workspace] input[data-operator-search]') ?? [])]
      .find(input => !input.disabled && !input.closest('[inert], [hidden]') && input.getClientRects().length > 0);

    const skipEntryFocus = skipNextEntryFocus?.current ?? false;
    if (skipNextEntryFocus) skipNextEntryFocus.current = false;

    const initialFocus = document.activeElement;
    let interacted = false;
    const rememberInteraction = () => { interacted = true; };
    document.addEventListener('pointerdown', rememberInteraction, true);
    document.addEventListener('keydown', rememberInteraction, true);
    const frame = window.requestAnimationFrame(() => {
      document.removeEventListener('pointerdown', rememberInteraction, true);
      document.removeEventListener('keydown', rememberInteraction, true);
      if (!skipEntryFocus && !interacted && document.activeElement === initialFocus && !ownsTextInput(initialFocus) &&
        !hasOpenTypingInteraction(document) && (initialFocus === document.body || root.current?.contains(initialFocus))) {
        if (library.current === 'scriptures') {
          if (!search.current) flushSync(() => reveal.current());
          search.current?.focus();
        } else libraryInput()?.focus();
      }
    });

    const onKey = (event: KeyboardEvent) => {
      const path = event.composedPath().filter((node): node is Element => node instanceof Element);
      const target = path[0] ?? null;
      const active = document.activeElement;
      const controls = [...path, ...(active ? [active] : [])];
      if (!shouldRouteOperatorTyping(event, {
        enabled,
        withinOperator: target === document.body || target === document.documentElement || !!(target && root.current?.contains(target)),
        editing: controls.some(ownsTextInput),
        interactionOpen: hasOpenTypingInteraction(document),
        controlOwnsTyping: controls.some(element => !!element.closest('[role="listbox"], [role="menu"], [role="tree"], [role="grid"], [role="slider"], [role="spinbutton"], [data-typing-scope="local"]')),
        buttonFocused: !!active?.closest('button, [role="button"], [role="checkbox"], [role="switch"], [role="tab"]'),
        textSelected: document.getSelection()?.isCollapsed === false,
      })) return;

      if (library.current === 'scriptures') {
        if (!search.current) flushSync(() => reveal.current());
        if (search.current?.beginTyping(event.key)) event.preventDefault();
        return;
      }
      const input = libraryInput();
      if (!input) return;
      event.preventDefault();
      input.focus({ preventScroll: true });
      // Use the native setter so React's controlled input observes the new
      // character. Starting from the canvas begins a fresh lookup.
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, event.key);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.setSelectionRange(event.key.length, event.key.length);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('pointerdown', rememberInteraction, true);
      document.removeEventListener('keydown', rememberInteraction, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [enabled, root, search, skipNextEntryFocus]);
}
