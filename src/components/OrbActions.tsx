import { useEffect, useState } from 'react';
import { orbActions, type OrbAction, type OrbDestination } from '../lib/orbActions';
import { useNotificationStore } from '../stores/notificationStore';
import { InfoIcon } from '../ui/icons';
import './orbActions.css';

export interface OrbSuggestion { key: string; text: string }
export function OrbActions({ state, hasPreview, previewKey, onNavigate, onSuggestionChange }: {
  state: string; hasPreview: boolean; previewKey: string | null; onNavigate: (target: OrbDestination) => void;
  onSuggestionChange: (suggestion: OrbSuggestion | null) => void;
}) {
  const entries = useNotificationStore(s => s.entries);
  const actions = orbActions(state, entries, hasPreview);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const keyed = actions.map(action => {
      // A fresh issue or staged item can suggest the same destination again.
      const episodes = entries.filter(e => e.target === action.target && e.status === 'active' && !e.dismissed)
        .map(e => `${e.id}:${e.episode}:${e.severity}`).sort().join('|');
      const key = `${state}:${action.target}:${episodes}:${action.target === 'preview' ? previewKey : ''}`;
      return { key, action };
  });
  const signature = keyed.map(item => item.key).join('\n');
  useEffect(() => {
    const current = signature.split('\n');
    setDismissed(old => old.some(key => !current.includes(key)) ? old.filter(key => current.includes(key)) : old);
  }, [signature]);
  const visible = keyed.filter(item => !dismissed.includes(item.key));
  const first = visible[0];
  useEffect(() => {
    onSuggestionChange(first ? { key: first.key, text: first.action.detail } : null);
  }, [first?.key, first?.action.detail, onSuggestionChange]);
  return <div className="tri-orb-actions" role="group" aria-label="Suggested actions">
    {visible.map(({ key, action }) => <OrbActionButton key={key} action={action} onNavigate={onNavigate}
      onDismiss={() => setDismissed(old => old.includes(key) ? old : [...old, key])} />)}
    <span className="tri-orb-actions-empty">Actions appear here</span>
  </div>;
}

function OrbActionButton({ action, onNavigate, onDismiss }: { action: OrbAction; onNavigate: (target: OrbDestination) => void; onDismiss: () => void }) {
  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(false);
  useEffect(() => { if (gone) onDismiss(); }, [gone, onDismiss]);
  useEffect(() => {
    if (!leaving) return;
    // Finish even if a resize hides the button before transitionend fires.
    const timer = window.setTimeout(() => setGone(true), 250);
    return () => window.clearTimeout(timer);
  }, [leaving]);
  if (gone) return null;
  return <button type="button" className="tri-orb-action"
    data-attention={action.attention || undefined} data-leaving={leaving || undefined}
    disabled={leaving} title={action.detail}
    onTransitionEnd={event => { if (leaving && event.propertyName === 'opacity') setGone(true); }}
    onClick={event => {
      if (leaving) return;
      if (event.detail === 0) setGone(true);
      else setLeaving(true);
      onNavigate(action.target);
    }}>
    <span>{action.label}</span><InfoIcon size={13} className="tri-orb-action-info" />
  </button>;
}
