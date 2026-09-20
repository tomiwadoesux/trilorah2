import { describe, it, expect } from "vitest";
import { parseStreamUrl } from "./streamEmbed";

describe("parseStreamUrl — whatever a church admin pasted", () => {
  it("takes a plain watch URL", () => {
    const e = parseStreamUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(e?.kind).toBe("youtube");
    expect(e?.src).toContain("/embed/dQw4w9WgXcQ");
  });
  it("takes a /live/ URL, which is what a church actually copies mid-service", () => {
    expect(parseStreamUrl("https://youtube.com/live/abcdEFG1234")?.src).toContain(
      "/embed/abcdEFG1234",
    );
  });
  it("takes youtu.be and m.youtube.com", () => {
    expect(parseStreamUrl("https://youtu.be/abcdEFG1234")?.kind).toBe("youtube");
    expect(parseStreamUrl("https://m.youtube.com/watch?v=abcdEFG1234")?.kind).toBe("youtube");
  });
  it("survives a missing scheme", () => {
    expect(parseStreamUrl("youtube.com/watch?v=abcdEFG1234")?.kind).toBe("youtube");
  });
  it("asks for the JS API, or the player clock would be unreadable", () => {
    expect(parseStreamUrl("https://youtu.be/abcdEFG1234")?.src).toContain("enablejsapi=1");
  });
  it("keeps iOS out of fullscreen so the transcript stays visible", () => {
    expect(parseStreamUrl("https://youtu.be/abcdEFG1234")?.src).toContain("playsinline=1");
  });
  it("wraps a Facebook video in the plugin player", () => {
    const e = parseStreamUrl("https://www.facebook.com/VictoryRoyal/videos/1234567890/");
    expect(e?.kind).toBe("facebook");
    expect(e?.src).toContain("plugins/video.php");
    expect(e?.src).toContain(encodeURIComponent("facebook.com"));
  });
  it("returns null for anything it does not recognise — no empty player chrome", () => {
    for (const bad of [
      null,
      undefined,
      "",
      "   ",
      "not a url at all with spaces",
      "https://vimeo.com/12345",
      "https://youtube.com/watch",
      "https://youtube.com/channel/UC123",
    ]) {
      expect(parseStreamUrl(bad)).toBeNull();
    }
  });
});
