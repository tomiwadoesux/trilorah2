"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { PAIRING_MS, isPhoneMicCode, parsePhoneMicMessage, phoneMicChannel, type PhoneMicMessage } from "@/lib/phoneMicProtocol";

/*
 * This phone, as the microphone for the laptop running Trilorah.
 *
 * Why it lives here and not on the LAN remote: a phone only opens its
 * microphone for an https page, and this site has the certificate. The site
 * carries nothing but the handshake — a hello, the laptop's yes, and the
 * call set-up — on a Supabase broadcast channel named by the code in the
 * QR. The sound itself is a WebRTC call straight across the church Wi-Fi.
 */

type Stage = "nocode" | "ready" | "pending" | "connecting" | "live" | "declined" | "expired" | "ended" | "failed";

type RealtimeChannel = ReturnType<ReturnType<typeof createClient>["channel"]>;

const NAME_KEY = "trilorah_mic_name";
const ID_KEY = "trilorah_mic_id";

function stored(key: string, fallback: () => string): string {
  try {
    const v = localStorage.getItem(key);
    if (v) return v;
    const made = fallback();
    localStorage.setItem(key, made);
    return made;
  } catch {
    return fallback();
  }
}

function guessName(): string {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Android/.test(ua)) return "Android phone";
  return "This phone";
}

