import { useCallback, useEffect, useState } from 'react';
import {
  Button,
  EmptyState,
  EngineNote,
  Field,
  Panel,
  PanelHeader,
  Pill,
  TextButton,
  hasEngine,
} from '../components/ui';

/** Pull something readable out of a cloud row without knowing its schema. */
function describeRow(row: Record<string, unknown>): string {
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const v = row[k];
      if (typeof v === 'string' && v) return v;
    }
    return null;
  };
  const title = pick('title', 'name', 'sermon_title', 'theme') ?? 'untitled';
  const when = pick('started_at', 'created_at', 'date', 'updated_at');
  const parsed = when ? new Date(when) : null;
  const whenText =
    parsed && !Number.isNaN(parsed.getTime())
      ? parsed.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
      : null;
  return whenText ? `${title} — ${whenText}` : title;
}

export function Cloud() {
  const [status, setStatus] = useState<CloudStatus | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accountName, setAccountName] = useState('');
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [churchName, setChurchName] = useState('');
  const [slug, setSlug] = useState('');
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [redeemCode, setRedeemCode] = useState('');
  const [services, setServices] = useState<Record<string, unknown>[]>([]);
  const [notesList, setNotesList] = useState<Record<string, unknown>[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const s = await window.api?.cloudStatus();
      setStatus(s ?? null);
      if (s?.signedIn) {
        void window.api?.cloudFetchRecentServices().then((r) => setServices(r ?? [])).catch(() => undefined);
        void window.api?.cloudFetchRecentNotes().then((r) => setNotesList(r ?? [])).catch(() => undefined);
      }
    } catch {
      setStatus(null);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const run = async (fn: () => Promise<CloudOpResult | undefined>, okNote?: string) => {
    setBusy(true);
    setNote(null);
    try {
      const res = await fn();
      if (res && res.success === false) setNote(res.error ?? 'that did not work');
      else if (okNote) setNote(okNote);
      await refresh();
    } catch {
      setNote('that did not work');
    } finally {
      setBusy(false);
    }
  };

  const generateLink = async () => {
    setBusy(true);
    setNote(null);
    try {
      const res = await window.api?.cloudGenerateLinkCode();
      if (res?.code) setLinkCode(res.code);
      else setNote(res?.error ?? 'could not generate a code');
    } catch {
      setNote('could not generate a code');
    } finally {
      setBusy(false);
    }
  };

  if (!hasEngine()) {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight">Cloud</h2>
          <p className="text-sm text-neutral-500">
            Stream verses, transcript, and notes to a public page the congregation can follow.
          </p>
        </div>
        <EngineNote />
      </div>
    );
  }

  const statusText = !status
    ? 'checking…'
    : !status.configured
      ? 'cloud is not configured in this build'
      : status.signedIn
        ? `signed in as ${status.email ?? 'unknown'}${status.hasAccount === false ? ' · church setup incomplete' : ''}`
        : 'signed out';

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight">Cloud</h2>
        <p className="text-sm text-neutral-500">
          Stream verses, transcript, and notes to a public page the congregation can follow.
        </p>
      </div>

      <Panel dataTour="cloud-status">
        <PanelHeader right={status?.activeServiceId ? <Pill active>service live</Pill> : undefined}>
          status
        </PanelHeader>
        <p className="text-sm">{statusText}</p>
        {note && <p className="mt-2 text-sm text-neutral-500">{note}</p>}
      </Panel>

      {status?.configured && !status.signedIn && (
        <Panel className="max-w-md">
          <PanelHeader>{mode === 'sign-in' ? 'sign in' : 'create account'}</PanelHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void run(
                () =>
                  mode === 'sign-in'
                    ? window.api?.cloudSignIn(email, password) ?? Promise.resolve(undefined)
                    : window.api?.cloudSignUp(email, password, accountName.trim() || undefined) ?? Promise.resolve(undefined),
                mode === 'sign-in' ? 'signed in' : 'account created',
              );
            }}
          >
            <Field label="email">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email"
                className="w-full text-sm"
                autoComplete="username"
              />
            </Field>
            <Field label="password">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="password"
                className="w-full text-sm"
                autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
              />
            </Field>
            {mode === 'sign-up' && (
              <Field label="church / account name">
                <input
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="church / account name"
                  className="w-full text-sm"
                />
              </Field>
            )}
            <div className="flex items-center gap-x-4 pt-1">
              <Button
                label={mode === 'sign-in' ? 'Sign in' : 'Sign up'}
                variant="solid"
                disabled={busy || !email.trim() || !password}
                onClick={() =>
                  void run(
                    () =>
                      mode === 'sign-in'
                        ? window.api?.cloudSignIn(email, password) ?? Promise.resolve(undefined)
                        : window.api?.cloudSignUp(email, password, accountName.trim() || undefined) ?? Promise.resolve(undefined),
                    mode === 'sign-in' ? 'signed in' : 'account created',
                  )
                }
              />
              <TextButton
                label={mode === 'sign-in' ? 'NEED AN ACCOUNT?' : 'HAVE AN ACCOUNT?'}
                onClick={() => setMode((m) => (m === 'sign-in' ? 'sign-up' : 'sign-in'))}
              />
            </div>
          </form>
        </Panel>
      )}

      {status?.signedIn && status.hasAccount === false && (
        <Panel className="max-w-md">
          <PanelHeader>church setup</PanelHeader>
          <div className="space-y-4">
            <Field label="church name">
              <input
                value={churchName}
                onChange={(e) => setChurchName(e.target.value)}
                placeholder="church name"
                className="w-full text-sm"
              />
            </Field>
            <Field label="slug">
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="slug (yourchurch)"
                className="w-full text-sm"
              />
            </Field>
            <Button
              label="Complete setup"
              disabled={busy || !churchName.trim() || !slug.trim()}
              onClick={() =>
                void run(
                  () => window.api?.cloudCompleteAccountSetup(churchName.trim(), slug.trim()) ?? Promise.resolve(undefined),
                  'church created',
                )
              }
            />
          </div>
        </Panel>
      )}

      {status?.signedIn && (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <Panel className="self-start">
              <PanelHeader>this service</PanelHeader>
              <div className="flex flex-wrap items-center gap-x-4">
                {status.activeServiceId ? (
                  <Button
                    label="End cloud service"
                    onClick={() => void run(() => window.api?.cloudEndService() ?? Promise.resolve(undefined), 'cloud service ended')}
                    disabled={busy}
                  />
                ) : (
                  <Button
                    label="Start cloud service"
                    variant="solid"
                    onClick={() => void run(() => window.api?.cloudStartService({}) ?? Promise.resolve(undefined), 'cloud service started')}
                    disabled={busy}
                  />
                )}
              </div>
              <p className="mt-3 text-sm text-neutral-500">
                While a cloud service is live, pushed verses, the transcript, and notes stream to your
                public page for the congregation to follow along.
              </p>
            </Panel>

            <Panel className="self-start">
              <PanelHeader>link another device</PanelHeader>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                <Button label="Generate link code" onClick={() => void generateLink()} disabled={busy} />
                {linkCode && <span className="font-scripture text-2xl tracking-widest">{linkCode}</span>}
              </div>
              <form
                className="mt-4 flex items-center gap-x-4 border-t border-hairline pt-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (redeemCode.trim()) {
                    void run(() => window.api?.cloudRedeemLinkCode(redeemCode.trim()) ?? Promise.resolve(undefined), 'device linked');
                  }
                }}
              >
                <input
                  value={redeemCode}
                  onChange={(e) => setRedeemCode(e.target.value)}
                  placeholder="enter a code from another device"
                  className="w-full min-w-0 text-sm"
                />
                <TextButton
                  label="REDEEM"
                  onClick={() => void run(() => window.api?.cloudRedeemLinkCode(redeemCode.trim()) ?? Promise.resolve(undefined), 'device linked')}
                  disabled={busy || !redeemCode.trim()}
                />
              </form>
            </Panel>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel className="self-start">
              <PanelHeader>recent services</PanelHeader>
              {services.length === 0 ? (
                <EmptyState>none yet</EmptyState>
              ) : (
                <ul className="space-y-1.5">
                  {services.slice(0, 10).map((row, i) => (
                    <li key={i} className="text-sm">{describeRow(row)}</li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel className="self-start">
              <PanelHeader>recent notes</PanelHeader>
              {notesList.length === 0 ? (
                <EmptyState>none yet</EmptyState>
              ) : (
                <ul className="space-y-1.5">
                  {notesList.slice(0, 10).map((row, i) => (
                    <li key={i} className="text-sm">{describeRow(row)}</li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          <div className="border-t border-hairline pt-6">
            <TextButton
              label="SIGN OUT"
              onClick={() => void run(() => window.api?.cloudSignOut() ?? Promise.resolve(undefined), 'signed out')}
              disabled={busy}
            />
          </div>
        </>
      )}
    </div>
  );
}
