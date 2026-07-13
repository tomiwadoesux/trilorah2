import { useCallback, useEffect, useState } from 'react';
import { TextButton, SectionLabel, EngineNote, hasEngine } from '../components/ui';

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
        <SectionLabel>cloud</SectionLabel>
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
    <div className="space-y-12">
      <section className="space-y-3">
        <SectionLabel>status</SectionLabel>
        <p className="text-sm">
          {statusText}
          {status?.activeServiceId && (
            <span className="pl-3 text-xs uppercase tracking-widest text-accent">service live</span>
          )}
        </p>
        {note && <p className="text-sm text-neutral-500">{note}</p>}
      </section>

      {status?.configured && !status.signedIn && (
        <section className="space-y-4">
          <SectionLabel>{mode === 'sign-in' ? 'sign in' : 'create account'}</SectionLabel>
          <form
            className="max-w-md space-y-3"
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
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email"
              className="w-full text-sm"
              autoComplete="username"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="password"
              className="w-full text-sm"
              autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
            />
            {mode === 'sign-up' && (
              <input
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="church / account name"
                className="w-full text-sm"
              />
            )}
            <div className="flex items-baseline gap-x-10 pt-2">
              <TextButton
                label={mode === 'sign-in' ? 'SIGN IN' : 'SIGN UP'}
                primary
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
        </section>
      )}

      {status?.signedIn && status.hasAccount === false && (
        <section className="space-y-4">
          <SectionLabel>church setup</SectionLabel>
          <div className="max-w-md space-y-3">
            <input
              value={churchName}
              onChange={(e) => setChurchName(e.target.value)}
              placeholder="church name"
              className="w-full text-sm"
            />
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="slug (yourchurch)"
              className="w-full text-sm"
            />
            <TextButton
              label="COMPLETE SETUP"
              primary
              disabled={busy || !churchName.trim() || !slug.trim()}
              onClick={() =>
                void run(
                  () => window.api?.cloudCompleteAccountSetup(churchName.trim(), slug.trim()) ?? Promise.resolve(undefined),
                  'church created',
                )
              }
            />
          </div>
        </section>
      )}

      {status?.signedIn && (
        <>
          <section className="space-y-4">
            <SectionLabel>this service</SectionLabel>
            <div className="flex flex-wrap items-baseline gap-x-10">
              {status.activeServiceId ? (
                <TextButton
                  label="END CLOUD SERVICE"
                  onClick={() => void run(() => window.api?.cloudEndService() ?? Promise.resolve(undefined), 'cloud service ended')}
                  disabled={busy}
                />
              ) : (
                <TextButton
                  label="START CLOUD SERVICE"
                  primary
                  onClick={() => void run(() => window.api?.cloudStartService({}) ?? Promise.resolve(undefined), 'cloud service started')}
                  disabled={busy}
                />
              )}
            </div>
            <p className="max-w-2xl text-sm text-neutral-500">
              While a cloud service is live, pushed verses, the transcript, and notes stream to your
              public page for the congregation to follow along.
            </p>
          </section>

          <section className="space-y-4">
            <SectionLabel>link another device</SectionLabel>
            <div className="flex flex-wrap items-baseline gap-x-10 gap-y-3">
              <TextButton label="GENERATE LINK CODE" onClick={() => void generateLink()} disabled={busy} />
              {linkCode && <span className="font-scripture text-2xl tracking-widest">{linkCode}</span>}
            </div>
            <form
              className="flex items-baseline gap-x-6"
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
                className="w-72 text-sm"
              />
              <TextButton
                label="REDEEM"
                onClick={() => void run(() => window.api?.cloudRedeemLinkCode(redeemCode.trim()) ?? Promise.resolve(undefined), 'device linked')}
                disabled={busy || !redeemCode.trim()}
              />
            </form>
          </section>

          <section className="space-y-3">
            <SectionLabel>recent services</SectionLabel>
            {services.length === 0 ? (
              <p className="text-sm italic text-neutral-400">none yet</p>
            ) : (
              <ul className="space-y-1.5">
                {services.slice(0, 10).map((row, i) => (
                  <li key={i} className="text-sm">{describeRow(row)}</li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-3">
            <SectionLabel>recent notes</SectionLabel>
            {notesList.length === 0 ? (
              <p className="text-sm italic text-neutral-400">none yet</p>
            ) : (
              <ul className="space-y-1.5">
                {notesList.slice(0, 10).map((row, i) => (
                  <li key={i} className="text-sm">{describeRow(row)}</li>
                ))}
              </ul>
            )}
          </section>

          <section className="border-t border-hairline pt-8">
            <TextButton
              label="SIGN OUT"
              onClick={() => void run(() => window.api?.cloudSignOut() ?? Promise.resolve(undefined), 'signed out')}
              disabled={busy}
            />
          </section>
        </>
      )}
    </div>
  );
}
