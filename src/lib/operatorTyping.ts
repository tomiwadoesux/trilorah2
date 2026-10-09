/** Whether a page-level key should begin a new scripture lookup. */
export interface OperatorTypingContext {
  enabled: boolean;
  withinOperator: boolean;
  editing: boolean;
  interactionOpen: boolean;
  controlOwnsTyping: boolean;
  buttonFocused: boolean;
  textSelected: boolean;
}

type TypingKey = Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'isComposing' | 'keyCode' | 'defaultPrevented'>;

export function shouldRouteOperatorTyping(event: TypingKey, context: OperatorTypingContext): boolean {
  if (!context.enabled || !context.withinOperator || context.editing || context.interactionOpen ||
    context.controlOwnsTyping || context.textSelected) return false;
  if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.isComposing || event.keyCode === 229) return false;
  // Space activates a focused button. Dead keys and IME sessions stay native.
  return Array.from(event.key).length === 1 && !(event.key === ' ' && context.buttonFocused);
}

/** Composed paths also protect editors hosted inside a shadow root. */
export function ownsTextInput(element: Element | null): boolean {
  return !!element && (!!element.closest('input, textarea, select, [role="textbox"], [role="searchbox"], [role="combobox"], [contenteditable]:not([contenteditable="false"])') ||
    (element instanceof HTMLElement && element.isContentEditable));
}

export function hasOpenTypingInteraction(document: Document): boolean {
  // A menu may keep focus on its trigger; a modal may not have moved focus yet.
  return [...document.querySelectorAll<HTMLElement>('dialog[open], [role="dialog"], [role="alertdialog"], [aria-modal="true"], [role="menu"], [aria-haspopup][aria-expanded="true"]')]
    .some(element => !element.closest('[hidden], [inert], [aria-hidden="true"]') && element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden');
}
