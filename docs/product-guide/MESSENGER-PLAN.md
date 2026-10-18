# The Messenger: a tutor wired through the whole app

Brainstorm, 13 October 2026. **Status, same day: built** (lessons for eleven tasks, nerves, rephrase, troubles, progress, the eye on the triangle, the build checks, the site pages). The tone skill is deferred by the owner. Assumptions taken on the open questions: the circle stays put while travelling; unprompted speech only for warning and error notices, one line; three rephrases plus the original; the site uses the same short lines. It extends what already exists in this folder (the product map, the anchors, the triangle cursor, the change checker). Read this, mark what you disagree with, and we build from the agreed version.

## What we already have (so we don't rebuild it)

- `product-map.json`: 59 task families across 22 areas. Each has entry point, controls, prerequisites, completion signals, limitations, source files.
- 57 `data-guide="…"` anchors on real controls across 18 files. The guide finds controls by anchor, never by pixel position, so moving a button does not break it.
- The triangle cursor (`useGuideCursor.ts`): travels to an anchor, checks it is visible and not covered, clicks with a ripple, asks before every real-app action. "Show me" vs "I'll do it".
- Typo-tolerant local search across the 59 tasks. No model, no network.
- `check-product-map.mjs`: fingerprints the watched source files and names the tasks to revisit when code changes.
- `guideIndex.ts` in Vite: rebuilds the control inventory on save and pauses a running guide.
- `TONE.md` + `voice-calibration.md`: the written voice. Cheeky with a straight face, short asides, literal when a control is consequential.

So "map the whole app" is about a third done. The rest is coverage, a richer record per task, and a rule that keeps it true.

## 1. The nervous system: how the map stays accurate

The brain is the map file. The nerves are anchors in the code. The rule that keeps them honest is the checker.

**Every control that a volunteer could be told to press gets an anchor.** `data-guide="audio-input"`, `data-guide="library-songs"`, and so on. Dialogs, tabs, menus, fields, toggles. Today 57; the full app is probably 250 to 350. This is a one-time sweep, screen by screen, then a habit.

**Anchor names are stable; everything else may change.** Rename a label, restyle a button, move it to another card: the anchor travels with it and the Messenger still finds it. Delete or rename an anchor and the checker fails and names the tasks that used it. That is how a UI redesign cannot silently break the tutor.

**Three checks run on every build** (two exist, one is new):

1. Source fingerprints changed in a watched area → "review these tasks" (exists).
2. A task references an anchor that is no longer in the code → hard fail (new, cheap: the index already lists every anchor).
3. A new anchor appears in code that no task mentions → "new feature with no lesson yet" (new). This is how the tutor learns about a feature the moment it ships: it cannot be forgotten, because the build complains.

**The site uses the same file.** `dist/guide-index.json` already comes out of the build without secrets. The website guide pages render the tasks, steps and rephrases from that file, so the site and the app never say different things. Screenshots are the only site-only asset.

## 2. What a lesson looks like

Each task gets a `lesson`: an ordered list of points. Each point is one short sentence, with up to three rephrases written by us, in the voice, not generated.

```json
{
  "id": "audio.choose-input",
  "asks": ["how to connect mic", "connect microphone", "it can't hear the pastor", "mic not working"],
  "lesson": [
    {
      "say": ["Audio lives under the preview.", "Look under the preview. That's Audio.", "Audio: bottom of the preview, small button."],
      "anchor": "audio-input",
      "do": "click",
      "done": "audio-options"
    },
    {
      "say": ["Pick the one that's actually plugged in.", "Choose your real microphone, not the laptop's.", "The soundboard, if you have one. Otherwise the mic."],
      "anchor": "audio-options",
      "do": "choose",
      "done": "mic-selected"
    },
    {
      "say": ["Say a sentence. Watch for words.", "Talk. Words should appear within a breath.", "If the bar moves but no words come, that's a different problem. (I know which one.)"],
      "anchor": "listen",
      "do": "check",
      "done": "transcript-fresh"
    }
  ],
  "consequential": false,
  "since": "0.4.2"
}
```

