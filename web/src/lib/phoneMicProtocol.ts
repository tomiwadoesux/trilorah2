/**
 * MIRROR of /shared/phoneMic.ts — the wire protocol only.
 *
 * Copied, not imported: the Vercel project's root is `web/`, so `../shared`
 * is outside the build. If the shared file changes, change this too.
 */

export const PAIRING_MS = 2 * 60 * 1000;
export const CODE_LENGTH = 10;
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function isPhoneMicCode(v: unknown): v is string {
  return typeof v === "string" && v.length === CODE_LENGTH && [...v].every((c) => ALPHABET.includes(c));
}

export function phoneMicChannel(code: string): string {
  return `mic:${code}`;
}

export interface IceCandidate {
  candidate: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
}

export type PhoneMicMessage =
  | { kind: "hello"; phoneId: string; name: string }
  | { kind: "approved"; phoneId: string; laptop: string }
  | { kind: "declined"; phoneId: string; reason: string }
  | { kind: "offer"; phoneId: string; sdp: string }
  | { kind: "answer"; sdp: string }
  | { kind: "ice"; from: "phone" | "desktop"; candidate: IceCandidate }
  | { kind: "bye"; from: "phone" | "desktop"; reason?: string };

const str = (v: unknown, max = 4000): v is string => typeof v === "string" && v.length > 0 && v.length <= max;

export function parsePhoneMicMessage(raw: unknown): PhoneMicMessage | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Record<string, unknown>;
  switch (m.kind) {
    case "hello":
      return str(m.phoneId, 64) && str(m.name, 80) ? { kind: "hello", phoneId: m.phoneId, name: m.name } : null;
    case "approved":
      return str(m.phoneId, 64) && str(m.laptop, 80) ? { kind: "approved", phoneId: m.phoneId, laptop: m.laptop } : null;
    case "declined":
      return str(m.phoneId, 64) && str(m.reason, 200) ? { kind: "declined", phoneId: m.phoneId, reason: m.reason } : null;
    case "offer":
      return str(m.phoneId, 64) && str(m.sdp, 20000) ? { kind: "offer", phoneId: m.phoneId, sdp: m.sdp } : null;
    case "answer":
      return str(m.sdp, 20000) ? { kind: "answer", sdp: m.sdp } : null;
    case "ice": {
      const c = m.candidate as Record<string, unknown> | undefined;
      if ((m.from !== "phone" && m.from !== "desktop") || !c || typeof c !== "object" || !str(c.candidate, 1000)) return null;
      return {
        kind: "ice",
        from: m.from,
        candidate: {
          candidate: c.candidate,
          sdpMid: typeof c.sdpMid === "string" ? c.sdpMid : null,
          sdpMLineIndex: typeof c.sdpMLineIndex === "number" ? c.sdpMLineIndex : null,
        },
      };
    }
    case "bye":
      return m.from === "phone" || m.from === "desktop"
        ? { kind: "bye", from: m.from, ...(str(m.reason, 200) ? { reason: m.reason } : {}) }
        : null;
    default:
      return null;
  }
}
