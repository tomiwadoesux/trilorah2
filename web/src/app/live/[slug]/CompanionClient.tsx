"use client";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { createClient } from "@/lib/supabase/browser";
import {
  Headphones,
  Clock,
  BookOpen,
  StickyNote,
  HandCoins,
} from "@/components/icons";
import TranscriptStream from "./components/TranscriptStream";
import VersesTab from "./components/VersesTab";
import NotesTab from "./components/NotesTab";
import GiveTab from "./components/GiveTab";

import "./companion.css";
import ReadingOptions, { DEFAULT_READING_APPEARANCE, type ReadingAppearance } from './components/ReadingOptions';
import { useCompanionFeed } from "./useCompanionFeed";
import { useNotebook } from './useNotebook';
import type { Notebook } from '@/lib/companionNotebook';
import type { SermonNotesData } from '@/components/SermonNotesSections';
import TranscriptArchive from './components/TranscriptArchive';
import BrandMark from "./components/BrandMark";

type Tab = "now" | "verses" | "notes" | "give";

export interface Account {
  id: string;
  name: string;
  slug: string;
  giving_methods: any;
}

export interface Service {
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
  pinned = false,
}: {
  account: Account;
  initialService: Service | null;
  pinned?: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const fingerprint = useFingerprint();
  // Transcript, verses, notes, the segment and the service itself — kept
  // current through realtime, with catch-up and polling for when it is not.
  const {
    service,
    isLive,
    transcript,
    verses,
    notes,
    segment: currentSegment,
    health, loading, loadError, retry,
  } = useCompanionFeed(supabase, account.id, initialService, pinned);

  /** Identity of the service, stable across row updates to it. */
  const serviceId = service?.id ?? null;
  // Record an audience_sessions row on mount + refresh last_seen every 60s.
  // IP geolocation resolves via ipapi.co client-side — the operator never
  // sees individual IPs, just city/country rolled up on the dashboard.
  useEffect(() => {
    if (!serviceId || !fingerprint) return;
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
            service_id: serviceId,
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
          .eq("service_id", serviceId)
          .eq("audience_fingerprint", fingerprint)
          .then(() => {});
      }
    }, 60_000);

    return () => {
      cancelled = true;
      if (heartbeat) clearInterval(heartbeat);
    };
  }, [serviceId, fingerprint, account.id, supabase]);

  return <CompanionView loading={loading} loadError={loadError} onRetry={retry} account={account} service={service} isLive={isLive} transcript={transcript} verses={verses} notes={notes} currentSegment={currentSegment} health={health} fingerprint={fingerprint}/>;
}

