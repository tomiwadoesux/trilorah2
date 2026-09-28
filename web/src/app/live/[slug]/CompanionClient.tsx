"use client";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { createClient } from "@/lib/supabase/browser";
import {
  Radio,
  BookOpen,
  StickyNote,
  HandCoins,
} from "@/components/icons";
import TranscriptStream from "./components/TranscriptStream";
import VersesTab from "./components/VersesTab";
import NotesTab from "./components/NotesTab";
import GiveTab from "./components/GiveTab";
import SegmentBadge from "./components/SegmentBadge";
import "./companion.css";
import ReadingOptions, { type ReadingAppearance } from './components/ReadingOptions';

type Tab = "now" | "verses" | "notes" | "give";

interface Account {
  id: string;
  name: string;
  slug: string;
  giving_methods: any;
}

interface Service {
  id: string;
  account_id: string;
  preacher_id: string | null;
  started_at: string;
  ended_at: string | null;
  sermon_title: string | null;
  publish_transcript: boolean;
  audience_training_enabled: boolean;
  /** Public YouTube/Facebook stream, when the church has set one. */
  stream_url: string | null;
}

export default function CompanionClient({
  account,
  initialService,
}: {
  account: Account;
  initialService: Service | null;
}) {
  const [tab, setTab] = useState<Tab>("now");
  const [appearance,setAppearance]=useState<ReadingAppearance>({image:'',size:21});
  const [service, setService] = useState<Service | null>(initialService);
  const [transcript, setTranscript] = useState<any[]>([]);
  const [verses, setVerses] = useState<any[]>([]);
  const [currentSegment, setCurrentSegment] = useState<string>("unknown");
  const [notes, setNotes] = useState<any | null>(null);
  const supabase = useMemo(() => createClient(), []);
  const fingerprint = useFingerprint();

  const isLive = service && !service.ended_at;

  // Record an audience_sessions row on mount + refresh last_seen every 60s.
  // IP geolocation resolves via ipapi.co client-side — the operator never
  // sees individual IPs, just city/country rolled up on the dashboard.
  useEffect(() => {
    if (!service || !fingerprint) return;
    let cancelled = false;
    let heartbeat: ReturnType<typeof setInterval> | null = null;

    const record = async () => {
      // Best-effort device label from user-agent
      const ua = navigator.userAgent;
      const deviceLabel = labelForUA(ua);
      // Geolocate (soft-fail)
      let city = "";
      let country = "";
      let ip = "";
      try {
        const geo = await fetch("https://ipapi.co/json/")
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null);
        if (geo && !cancelled) {
          city = geo.city ?? "";
          country = geo.country_name ?? geo.country ?? "";
          ip = geo.ip ?? "";
        }
      } catch {
        /* non-fatal */
      }

      // Upsert — unique on (service_id, fingerprint)
      await supabase
        .from("audience_sessions")
        .upsert(
          {
            service_id: service.id,
            account_id: account.id,
            audience_fingerprint: fingerprint,
            ip: ip || null,
            city: city || null,
            country: country || null,
            user_agent: ua.slice(0, 512),
            device_label: deviceLabel,
            last_seen: new Date().toISOString(),
          },
          { onConflict: "service_id,audience_fingerprint" },
        );
    };

    record();
    heartbeat = setInterval(() => {
      if (!cancelled) {
        supabase
          .from("audience_sessions")
          .update({ last_seen: new Date().toISOString() })
          .eq("service_id", service.id)
          .eq("audience_fingerprint", fingerprint)
          .then(() => {});
      }
    }, 60_000);

    return () => {
      cancelled = true;
      if (heartbeat) clearInterval(heartbeat);
    };
  }, [service, fingerprint, account.id, supabase]);

  // Initial backfill — last 30s of transcript + already-pushed verses + notes
  useEffect(() => {
    if (!service) return;
    let cancelled = false;
    (async () => {
      // Wide enough to cover the deliberate lag. The transcript shows the room
      // as it was ~24s ago (stream delay + hold), so a 30s backfill left a
      // phone that had just been opened with nothing it was allowed to draw
      // yet. Three minutes gives the highlight somewhere to start and the
      // viewer a little to scroll back through.
      //
      // Bounded by row count as well as by time: a recogniser that reconnects
      // can flush a burst of chunks with near-identical timestamps, and a
      // congregant's phone should not take a thousand rows to the face for it.
      const since = new Date(Date.now() - 3 * 60 * 1000).toISOString();
      const [tcRes, vRes, nRes, segRes] = await Promise.all([
        supabase
          .from("transcript_chunks")
          .select("*")
          .eq("service_id", service.id)
          .gte("timestamp", since)
          .order("timestamp", { ascending: false })
          .limit(120),
        supabase
          .from("detected_verses")
          .select("*")
          .eq("service_id", service.id)
          .eq("pushed_to_live", true)
          .order("pushed_at", { ascending: false }),
        supabase
          .from("sermon_notes")
          .select("*")
          .eq("service_id", service.id)
          .maybeSingle(),
        supabase
          .from("segments")
          .select("type")
          .eq("service_id", service.id)
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      if (cancelled) return;
      // Fetched newest-first so the limit keeps the RECENT rows; stored oldest
      // first, which is the order everything downstream expects to read.
      if (tcRes.data) setTranscript([...tcRes.data].reverse());
      if (vRes.data) setVerses(vRes.data);
      if (nRes.data) setNotes(nRes.data);
      if (segRes.data) setCurrentSegment(segRes.data.type);
    })();
    return () => {
      cancelled = true;
    };
  }, [service, supabase]);

  // Realtime subscription
  useEffect(() => {
    if (!service || !isLive) return;
    const channel = supabase
      .channel(`service-${service.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "transcript_chunks",
          filter: `service_id=eq.${service.id}`,
        },
        (payload) => {
          setTranscript((prev) => {
            const next = [...prev, payload.new];
            return next.slice(-200); // cap memory
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "segments",
          filter: `service_id=eq.${service.id}`,
        },
        (payload) => setCurrentSegment(payload.new.type),
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "detected_verses",
          filter: `service_id=eq.${service.id}`,
        },
        (payload) => {
          if (!payload.new.pushed_to_live) return;
          setVerses((prev) => {
            const exists = prev.find((v) => v.id === payload.new.id);
            if (exists) return prev;
            return [payload.new, ...prev];
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "sermon_notes",
          filter: `service_id=eq.${service.id}`,
        },
        (payload) => setNotes(payload.new),
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "services",
          filter: `id=eq.${service.id}`,
        },
        (payload) => setService(payload.new as Service),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [service, isLive, supabase]);

  if (!service) {
    return (
      <main className="companion-shell companion-waiting min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <span className="companion-mark" aria-hidden="true">t</span>
        <h1 className="text-xl font-semibold mb-1">{account.name}</h1>
        <p className="companion-eyebrow">Your church, wherever you are</p>
        <p className="text-gray-500 text-sm">The live transcript and scriptures will appear here when the service starts.</p>
      </main>
    );
  }

  return (
    // h-screen, not min-h-screen: the transcript inside is the thing that
    // scrolls, so the page itself must be exactly one viewport or the tab bar
    // ends up below the fold on a phone with a browser chrome bar.
    <main className={`companion-shell flex flex-col overflow-hidden ${appearance.image ? 'companion-photo' : ''}`} style={{'--reading-size':`${appearance.size}px`,...(appearance.image?{backgroundImage:`linear-gradient(rgba(9,11,12,.48),rgba(9,11,12,.48)),url("${appearance.image}")`}:{})} as CSSProperties}>
      {/* Header */}
      <header className="companion-header">
        <div className="companion-brand"><span className="companion-mark" aria-hidden="true">t</span><span>trilorah</span><span className="companion-brand-note">Follow Along</span></div>
        <div className="companion-church">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold">{account.name}</h1>
            {service.sermon_title && (
              <p className="text-[11px] text-gray-500 mt-0.5">{service.sermon_title}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isLive && (
              <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-brand">
                <span className="w-1.5 h-1.5 rounded-full bg-brand" />
                Live
              </span>
            )}
            {!isLive && <span className="companion-eyebrow">Service ended</span>}
            <SegmentBadge type={currentSegment} />
          </div>
        </div>
        </div>
        <ReadingOptions churchId={account.id} onChange={setAppearance}/>
      </header>

      {/* Content */}
      {/* A flex column so the transcript can take whatever height the optional
          stream player leaves it, instead of a fixed calc that overflows. */}
      <section className="companion-content flex-1 min-h-0 overflow-hidden flex flex-col">
        <div className="companion-section-heading"><h2>{tab === "now" ? "Live transcript" : tab === "verses" ? "Scriptures" : tab === "notes" ? "Service notes" : "Give"}</h2><p>{tab === "now" ? (isLive ? "Follow along, word by word." : "Read back through the service.") : tab === "verses" ? "Keep every passage close." : tab === "notes" ? "Take the message with you." : "Support your church."}</p></div>
        {tab === "now" && (
          <TranscriptStream
            chunks={transcript}
            verses={verses}
            segment={currentSegment}
            isLive={!!isLive}
            publishTranscript={service.publish_transcript}
            serviceStartedAt={service.started_at}
            streamUrl={service.stream_url}
          />
        )}
        {tab === "verses" && (
          <VersesTab
            verses={verses}
            audienceTrainingEnabled={service.audience_training_enabled && !!isLive}
            fingerprint={fingerprint}
            serviceId={service.id}
          />
        )}
        {tab === "notes" && <NotesTab notes={notes} isLive={!!isLive} />}
        {tab === "give" && <GiveTab methods={account.giving_methods} />}
      </section>

      {/* Bottom tabs */}
      <nav className="companion-nav grid grid-cols-4 z-20" aria-label="Service sections">
        <TabButton active={tab === "now"} onClick={() => setTab("now")} icon={Radio} label="Transcript" />
        <TabButton active={tab === "verses"} onClick={() => setTab("verses")} icon={BookOpen} label="Verses" />
        <TabButton active={tab === "notes"} onClick={() => setTab("notes")} icon={StickyNote} label="Notes" />
        <TabButton active={tab === "give"} onClick={() => setTab("give")} icon={HandCoins} label="Give" />
      </nav>
    </main>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<any>;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`companion-tab flex flex-col items-center justify-center py-2.5 gap-0.5 ${
        active ? "text-brand" : "text-gray-500 hover:text-gray-300"
      }`}
    >
      <Icon size={18} />
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}

function useFingerprint() {
  const [fp, setFp] = useState("");
  useEffect(() => {
    let existing = localStorage.getItem("trilorah_fp");
    if (!existing) {
      existing = crypto.randomUUID();
      localStorage.setItem("trilorah_fp", existing);
    }
    setFp(existing);
  }, []);
  return fp;
}

/**
 * Rough device label from a UA string. Good enough for a dashboard row —
 * never used for identity or targeting, just to give the operator a
 * human-readable sense of what devices are scanning.
 */
function labelForUA(ua: string): string {
  const u = ua.toLowerCase();
  const browser = u.includes("chrome") && !u.includes("edg")
    ? "Chrome"
    : u.includes("firefox")
      ? "Firefox"
      : u.includes("safari") && !u.includes("chrome")
        ? "Safari"
        : u.includes("edg")
          ? "Edge"
          : "Browser";
  const os = u.includes("iphone") || u.includes("ios")
    ? "iOS"
    : u.includes("android")
      ? "Android"
      : u.includes("mac os")
        ? "Mac OS"
        : u.includes("windows")
          ? "Windows"
          : u.includes("linux")
            ? "Linux"
            : "Unknown";
  return `${browser} (${os})`;
}