export default function MicClient() {
  const params = useSearchParams();
  const code = params.get("c")?.toUpperCase() ?? "";
  const valid = isPhoneMicCode(code);
  const supabase = useMemo(() => createClient(), []);

  const [stage, setStage] = useState<Stage>(valid ? "ready" : "nocode");
  const [name, setName] = useState("");
  const [laptop, setLaptop] = useState("the laptop");
  const [note, setNote] = useState("");
  const [muted, setMuted] = useState(false);
  const [level, setLevel] = useState(0);
  const [secure, setSecure] = useState(true);
  /* What the laptop hears, as it hears it, and the verse it caught. */
  const [lines, setLines] = useState<string[]>([]);
  const [partial, setPartial] = useState("");
  const [verse, setVerse] = useState<{ ref: string; live: boolean } | null>(null);

  const phoneId = useRef("");
  const channel = useRef<RealtimeChannel | null>(null);
  const pc = useRef<RTCPeerConnection | null>(null);
  const local = useRef<MediaStream | null>(null);
  const queued = useRef<RTCIceCandidateInit[]>([]);
  const wake = useRef<{ release: () => Promise<void> } | null>(null);
  const meter = useRef<{ ctx: AudioContext; timer: number } | null>(null);
  const expiry = useRef<number | undefined>(undefined);
  const stageRef = useRef<Stage>(stage);
  stageRef.current = stage;

  useEffect(() => {
    setName(stored(NAME_KEY, guessName));
    phoneId.current = stored(ID_KEY, () => crypto.randomUUID());
    setSecure(window.isSecureContext && !!navigator.mediaDevices?.getUserMedia);
  }, []);

  const send = useCallback(async (m: PhoneMicMessage) => {
    await channel.current?.send({ type: "broadcast", event: "mic", payload: m });
  }, []);

  const stopMeter = () => {
    if (meter.current) {
      window.clearInterval(meter.current.timer);
      void meter.current.ctx.close().catch(() => undefined);
      meter.current = null;
    }
    setLevel(0);
  };

  const hangUp = useCallback(async (next: Stage, say = "") => {
    window.clearTimeout(expiry.current);
    stopMeter();
    local.current?.getTracks().forEach((t) => t.stop());
    local.current = null;
    setLines([]);
    setPartial("");
    setVerse(null);
    if (pc.current) { pc.current.onicecandidate = null; pc.current.onconnectionstatechange = null; pc.current.close(); pc.current = null; }
    void wake.current?.release().catch(() => undefined);
    wake.current = null;
    if (channel.current) { await supabase.removeChannel(channel.current).catch(() => undefined); channel.current = null; }
    setNote(say);
    setStage(next);
  }, [supabase]);

  const startMeter = (s: MediaStream) => {
    try {
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaStreamSource(s).connect(analyser);
      const data = new Float32Array(analyser.fftSize);
      const timer = window.setInterval(() => {
        analyser.getFloatTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
        const db = 20 * Math.log10(Math.sqrt(sum / data.length) || 1e-6);
        setLevel(Math.max(0, Math.min(100, ((db + 60) / 60) * 100)));
      }, 80);
      meter.current = { ctx, timer };
    } catch {
      /* no meter is not no microphone */
    }
  };

  /** The laptop said yes: open the microphone and place the call. */
  const call = useCallback(async () => {
    setStage("connecting");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
      });
    } catch {
      await send({ kind: "bye", from: "phone", reason: "microphone refused" }).catch(() => undefined);
      void hangUp("failed", "The phone would not open its microphone. Allow the microphone for this site and try again.");
      return;
    }
    local.current = stream;
    const peer = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
    pc.current = peer;
    stream.getTracks().forEach((t) => peer.addTrack(t, stream));
    // The words come back down the same call. Opened here so the offer
    // carries it; the laptop only has to listen.
    const channel = peer.createDataChannel("words", { ordered: true });
    channel.onmessage = (e) => {
      try {
        const m = JSON.parse(String(e.data)) as { kind: string; text?: string; final?: boolean; ref?: string | null; live?: boolean };
        if (m.kind === "line" && typeof m.text === "string") {
          if (m.final) { setLines((prev) => [...prev, m.text!].slice(-4)); setPartial(""); }
          else setPartial(m.text);
        } else if (m.kind === "verse") {
          setVerse(m.ref ? { ref: m.ref, live: !!m.live } : null);
        }
      } catch { /* not ours */ }
    };
    peer.onicecandidate = (e) => {
      if (e.candidate) void send({ kind: "ice", from: "phone", candidate: e.candidate.toJSON() as { candidate: string; sdpMid?: string | null; sdpMLineIndex?: number | null } });
    };
    peer.onconnectionstatechange = () => {
      if (pc.current !== peer) return;
      if (peer.connectionState === "connected") {
        window.clearTimeout(expiry.current);
        setStage("live");
        startMeter(stream);
        void (navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } }).wakeLock
          ?.request("screen").then((lock) => { wake.current = lock; }).catch(() => undefined);
      } else if (peer.connectionState === "failed" || peer.connectionState === "disconnected") {
        void hangUp("failed", "The call to the laptop dropped. Are both still on the church Wi‑Fi?");
      }
    };
    try {
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      await send({ kind: "offer", phoneId: phoneId.current, sdp: offer.sdp ?? "" });
    } catch (e) {
      void hangUp("failed", e instanceof Error ? e.message : "Could not start the call.");
    }
  }, [send, hangUp]);

  const receive = useCallback((raw: unknown) => {
    const m = parsePhoneMicMessage(raw);
    if (!m) return;
    switch (m.kind) {
      case "approved":
        if (m.phoneId === phoneId.current && stageRef.current === "pending") { setLaptop(m.laptop); void call(); }
        return;
      case "declined":
        if (m.phoneId === phoneId.current) void hangUp("declined", m.reason);
        return;
      case "answer":
        if (pc.current) {
          void pc.current.setRemoteDescription({ type: "answer", sdp: m.sdp }).then(async () => {
            for (const c of queued.current) await pc.current?.addIceCandidate(c).catch(() => undefined);
            queued.current = [];
          });
        }
        return;
      case "ice":
        if (m.from === "desktop") {
          if (pc.current?.remoteDescription) void pc.current.addIceCandidate(m.candidate).catch(() => undefined);
          else queued.current.push(m.candidate);
        }
        return;
      case "bye":
        if (m.from === "desktop") void hangUp("ended", m.reason ? `The laptop ended it — ${m.reason}.` : "The laptop ended it.");
        return;
      default:
        return;
    }
  }, [call, hangUp]);

  /** Knock: join the code's channel and ask to be let in. */
  const connect = useCallback(async () => {
    if (!valid) return;
    try { localStorage.setItem(NAME_KEY, name); } catch { /* fine */ }
    setNote("");
    setStage("pending");
    const ch = supabase.channel(phoneMicChannel(code), { config: { broadcast: { self: false } } });
    channel.current = ch;
    ch.on("broadcast", { event: "mic" }, (p: { payload?: unknown }) => receive(p?.payload));
    ch.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        void send({ kind: "hello", phoneId: phoneId.current, name: name.trim() || guessName() });
        window.clearTimeout(expiry.current);
        expiry.current = window.setTimeout(() => {
          if (stageRef.current === "pending") void hangUp("expired", "Nobody answered on the laptop. Make a new code there and scan again.");
        }, PAIRING_MS);
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        void hangUp("failed", "Could not reach the cloud to find the laptop. Check the phone's internet and try again.");
      }
    });
  }, [valid, code, name, supabase, send, receive, hangUp]);

  const disconnect = useCallback(async () => {
    await send({ kind: "bye", from: "phone" }).catch(() => undefined);
    void hangUp("ended", "Disconnected.");
  }, [send, hangUp]);

  const toggleMute = () => {
    const next = !muted;
    local.current?.getAudioTracks().forEach((t) => { t.enabled = !next; });
    setMuted(next);
  };

  // Leaving the page is leaving the call; the laptop should hear so.
  useEffect(() => {
    const leave = () => { if (channel.current) void send({ kind: "bye", from: "phone", reason: "the page was closed" }); };
    window.addEventListener("pagehide", leave);
    return () => window.removeEventListener("pagehide", leave);
  }, [send]);

  const live = stage === "live";
  const title =
    stage === "nocode" ? "Scan the code on the laptop"
    : stage === "ready" ? "Be the microphone"
    : stage === "pending" ? "Waiting for the laptop…"
    : stage === "connecting" ? "Connecting…"
    : live ? (muted ? "Muted" : "You're the microphone")
    : stage === "declined" ? "The laptop said no"
    : stage === "expired" ? "That code has expired"
    : stage === "ended" ? "Disconnected"
    : "Something went wrong";
  const body =
    stage === "nocode" ? "On the laptop, choose audio › phone. Scan the code it shows with this phone's camera."
    : stage === "ready" ? (secure ? "Your voice goes straight to the laptop over the church Wi‑Fi. Stay on this screen while you speak." : "This browser cannot open the microphone here. Open the link in Safari or Chrome.")
    : stage === "pending" ? "Someone at the laptop has to press let it in."
    : stage === "connecting" ? "Opening the microphone and finding the laptop…"
    : live ? `Sending to ${laptop}. Keep this screen on.`
    : note;

  return (
    <main className="mic-shell" data-stage={stage} data-muted={muted || undefined}>
      <header className="mic-top">
        <svg className="mic-mark" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="currentColor" fillRule="evenodd" d="M12 2C19.4 2 22 4.6 22 12S19.4 22 12 22 2 19.4 2 12 4.6 2 12 2ZM7.15 7.58H16.85V10.37H13.41V17.29H10.59V10.37H7.15Z" />
        </svg>
        <span className="mic-brand">trilorah</span>
        <span className="mic-eyebrow">phone microphone</span>
      </header>

      <section className="mic-stage">
        <div className="mic-orb" style={{ "--level": live && !muted ? level / 100 : 0 } as React.CSSProperties} aria-hidden="true">
          <span className="mic-ring" />
          <span className="mic-ring mic-ring-2" />
          <span className="mic-core">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="3.5" width="6" height="11" rx="3" />
              <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v2.5" />
              {muted && <path d="M4.5 4.5l15 15" />}
            </svg>
          </span>
        </div>
        <h1 className="mic-title" role="status" aria-live="polite">{title}</h1>
        <p className="mic-body">{body}</p>
        {live && (
          <div className="mic-heard" aria-live="off">
            {verse && <span className={`mic-verse${verse.live ? " is-live" : ""}`}>{verse.live ? "on screen" : "caught"} · {verse.ref}</span>}
            <div className="mic-lines">
              {lines.length === 0 && !partial && <p className="mic-line is-empty">what you say shows here as the laptop hears it</p>}
              {lines.slice(-3).map((l, i, all) => <p key={`${i}-${l.slice(0, 12)}`} className="mic-line" style={{ opacity: 0.35 + ((i + 1) / all.length) * 0.65 }}>{l}</p>)}
              {partial && <p className="mic-line is-partial">{partial}</p>}
            </div>
          </div>
        )}
      </section>

      <footer className="mic-foot">
        {stage === "ready" && (
          <>
            <label className="mic-field">
              <span>this phone&rsquo;s name</span>
              <input value={name} maxLength={80} autoComplete="off" enterKeyHint="go" onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void connect(); }} />
            </label>
            <button type="button" className="mic-btn go" disabled={!secure} onClick={() => void connect()}>connect to the laptop</button>
          </>
        )}
        {(stage === "pending" || stage === "connecting") && (
          <button type="button" className="mic-btn ash" onClick={() => void disconnect()}>cancel</button>
        )}
        {live && (
          <div className="mic-row">
            <button type="button" className={`mic-btn ${muted ? "caution" : "ash"}`} onClick={toggleMute} aria-pressed={muted}>{muted ? "unmute" : "mute"}</button>
            <button type="button" className="mic-btn danger" onClick={() => void disconnect()}>disconnect</button>
          </div>
        )}
        {(stage === "declined" || stage === "expired" || stage === "ended" || stage === "failed") && valid && (
          <button type="button" className="mic-btn go" onClick={() => void connect()}>try again</button>
        )}
        <p className="mic-fine">Nothing is recorded. The sound crosses the church Wi‑Fi only; the internet is used just to connect.</p>
      </footer>
    </main>
  );
}
