"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { createClient } from "@/lib/supabase/browser";
import {
  catchUpSince,
  mergeChunks,
  mergeVerses,
  shouldAdopt,
  type FeedService,
} from "@/lib/companionFeed";

type Supabase = ReturnType<typeof createClient>;
/** Rows are passed straight through to components that type them themselves. */
type Row = any;

/** "live" while realtime is delivering; "catching-up" while the page polls instead. */
export type FeedHealth = "live" | "catching-up";

/** The page shows the newest public service that started within four weeks. */
const SERVICE_WINDOW_MS = 28 * 24 * 60 * 60 * 1000;
/** No service live: how often to ask whether one has started. */
const DISCOVER_IDLE_MS = 20_000;
/** A service live: how often to re-read its row (ended_at, title) in case realtime missed it. */
const DISCOVER_LIVE_MS = 60_000;
/** The feed loop's beat. */
const TICK_MS = 5_000;
/** Realtime connected but quiet this long: one cheap check that nothing slipped past. */
const QUIET_MS = 30_000;
/** While realtime is down, notes and the segment are re-read every this many ticks. */
const FULL_EVERY_TICKS = 6;

/**
 * Everything the congregation's page shows, kept current.
 *
 * Realtime alone was not enough, and the page needed a reload in three cases:
 *
 *  - It was opened before the service began. There was no service to listen
 *    to, so nothing listened for one starting — the waiting screen stayed up
 *    for the whole service.
 *  - The phone slept. A locked phone drops its socket; realtime does not
 *    replay what was published while it was gone, so the transcript resumed
 *    with a hole in it, or not at all.
 *  - Realtime never delivered (a table missing from the publication, or the
 *    project's concurrent-connection cap). The page looked live and froze.
 *
 * So realtime is the fast path and never the only one: every reconnect,
 * wake and network change fetches what was missed, a quiet socket is checked
 * every half minute, and a broken one is replaced by polling until it heals.
 * Rows from all three routes meet in mergeChunks/mergeVerses, which drop the
 * duplicates the deliberate overlaps produce.
 */