- `asks` are the pre-written questions, typos included, that feed the search. Nobody types a perfect sentence in a booth.
- `say[0]` is what the bubble shows. The rephrase button cycles to `say[1]`, `say[2]`, `say[3]`, then back. Every line is under about twelve words.
- `do` is what the triangle may do for you: `click`, `choose`, `focus`, `type`, `point`, `check`. `point` and `check` never touch anything.
- `done` is the anchor or state that proves the point is finished, so the lesson advances when you do it yourself.
- `consequential: true` marks anything that puts something on the wall. The Messenger never performs those, in any mode. It points, you press. This is the existing rule: a verse goes live only on a press.
- `since` lets the Messenger greet an update with "new since last Sunday" and show only the new lessons.

Voice: the lines are written with `TONE.md` open. If you want this to be a skill so every future lesson is written in one voice, the skill is a thin wrapper around `TONE.md` and `voice-calibration.md`, plus the lesson JSON shape above and the twelve-word rule. You do not have one yet. It is a twenty-minute job and worth doing before the first batch of lessons.

## 3. The nerves firing: how the Messenger knows what you need

No model. Three signals, all local:

**Where you are.** Each screen and card declares which tasks are "near" it. The Messenger's search box, before you type, shows the three likeliest questions for the spot your mouse or focus is in. On the Outputs card: "set up a screen", "nothing on the projector", "preview on the wrong screen". On Audio: the mic questions.

**What is wrong.** Every notice already has a `NoticeTarget` and most have a `NoticeCommand` (`shared/serviceNotice.ts`). The map gains `troubles`: a notice id → one line in the voice + the task to open. When a notice fires, the Messenger already has its sentence ready. That is the "predicts the error" part. The prerequisites in each task are the second half: "you're about to start listening and no input is chosen" is predictable before it fails.

**What you have done.** Completion signals already exist per task. Store per church which tasks have ever completed. That is the progressive onboarding: the Messenger offers what you have not done yet and stops suggesting what you have. First Sunday it talks a lot. Fourth Sunday it is quiet unless something breaks.

**Mid-service rules.** While listening is on: the Messenger only points and speaks. No clicks. Bubble stays small, bottom corner, never over the preview. One line at a time, and the rephrase button still works.

## 4. The triangle and the circle

The triangle stays exactly as the brand Mark. The circle is the only moving part.

**Travelling** (going from one anchor to the next): the triangle moves with the existing 400–850 ms deceleration. The circle stays where it was on the edge for the first one or two hops. It does not fuss while moving.

**At rest** (bubble is typing, or it has pointed and you are just looking): the circle rides the edge of the triangle that faces your mouse.

- Mouse to the right of the triangle → circle sits on the right edge.
- Mouse to the left → circle slides round to the left edge.
- Mouse moves up or down → the circle slides a little along that edge, same direction. Small range, roughly the middle 40 percent of the edge, never reaching a corner.
- Switching sides goes round the apex, not through the triangle, with a short spring. No teleport.
- Reduced motion: circle parks on the right edge and only switches sides, no slide.

Geometry: the edge is a segment A→B. Position = A + t·(B−A), t in [0.3, 0.7], t driven by the mouse's vertical offset relative to the triangle's centre, with a damped follow so it feels like weight, not tracking. Side switch is a second parameter that eases 0→1 around the apex.

One question for you here: when you said it "completes 1 or 2 locations", I read it as "the circle stays put for the first couple of hops, then settles". If you meant something else, say so before I build it.

## 5. Build order (each step is useful on its own)

1. Voice skill from `TONE.md`, with the lesson JSON shape and the twelve-word rule.
2. Anchor sweep: every pressable control in the app gets a `data-guide`. The build check for orphan anchors and missing anchors.
3. Lessons for the first ten tasks a church actually hits: mic, screen, Bible lookup, song, service, pictures, save, phone mic, remote, nothing on the wall. Rephrases written, not generated.
4. Messenger panel: contextual questions, search, rephrase button, done-detection, per-church progress.
5. `troubles`: wire the notices.
6. The circle behaviour on the triangle.
7. Site pages rendered from `guide-index.json`.
8. Remaining 49 tasks, in order of how often support asks about them.

## Open questions

- Triangle travel: is my reading of "completes 1 or 2 locations" right?
- Should the Messenger ever speak unprompted (a line when a notice fires), or only when opened? My suggestion: unprompted only for notices, and only one line.
- Rephrase count: three rephrases plus the original, so four lines per point. Enough, or do you want a fixed four rephrases?
- The site guide: same short lines, or longer prose with the app's lines as pull-outs? The articles in `content-launch` are the longer form already.