export interface CompanionViewProps {
  account: Account; service: Service | null; isLive: boolean;
  transcript: React.ComponentProps<typeof TranscriptStream>['chunks'];
  verses: React.ComponentProps<typeof VersesTab>['verses'];
  notes: SermonNotesData | null; currentSegment: string;
  health: 'live' | 'catching-up'; fingerprint: string;
  preview?: boolean; previewNotebook?: Notebook;
  loading?: boolean; loadError?: boolean; onRetry?: () => void;
}
export function CompanionView({ account, service, isLive, transcript, verses, notes, currentSegment, health, fingerprint, preview = false, previewNotebook, loading, loadError, onRetry }: CompanionViewProps) {
  const [tab, setTab] = useState<Tab>("now");
  const [detailTab, setDetailTab] = useState<Exclude<Tab, "now">>("verses");
  const selectTab = (next: Tab) => { setTab(next); if (next !== "now") setDetailTab(next); };
  const [appearance,setAppearance]=useState<ReadingAppearance>(DEFAULT_READING_APPEARANCE);
  const hasGiving = ['zelle', 'venmo', 'cashApp', 'paypal', 'bankInfo', 'customUrl']
    .some(key => typeof account.giving_methods?.[key] === 'string' && account.giving_methods[key].trim());
  const latestTranscriptAt = transcript.reduce((latest, chunk) => Math.max(latest, new Date(chunk.timestamp).getTime() || 0), 0);
  // A publisher can disappear without closing its service record. Show the
  // saved words honestly rather than labelling a days-old transcript live.
  const serviceAge = service ? Date.now() - Date.parse(service.started_at) : 0;
  const showingSavedTranscript = serviceAge > 6 * 60 * 60 * 1000 &&
    (!latestTranscriptAt || Date.now() - latestTranscriptAt > 5 * 60 * 1000);
  const followingLive = isLive && !showingSavedTranscript;

  const notebook = useNotebook(account.id, previewNotebook);
  const [archiveOpen, setArchiveOpen] = useState(false);
  if (!service) {
    return (
      <main className="companion-shell companion-waiting min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <BrandMark className="companion-mark" />
        <p className="companion-eyebrow">Your church, wherever you are</p>
        <h1>{account.name}</h1>
        <p>The live transcript and scriptures will appear here when the service starts.</p>
      </main>
    );
  }

  return (
    // h-screen, not min-h-screen: the transcript inside is the thing that
    // scrolls, so the page itself must be exactly one viewport or the tab bar
    // ends up below the fold on a phone with a browser chrome bar.
    <main data-aurora={appearance.aurora} className={`companion-shell flex flex-col overflow-hidden ${appearance.image ? 'companion-photo' : ''}`} style={{'--reading-size':`${appearance.size}px`,...(appearance.image?{backgroundImage:`linear-gradient(rgba(9,11,12,.64),rgba(9,11,12,.78)),url("${appearance.image}")`}:{})} as CSSProperties}>
      {preview && <div className="companion-preview-banner"><span>Live demo · sample service</span><a href="/live/vrc">Open real service</a></div>}
      {/* Header */}
      <header className="companion-header">
        <span className="companion-brand-symbol" aria-label="Trilorah"><BrandMark className="companion-mark" /></span>
        <div className="companion-identity">
          <p className="companion-church-name">TRILORAH</p>
          <div className="companion-service-status">
            <span>{account.name}</span>
            {followingLive && health === 'catching-up' && <span role="status">Reconnecting…</span>}
          </div>
        </div>
        <button className="companion-history-trigger" onClick={() => setArchiveOpen(true)} aria-label="Open transcript and service history"><Clock size={21}/><span>History</span></button>
        <ReadingOptions churchId={account.id} onChange={setAppearance}/>
      </header>

      <div className="companion-workspace" data-mobile-tab={tab}>
        <section className="companion-content companion-reader-panel" aria-label="Follow along">
          <div className="companion-section-heading">
            <div><p className="companion-eyebrow">{service.sermon_title || `${new Date(service.started_at).toLocaleDateString(undefined, { weekday: 'long' })} service`}</p><h1>Follow along</h1></div>
            <span className="companion-session-date">{new Date(service.started_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
          </div>
          <TranscriptStream key={service.id} loading={loading} loadError={loadError} onRetry={onRetry}
            chunks={transcript} verses={verses} segment={currentSegment} isLive={!!followingLive}
            publishTranscript={service.publish_transcript} serviceStartedAt={service.started_at} streamUrl={service.stream_url}
          />
        </section>
        <aside className="companion-detail-panel" data-resource={detailTab} aria-label="From this service">
          <div className="companion-detail-top"><p className="companion-eyebrow">FROM THIS SERVICE</p>
            <div className="companion-detail-tabs" aria-label="Service resources">
              <button aria-pressed={detailTab === 'verses'} onClick={() => selectTab('verses')}>Scriptures</button>
              <button aria-pressed={detailTab === 'notes'} onClick={() => selectTab('notes')}>Notes</button>
              {hasGiving && <button aria-pressed={detailTab === 'give'} onClick={() => selectTab('give')}>Give</button>}
            </div>
          </div>
          {detailTab !== 'verses' && <div className="companion-section-heading companion-detail-heading"><h1>{detailTab === 'notes' ? 'Notes' : 'Give'}</h1></div>}
          {detailTab === 'verses' && <VersesTab verses={verses} audienceTrainingEnabled={service.audience_training_enabled && !!followingLive && !preview} fingerprint={fingerprint} serviceId={service.id} isLive={!!followingLive} notebook={notebook}/>}
          {detailTab === 'notes' && <NotesTab key={service.id} notes={notes} isLive={!!followingLive} notebook={notebook} service={service}/>}
          {detailTab === 'give' && <GiveTab methods={account.giving_methods}/>}
          <div className="companion-detail-footer"><BrandMark className="companion-mark"/><span>Shared by {account.name}</span></div>
        </aside>
      </div>

      {/* Bottom tabs */}
      <nav className="companion-nav" aria-label="Service sections">
        <TabButton active={tab === "now"} onClick={() => selectTab("now")} icon={Headphones} label="Follow along" />
        <TabButton active={tab === "verses"} onClick={() => selectTab("verses")} icon={BookOpen} label="Scriptures" />
        <TabButton active={tab === "notes"} onClick={() => selectTab("notes")} icon={StickyNote} label="Notes" />
        {hasGiving && <TabButton active={tab === "give"} onClick={() => selectTab("give")} icon={HandCoins} label="Give" />}
      </nav>
      {archiveOpen && <TranscriptArchive service={service} account={account} previewChunks={preview ? transcript : undefined} onClose={() => setArchiveOpen(false)}/>}
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
      className="companion-tab"
    >
      <span className="companion-tab-icon"><Icon selected={active} size={23} /></span>
      <span>{label}</span>
    </button>
  );
}

function useFingerprint() {
  const [fp, setFp] = useState("");
  useEffect(() => {
    try {
    let existing = localStorage.getItem("trilorah_fp");
    if (!existing) {
      existing = crypto.randomUUID();
      localStorage.setItem("trilorah_fp", existing);
    }
    setFp(existing);
    } catch { setFp(crypto.randomUUID()); }
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
