"use client";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import {
  Radio,
  BookOpen,
  StickyNote,
  HandCoins,
} from "lucide-react";
import TranscriptStream from "./components/TranscriptStream";
import VersesTab from "./components/VersesTab";
import NotesTab from "./components/NotesTab";
import GiveTab from "./components/GiveTab";
import SegmentBadge from "./components/SegmentBadge";

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
}

export default function CompanionClient({
  account,
  initialService,
}: {
  account: Account;
  initialService: Service | null;
}) {
  const [tab, setTab] = useState<Tab>("now");
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
      const since = new Date(Date.now() - 30 * 1000).toISOString();
      const [tcRes, vRes, nRes, segRes] = await Promise.all([
        supabase
          .from("transcript_chunks")
          .select("*")
          .eq("service_id", service.id)
          .gte("timestamp", since)
          .order("timestamp"),
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
      if (tcRes.data) setTranscript(tcRes.data);
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
      <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <h1 className="text-xl font-semibold mb-1">{account.name}</h1>
        <p className="text-gray-500 text-sm">No live service yet today.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-20 flex flex-col">
      {/* Header */}
      <header className="px-4 pt-5 pb-3 border-b border-white/5 sticky top-0 bg-[#0a0a0a]/95 backdrop-blur z-10">
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
                <span className="w-1.5 h-1.5 rounded-full bg-brand live-dot" />
                Live
              </span>
            )}
            <SegmentBadge type={currentSegment} />
          </div>
        </div>
      </header>

      {/* Content */}
      <section className="flex-1 overflow-hidden">
        {tab === "now" && (
          <TranscriptStream
            chunks={transcript}
            verses={verses}
            segment={currentSegment}
            isLive={!!isLive}
            publishTranscript={service.publish_transcript}
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
      <nav className="fixed bottom-0 left-0 right-0 bg-[#0a0a0a]/95 backdrop-blur border-t border-white/10 grid grid-cols-4 z-20">
        <TabButton active={tab === "now"} onClick={() => setTab("now")} icon={Radio} label="Now" />
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
      className={`flex flex-col items-center justify-center py-2.5 gap-0.5 transition-colors ${
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
