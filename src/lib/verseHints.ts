export function createVerseHintSession() {
  return { count: 0, lastVerseAt: 0, lastId: '', visibleUntil: 0 };
}

/** Two introductions per launch; intervening verse changes restart the quiet gap. */
export function visitVerseHint(session: ReturnType<typeof createVerseHintSession>, id: string, now: number) {
  if (id !== session.lastId) {
    const eligible = session.count < 2 && (session.count === 0 || now - session.lastVerseAt >= 72_000);
    session.lastId = id;
    session.lastVerseAt = now;
    session.visibleUntil = eligible ? now + 4_000 : 0;
    if (eligible) session.count++;
  }
  // Remounts (including React StrictMode) resume the same introduction.
  return session.visibleUntil > now ? { pass: session.count, remaining: session.visibleUntil - now } : null;
}