export function useCompanionFeed<S extends FeedService>(
  supabase: Supabase,
  accountId: string,
  initialService: S | null,
) {
  const [service, setService] = useState<S | null>(initialService);
  const [transcript, setTranscript] = useState<Row[]>([]);
  const [verses, setVerses] = useState<Row[]>([]);
  const [notes, setNotes] = useState<Row | null>(null);
  const [segment, setSegment] = useState<string>("unknown");
  const [health, setHealth] = useState<FeedHealth>("live");

  const serviceRef = useRef<S | null>(initialService);
  const transcriptRef = useRef<Row[]>([]);
  transcriptRef.current = transcript;

  const serviceId = service?.id ?? null;
  const isLive = !!service && !service.ended_at;

  /** Move to `candidate` if it is this service's update or a newer service. */
  const adopt = useCallback((candidate: S | null) => {
    const current = serviceRef.current;
    if (!candidate || !shouldAdopt(current, candidate)) return;
    if (current && candidate.id === current.id && JSON.stringify(current) === JSON.stringify(candidate)) return;
    if (!current || candidate.id !== current.id) {
      // A different service: nothing on screen belongs to it.
      setTranscript([]);
      setVerses([]);
      setNotes(null);
      setSegment("unknown");
    }
    serviceRef.current = candidate;
    setService(candidate);
  }, []);

  const discover = useCallback(async () => {
    const since = new Date(Date.now() - SERVICE_WINDOW_MS).toISOString();
    const { data } = await supabase
      .from("services")
      .select("*")
      .eq("account_id", accountId)
      .eq("is_public", true)
      .gte("started_at", since)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) adopt(data as S);
  }, [supabase, accountId, adopt]);

  /** Answers for a service the page has since moved off are thrown away. */
  const stillOn = (id: string) => serviceRef.current?.id === id;

  const fetchNotesAndSegment = useCallback(
    async (id: string) => {
      const [nRes, segRes] = await Promise.all([
        supabase.from("sermon_notes").select("*").eq("service_id", id).maybeSingle(),
        supabase
          .from("segments")
          .select("type")
          .eq("service_id", id)
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      if (!stillOn(id)) return;
      if (nRes.data) setNotes(nRes.data);
      if (segRes.data) setSegment(segRes.data.type);
    },
    [supabase],
  );

  /**
   * The first read for a service. Three minutes of transcript, newest first so
   * the row limit keeps the RECENT rows — a recogniser that reconnects can
   * flush a burst of near-identical timestamps, and a phone should not take a
   * thousand rows to the face for it.
   */
  const backfill = useCallback(
    async (id: string) => {
      const since = new Date(Date.now() - 3 * 60 * 1000).toISOString();
      const [tcRes, vRes] = await Promise.all([
        supabase
          .from("transcript_chunks")
          .select("*")
          .eq("service_id", id)
          .gte("timestamp", since)
          .order("timestamp", { ascending: false })
          .limit(120),
        supabase
          .from("detected_verses")
          .select("*")
          .eq("service_id", id)
          .eq("pushed_to_live", true)
          .order("pushed_at", { ascending: false }),
      ]);
      if (!stillOn(id)) return;
      if (tcRes.data) setTranscript((prev) => mergeChunks(prev, tcRes.data));
      if (vRes.data) setVerses((prev) => mergeVerses(prev, vRes.data));
      await fetchNotesAndSegment(id);
    },
    [supabase, fetchNotesAndSegment],
  );

  /** Everything published since the newest row this phone holds. */
  const catchUp = useCallback(
    async (id: string, full: boolean) => {
      const since = catchUpSince(transcriptRef.current, Date.now());
      const [tcRes, vRes] = await Promise.all([
        supabase
          .from("transcript_chunks")
          .select("*")
          .eq("service_id", id)
          .gte("timestamp", since)
          .order("timestamp", { ascending: true })
          .limit(200),
        supabase
          .from("detected_verses")
          .select("*")
          .eq("service_id", id)
          .eq("pushed_to_live", true)
          .order("pushed_at", { ascending: false })
          .limit(50),
      ]);
      if (!stillOn(id)) return;
      if (tcRes.data?.length) setTranscript((prev) => mergeChunks(prev, tcRes.data));
      if (vRes.data?.length) setVerses((prev) => mergeVerses(prev, vRes.data));
      if (full) await Promise.all([fetchNotesAndSegment(id), discover()]);
    },
    [supabase, fetchNotesAndSegment, discover],
  );

  // ── Which service: listen for new ones, and ask on a timer as well. ──
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const channel = supabase
      .channel(`account-${accountId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "services", filter: `account_id=eq.${accountId}` },
        (payload) => {
          const row = payload.new as S & { is_public?: boolean };
          if (row && row.id && row.is_public !== false) adopt(row);
        },
      )
      .subscribe();

    const loop = () => {
      if (stopped) return;
      const live = !!serviceRef.current && !serviceRef.current.ended_at;
      timer = setTimeout(async () => {
        if (!document.hidden) await discover().catch(() => undefined);
        loop();
      }, live ? DISCOVER_LIVE_MS : DISCOVER_IDLE_MS);
    };
    loop();

    const wake = () => {
      if (!document.hidden) void discover().catch(() => undefined);
    };
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("online", wake);

    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("online", wake);
      supabase.removeChannel(channel);
    };
  }, [supabase, accountId, adopt, discover]);

  // ── The first read whenever the page moves to a service. ──
  useEffect(() => {
    if (serviceId) void backfill(serviceId).catch(() => undefined);
  }, [serviceId, backfill]);

  // ── Live rows for the service on screen. ──
  useEffect(() => {
    if (!serviceId || !isLive) return;
    let stopped = false;
    let healthy = false;
    let joinedOnce = false;
    let lastHeard = Date.now();
    let ticks = 0;

    const heard = () => {
      lastHeard = Date.now();
    };
    const markHealthy = (next: boolean) => {
      healthy = next;
      setHealth(next ? "live" : "catching-up");
    };
    const run = (full: boolean) => {
      lastHeard = Date.now();
      void catchUp(serviceId, full).catch(() => undefined);
    };

    const channel = supabase
      .channel(`service-${serviceId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "transcript_chunks", filter: `service_id=eq.${serviceId}` },
        (payload) => {
          heard();
          setTranscript((prev) => mergeChunks(prev, [payload.new]));
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "segments", filter: `service_id=eq.${serviceId}` },
        (payload) => {
          heard();
          setSegment((payload.new as Row).type);
        },
      )
      .on(
        "postgres_changes",
        // INSERT as well as UPDATE: a verse pushed straight to the wall is
        // written once, already live, and never updated again.
        { event: "*", schema: "public", table: "detected_verses", filter: `service_id=eq.${serviceId}` },
        (payload) => {
          heard();
          const row = payload.new as Row;
          if (row?.id) setVerses((prev) => mergeVerses(prev, [row]));
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sermon_notes", filter: `service_id=eq.${serviceId}` },
        (payload) => {
          heard();
          setNotes(payload.new as Row);
        },
      )
      // The server reports a subscription it cannot serve (a table missing
      // from the publication) here, not always through the join reply.
      .on("system", {}, (payload: { status?: string }) => {
        if (payload?.status === "error") markHealthy(false);
      })
      .subscribe((status) => {
        if (stopped) return;
        if (status === "SUBSCRIBED") {
          markHealthy(true);
          // A REjoin means the socket was down for a while: fetch the gap.
          if (joinedOnce) run(true);
          joinedOnce = true;
        } else {
          markHealthy(false);
        }
      });

    const timer = setInterval(() => {
      if (stopped || document.hidden) return;
      ticks += 1;
      if (!healthy) run(ticks % FULL_EVERY_TICKS === 0);
      else if (Date.now() - lastHeard > QUIET_MS) run(false);
    }, TICK_MS);

    // Back from a locked screen or a dead network: whatever was published in
    // the meantime is not coming over the socket.
    const wake = () => {
      if (!document.hidden) run(true);
    };
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("online", wake);

    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("online", wake);
      supabase.removeChannel(channel);
    };
  }, [serviceId, isLive, supabase, catchUp]);

  return { service, isLive, transcript, verses, notes, segment, health };
}
