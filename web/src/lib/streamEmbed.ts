/**
 * A church's stream URL → an embeddable player URL.
 *
 * Why embed rather than stream: the church is already paying YouTube or
 * Facebook to carry the service to thousands of phones. Standing up any audio
 * path of our own would duplicate that at our cost and add a second thing that
 * can fail mid-service. The player earns its place for one reason only — when
 * it is playing, the page can read `currentTime` and drive the word highlight
 * from the same clock the listener's ears are on, which turns an estimate into
 * an exact match.
 *
 * Anything unrecognised returns null and the page shows no player chrome at
 * all. A dead embed frame in the middle of a sermon reads as broken software.
 */

export type StreamKind = "youtube" | "facebook";

export interface StreamEmbed {
  kind: StreamKind;
  /** Ready for an <iframe src>. */
  src: string;
}

export function parseStreamUrl(raw: string | null | undefined): StreamEmbed | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let url: URL;
  try {
    // A church admin pastes what they copied; half the time that has no scheme.
    url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./i, "").toLowerCase();

  if (host === "youtu.be") {
    const id = url.pathname.slice(1).split("/")[0];
    return youtube(id);
  }
  if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
    if (url.pathname === "/watch") return youtube(url.searchParams.get("v"));
    // /live/<id> and /embed/<id> and /shorts/<id> all carry the id in the path.
    const m = url.pathname.match(/^\/(?:live|embed|shorts|v)\/([^/?]+)/);
    if (m) return youtube(m[1]);
    return null;
  }

  if (host === "facebook.com" || host === "fb.watch" || host === "web.facebook.com") {
    // Facebook's plugin takes the whole video URL back as a parameter rather
    // than an id, so there is nothing to extract — only to validate.
    const src =
      "https://www.facebook.com/plugins/video.php?" +
      new URLSearchParams({
        href: url.toString(),
        show_text: "false",
        autoplay: "false",
      }).toString();
    return { kind: "facebook", src };
  }

  return null;
}

/**
 * `enablejsapi` is the whole point: without it the page cannot read
 * currentTime and the player is just a player. `playsinline` keeps iOS from
 * hijacking the screen into fullscreen video, which would hide the transcript
 * the viewer opened the page for.
 */
function youtube(id: string | null | undefined): StreamEmbed | null {
  if (!id || !/^[A-Za-z0-9_-]{6,}$/.test(id)) return null;
  const params = new URLSearchParams({
    enablejsapi: "1",
    playsinline: "1",
    modestbranding: "1",
    rel: "0",
  });
  return { kind: "youtube", src: `https://www.youtube.com/embed/${id}?${params.toString()}` };
}
