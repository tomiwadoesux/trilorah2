import { useEffect, useId, useRef, useState, type MouseEventHandler, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useNotificationStore, type NotificationEntry } from '../stores/notificationStore';
import { openNoticeTarget } from '../lib/notificationNavigation';
import { runNoticeAction } from '../lib/notificationActions';
import { noticeDetail, type NoticeAction } from '../../shared/serviceNotice';
import { usePopupPlacement } from '../ui/primitives/usePopupPlacement';
import { ChevronDownIcon, ChevronUpIcon, CloseIcon } from '../ui/icons';
import { NotificationBellArt } from '../design/screens/NotificationBellArt';
import { useEmptyHover } from '../design/screens/useEmptyHover';
import './notificationCenter.css';

const rank = { error: 0, warning: 1, info: 2 };
export interface NotificationTriggerProps {
  ref: RefObject<HTMLButtonElement | null>;
  onClick: MouseEventHandler<HTMLButtonElement>;
  expanded: boolean;
  controls: string;
  unread: boolean;
  count: number;
}
export function NotificationCenter({ renderTrigger, statusMessage, portrait }: {
  renderTrigger?: (props: NotificationTriggerProps) => ReactNode;
  statusMessage?: { key: string; text: string };
  portrait?: ReactNode;
} = {}) {
  const entries = useNotificationStore(s => s.entries);
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState(false);
  const [keyboard, setKeyboard] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [statusHistory, setStatusHistory] = useState<Array<{ id: number; text: string; at: number }>>([]);
  const previousStatus = useRef<string | null>(null);
  const statusSequence = useRef(0);
  useEffect(() => {
    if (!statusMessage || previousStatus.current === statusMessage.key) return;
    previousStatus.current = statusMessage.key;
    const message = { id: ++statusSequence.current, text: statusMessage.text, at: Date.now() };
    setStatusHistory(old => [message, ...old].slice(0, 100));
  }, [statusMessage?.key, statusMessage?.text]);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  const position = usePopupPlacement(open, trigger, panel, renderTrigger ? 'left' : 'right');
  const placed = position !== null;
  const active = entries.filter(e => e.status === 'active' && !e.dismissed).sort((a, b) => rank[a.severity] - rank[b.severity] || b.updatedAt - a.updatedAt);
  const recovered = entries.filter(e => e.status === 'resolved' && !e.dismissed && now - e.updatedAt < 8000).sort((a, b) => b.updatedAt - a.updatedAt)[0];
  const top = active[0] ?? recovered;
  const shown = history ? [...entries].sort((a, b) => b.updatedAt - a.updatedAt) : active;
  const empty = shown.length === 0 && (!history || statusHistory.length === 0);
  const unread = active.some(e => !e.read);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => { if (open) useNotificationStore.getState().readAll(); }, [open, entries]);
  useEffect(() => {
    if (!open || !placed) return;
    panel.current?.querySelector<HTMLButtonElement>('[data-close]')?.focus();
    const down = (event: PointerEvent) => {
      const el = event.target as Node;
      if (!panel.current?.contains(el) && !trigger.current?.contains(el)) setOpen(false);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.stopPropagation(); setOpen(false); trigger.current?.focus(); }
      if (event.key === 'Tab') {
        const buttons = [...panel.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []];
        const first = buttons[0], last = buttons.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    window.addEventListener('pointerdown', down);
    window.addEventListener('keydown', key);
    return () => { window.removeEventListener('pointerdown', down); window.removeEventListener('keydown', key); };
  }, [open, placed]);
  return <>
    {renderTrigger ? renderTrigger({ ref: trigger, expanded: open, controls: id, unread, count: active.length,
      onClick: event => { setKeyboard(event.detail === 0); if (!open) setHistory(false); setOpen(v => !v); },
    }) : <div className="tri-notification-anchor" data-stack={Math.min(active.length, 3)}>
      {active.length > 1 && <span aria-hidden className="tri-notification-back tri-notification-back-one" />}
      {active.length > 2 && <span aria-hidden className="tri-notification-back tri-notification-back-two" />}
      <button ref={trigger} data-guide="notifications" type="button" className="tri-header-control tri-notification-trigger" data-unread={unread} data-tone={top?.status === 'resolved' ? 'resolved' : top?.severity}
        aria-expanded={open} aria-controls={id} aria-haspopup="dialog" aria-label={`Notifications${active.length ? `, ${active.length} active` : ', no active issues'}`}
        onClick={event => { setKeyboard(event.detail === 0); if (!open) setHistory(false); setOpen(v => !v); }}>
        <span className="tri-notification-dot" aria-hidden />
        <span className="tri-notification-summary">{top ? `${top.status === 'resolved' ? 'resolved · ' : ''}${top.title}` : 'notifications'}</span>
        {active.length > 0 && <span className="tri-notification-count">{active.length}</span>}
        <span aria-hidden className="tri-notification-chevron">{open ? <ChevronUpIcon size={12} /> : <ChevronDownIcon size={12} />}</span>
      </button>
    </div>}
    <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">{top ? `${top.status === 'resolved' ? 'Resolved: ' : ''}${top.title}. ${top.detail}` : ''}</span>
    {open && createPortal(<div ref={panel} id={id} role="dialog" aria-label="Service notifications" className="tri-notification-panel" data-keyboard={keyboard} data-empty={empty} data-orb={!!renderTrigger}
      style={{ left: position?.left ?? 0, top: position?.top ?? 0, visibility: position ? 'visible' : 'hidden' }}>
      <div className="tri-notification-heading"><div><strong>{renderTrigger ? 'A word from your orb' : 'notifications'}</strong>{!renderTrigger && !empty && <span>{active.length ? `${active.length} need attention` : 'all quiet for now'}</span>}</div>
        <button type="button" data-close aria-label="Close notifications" onClick={() => { setOpen(false); trigger.current?.focus(); }}><CloseIcon size={16} /></button>
      </div>
      {renderTrigger && <div className="tri-orb-conversation-intro">
        <div className="tri-orb-conversation-portrait" aria-hidden="true">{portrait}</div>
        <div><strong>{history ? 'Here’s what I’ve noticed.' : active.length ? 'Let’s take care of this.' : 'I’m here when you need me.'}</strong>
          <p>{history ? 'Our updates from this session, newest first.' : active.length ? `${active.length === 1 ? 'One thing needs' : `${active.length} things need`} a look. I’ll point you to the right controls.` : statusMessage?.text ?? 'No new issues need your attention.'}</p></div>
      </div>}
      <div className="tri-notification-tabs" role="group" aria-label="Notification filter">
        <button type="button" aria-pressed={!history} onClick={() => setHistory(false)}>Active <span>{active.length}</span></button>
        <button type="button" aria-pressed={history} onClick={() => setHistory(true)}>History <span>{entries.length + statusHistory.length}</span></button>
      </div>
      <div className="tri-notification-list">
        {empty && (renderTrigger ? <div className="tri-orb-conversation-empty"><span aria-hidden="true">{history ? '◷' : '✓'}</span>
          <p>{history ? 'We’re just getting started.' : 'Nothing else needs your attention.'}</p>
          <small>{history ? 'I’ll keep our updates here.' : 'I’ll let you know when something comes up.'}</small>
        </div> : <NotificationEmptyState history={history} />)}
        {history && statusHistory.length ? [
          ...shown.map(entry => ({ id: `notice:${entry.id}`, at: entry.updatedAt, node: <NotificationCards entries={[entry]} onNavigate={() => setOpen(false)} /> })),
          ...statusHistory.map(message => ({ id: `orb:${message.id}`, at: message.at, node: <article className="tri-orb-history-message">
            <span className="tri-orb-message-speaker">Your orb</span><p>{message.text}</p><time dateTime={new Date(message.at).toISOString()}>{new Date(message.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</time>
          </article> })),
        ].sort((a, b) => b.at - a.at).map(item => <div key={item.id}>{item.node}</div>)
          : <NotificationCards entries={shown} onNavigate={() => setOpen(false)} />}
      </div>
      <p className="tri-notification-footer">{statusMessage ? 'Service updates and orb status changes from this session.' : 'Only service issues and useful updates appear here.'}</p>
    </div>, document.body)}
  </>;
}

/** The same quiet bell composition is available to the design preview. */
export function NotificationEmptyState({ history = false }: { history?: boolean }) {
  const hover = useEmptyHover(true);
  return <div ref={hover} className="tri-empty-surface tri-notification-empty-state">
    <div className="tri-notification-empty-state__art" aria-hidden="true"><NotificationBellArt /></div>
    <h3>{history ? 'No notifications yet' : 'All quiet for now'}</h3>
    <p>{history ? 'Your service history will appear here.' : 'Service updates will appear here.'}</p>
  </div>;
}


/** Shared with the dashboard so notifications have one set of actions everywhere. */
export function NotificationCards({ entries, onNavigate }: { entries: NotificationEntry[]; onNavigate?: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ id: string; text: string } | null>(null);
  const running = useRef(false);
  const navigate = (e: NotificationEntry) => { onNavigate?.(); openNoticeTarget(e.target); };
  const act = async (e: NotificationEntry, action: NoticeAction) => {
    if (running.current) return;
    if (action.kind === 'navigate') { onNavigate?.(); openNoticeTarget(action.target); return; }
    running.current = true; setBusy(e.id); setFeedback(null);
    try { setFeedback({ id: e.id, text: await runNoticeAction(action) }); }
    catch (error) { setFeedback({ id: e.id, text: noticeDetail(error) }); }
    finally { running.current = false; setBusy(null); }
  };
  return <>
        {entries.map(e => <article key={`${e.id}:${e.episode}`} className="tri-notification-card" data-tone={e.status === 'resolved' ? 'resolved' : e.severity}>
          <button type="button" className="tri-notification-link" onClick={() => navigate(e)}>
            <span className="tri-notification-card-title"><span className="tri-notification-dot" aria-hidden /><strong>{e.title}</strong><span aria-hidden>↗</span></span>
            <span className="tri-notification-detail">{e.detail}</span>
            <span className="tri-notification-meta">{e.status === 'resolved' ? 'resolved · ' : e.dismissed ? 'dismissed · ' : ''}{new Date(e.updatedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
          </button>
          {e.status === 'active' && <div className="tri-notification-actions">
            {(e.actions?.length ? e.actions : [{ kind: 'navigate' as const, target: e.target, label: 'Open controls' }]).map((action, i) => <button type="button" key={`${action.label}:${i}`} disabled={busy !== null} onClick={() => void act(e, action)}>{busy === e.id && i === 0 ? 'checking…' : action.label}</button>)}
            {!e.dismissed && <button type="button" className="tri-notification-dismiss" aria-label={`Dismiss ${e.title}`} onClick={() => useNotificationStore.getState().dismiss(e.id)}>dismiss</button>}
          </div>}
          {feedback?.id === e.id && <p className="tri-notification-feedback" role="status">{feedback.text}</p>}
        </article>)}
  </>;
}
