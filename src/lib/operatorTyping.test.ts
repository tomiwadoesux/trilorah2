import { describe, expect, it } from 'vitest';
import { shouldRouteOperatorTyping, type OperatorTypingContext } from './operatorTyping';

const neutral: OperatorTypingContext = {
  enabled: true,
  withinOperator: true,
  editing: false,
  interactionOpen: false,
  controlOwnsTyping: false,
  buttonFocused: false,
  textSelected: false,
};
const key = (value: string, extra = {}) => ({
  key: value, ctrlKey: false, metaKey: false, altKey: false,
  isComposing: false, keyCode: 0, defaultPrevented: false, ...extra,
});

describe('Operator default typing', () => {
  it.each(['j', 'J', '1', ':', 'é', ' '])('routes the first printable %j from a neutral Operator area', value => {
    expect(shouldRouteOperatorTyping(key(value), neutral)).toBe(true);
  });

  it.each(['Enter', 'Tab', 'Escape', 'Backspace', 'Delete', 'ArrowUp', 'ArrowLeft', 'Home', 'F1', 'Dead', 'Process', 'Unidentified'])('preserves %s navigation and non-text behavior', value => {
    expect(shouldRouteOperatorTyping(key(value), neutral)).toBe(false);
  });

  it.each(['ctrlKey', 'metaKey', 'altKey', 'isComposing', 'defaultPrevented'])('preserves %s keystrokes', modifier => {
    expect(shouldRouteOperatorTyping(key('j', { [modifier]: true }), neutral)).toBe(false);
  });

  it('leaves legacy composition key events alone', () => {
    expect(shouldRouteOperatorTyping(key('j', { keyCode: 229 }), neutral)).toBe(false);
  });

  it.each([
    ['Dashboard/settings/profile', { enabled: false }],
    ['a different page or portal', { withinOperator: false }],
    ['another text field, contenteditable or editor', { editing: true }],
    ['a modal, dialog or open menu', { interactionOpen: true }],
    ['a listbox or control with its own typeahead', { controlOwnsTyping: true }],
    ['selected page text', { textSelected: true }],
  ] as const)('does not take typing from %s', (_label, context) => {
    expect(shouldRouteOperatorTyping(key('j'), { ...neutral, ...context })).toBe(false);
  });

  it('keeps Space activation for buttons while allowing letters to start a lookup', () => {
    const focusedButton = { ...neutral, buttonFocused: true };
    expect(shouldRouteOperatorTyping(key(' '), focusedButton)).toBe(false);
    expect(shouldRouteOperatorTyping(key('j'), focusedButton)).toBe(true);
  });
});
