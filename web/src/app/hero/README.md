# Hero preview

## Color studies

`/hero/variations` compares five background and typography palettes (Carbon,
Slate, Pine, Sand, and Plum), each in dark and light mode. Every study keeps the
dark-mode brand yellow at `#E4D87A` and light-mode deep green at `#07271C`,
shows a distinct surface shade, and links to the full
hero at `/hero?look=LOOK&mode=dark` or `mode=light`. The mode switch on those
study URLs stays local to the preview. The regular `/hero` uses the selected
Carbon palette and remembers the light/dark preference. Carbon has solid
backgrounds in both modes, with no gradient. Palette values live in `heroLooks.ts`.

## Current hero

The user-confirmed site accent colors are `#07271C`, `#010806`, `#E5F3F2`, and
`#E4D87A`. See the [saved palette and opacity reference](../../../../src/brand-system/README.md#site-accent-palette)
for future accent changes.
The shared `--site-*` tokens in `globals.css` now supply the hero's idle beams
and headline accents, home-page action/focus/highlight accents, product-demo
indicators, and download-page accents. Light download accents use deep green
for contrast; dark download accents use yellow. The idle beam remains at 14%
peak opacity with the existing 3.5-second delay.

`/hero` reuses `HomeNavigation`; its section links scroll within `/hero`, because
the `/home` feature sections (`HomeFeatureSections` and `HomeFooter` in
`home/HomeSections.tsx`) follow the landscape. Those sections are drawn for a dark
page, so they keep the look's dark palette in light mode too, and their content
sits on the hero's 1300px grid. The landscape is `#workspace`, and links to it
land on the fully open view.

Between the landscape and those sections, `HeroFeatures.tsx` (styles in
`hero-features.css`) adds two layout sections that follow the light/dark toggle:
a 48px statement with three `FIG 0.x` columns divided by rules, then a
seven-card bento (one card spanning two columns, then six; 400px rows, 24px
gaps, collapsing to two columns at 1100px and one at 640px). Their copy is
placeholder. Every illustration is a `DummyArt` slot: a dashed outline with
crossed diagonals, labelled with its size in the 1440px design. Slots that bleed
past a card's edge stretch with the card. Replace a slot by swapping its
`DummyArt` for the drawing at the same size and position.
The header, introduction, and landscape share a 1300px maximum content width,
with 20px side gutters on desktop and 18.75px below 1024px. The header is 64px on
desktop and smaller screens. Dark mode uses a solid near-black `#060907` with a faint green undertone
background and `#edf3ee` text, with `#acb9ae` supporting text. Light mode uses
solid `#f0f1f3` and `#22252a`. Secondary surfaces are `#141a16` in dark mode
and `#ffffff` in light mode. Both use the supplied
geometric logo. Primary actions and accent details use `#E4D87A` in dark mode
and `#07271C` in light mode, with pale-mint text on the green buttons.

The hero uses `web/public/hero-landscape/light.webp` and `dark.webp`, copied from
the laptop's Downloads folder. `AppPreview` renders both responsive images so
switching is immediate. On `/hero`, the native service demonstration starts big:
fitted inside the 1300px card with 24px to spare each side, with only its top 30%
(`REST_PEEK` in `AppPreview.tsx`) showing above the fold, or above the
landscape's own bottom edge where that comes first (phones, very tall screens),
and never closer than 32px to the landscape's top edge. As the image expands on scroll it rises and
grows to full fitted size, ending centred below the navigation. `SiteScroll` loads Lenis on the public site pages with a modest
0.12 interpolation, native touch scrolling, and reduced-motion support. The hero
follows Lenis's actual scroll position without adding a second easing delay;
without Lenis it falls back to a 120ms exponential catch-up. Width opens over the first 45% of progress, while
height starts at 18% and grows gradually through the remainder. The UI keeps its
proportions and reverses on upward scroll. The 120svh section holds the open view
for a short 20svh, then the whole landscape scrolls away with the section like
ordinary content, with the feature sections directly below. The section
edges track the actual scroll position. Lenis smooths wheel input; the hero itself
never changes scroll position. Dialogs pause scrolling behind them, and nested
menus, textareas, and response panes retain native scrolling. Lenis is destroyed
on navigation and excluded from operator, live, mic, and standalone preview pages.
Layout is measured only on resize, and the animation loop stops after settling.
The native app export does not capture pointer or keyboard input. The surrounding
chapter, pause/play, replay, and three helper controls remain accessible. Reduced
motion uses a populated static centered inset; optional replay omits shape travel,
spins, and expanding ripples. The
download page keeps its landscape-only presentation; `/hero/preview` remains
available as the standalone interactive UI preview.

The service demonstration uses the actual app's exported markup and styles in
a script-free iframe at `/hero-service/app.html`, sized to a 1600 × 940 canvas.
`states.json` deduplicates native component fragments across captured states;
the parent page replaces those fragments at the timeline's cue points. The
export includes only the CSS used by the captured app states and two local Geist
font files. It does not load the desktop JavaScript bundle, Electron bridge,
audio, microphone, or speech engine. The preview and live cards have opaque dark
surfaces. Their canvases reuse the exact cached hero landscape and follow its
light/dark selection. The imported “Be still” sample slide retains the native
deck renderer's text layout, with the same landscape replacing its charcoal fill.
Its small local SVG is packaged as `demo-be-still.svg`.
The native header uses a near-opaque dark background so its controls stay readable.
Placeholder dot textures are removed while their native SVG illustrations remain.
Empty screens say “Nothing is previewed yet” and “Nothing is live yet” in italics.
The actual header orb's captured SVG paths use a small CSS rotation/scale cycle
and staggered accent opacity, with no orb renderer or extra JavaScript loop.
The listening orb stays mounted across phase changes, avoiding repeated pose resets.

Its 82-second local timeline follows four operator sections: Songs, Sermon,
Images, and Slides. Chapter controls jump to these sections and reconstruct the
native state, captions, and actor positions even when seeking backwards. The
source fixtures populate those same four sections in the actual run of show.
Search song listens
for Amazing Grace lyrics and shows the matching song in the catches pane;
selecting the result stages it, and Go live presents it. At 15.45 seconds the
triangle clicks the native preview clear button: preview empties and live returns
to its background. Both remain clear until the next passage is sent. During the sample
sermon, Find reference opens the native passage-results overlay; choosing its
passage card sends Psalm 46:1 directly live. “Next verse” appears as a recognized
command in the transcript, while the preview's right-side next control advances
both screens to Psalm 46:2. Later, selecting a caught Psalm 46:10 stages it before
Go live sends it. Next, the triangle opens the run's Images section, chooses the
landscape in its native dialog, and the square presents it. The Slides section
repeats that workflow for the “Be still” title slide. Selecting either item closes
the dialog and stages it; Go live updates the congregation output. The sequence
stays in the operator workspace. Reference and command pills remain
non-interactive, as they are in the actual app.

The circle listens, the triangle operates the native controls, and the square
delivers content to the congregation output. SVG marks move to the actual
elements found by their native selectors. Each shape's black dot is its click
point: it leads towards the target, lands on the control, and centers the click
ripple there. The square and triangle rotate during travel, settle before pressing,
and glance towards the next destination shortly before departing. Their movements
can overlap: the square approaches Go live while the triangle makes its selection,
then sends only after the preview is ready. Native controls receive a brief visual
press before their result replaces the captured state.

Hover, focus, or click a helper to read its role. Its bubble reveals the explanation
word by word, resumes with “As I was saying…” on return, and gives a brief warning
before the helper leaves for its next task. The speech note reserves its final
text footprint while typing. Pointer leave closes a hover note; clicking an open
helper, clicking outside, or pressing Escape dismisses it. These controls do not invoke the app
engine. Caption words reveal within the captured native transcript, following the
latest visible line. A single local service clock drives the sequence and pauses
while the demo is offscreen, the page is hidden, or playback is paused. Replay
resets the sequence. Shape travel, presses, and ripples use WAAPI transform/opacity;
the small exported orb uses CSS animation. Pure timeline tests cover click/result
boundaries, dialog opening and closing, backward chapter seeks, overlapping actions,
and ordered cues without entering dashboard views.

The frame keeps its wide, slightly taller proportions and fits below navigation.
The archived standalone preview states were refreshed on
October 15, 2026, including the transcript and run empty-state illustrations,
updated stage controls, and current library navigation.
One icon button beside Download in the header switches
the landscape, page colors, and logo, and remembers the choice in local storage.
It shows a moon in dark mode and a sun in light mode. `HeroThemeToggle` morphs the
same SVG using CSS transforms and a moving mask over 240ms; rapid clicks reverse
the current transition. Keyboard activation changes the icon immediately, and
reduced motion uses only a gentle fade for the rays. `useHeroTheme` shares this
behavior between the hero and download pages; it defaults to dark mode.

The header and primary hero action say Download and link to `/download`, which
has Mac and Windows installer links. `/downlaod` redirects to the download page.
`/hero` hides Sign in in both desktop and mobile navigation. Other
pages keep their existing navigation actions.

`InterfaceReveal` reveals a random selection of six from twelve component skeletons to the right of the
`/hero` introduction. On desktop, the reveal spans the right 65vw, independently
of the content container's maximum width. Its fading left edge sits behind the
intro copy, which retains its left-half layout and clickable controls. The skeletons include
transcript, caught scripture, song card, run of show,
scripture library, live output, slide deck, media card, service timer, sermon
notes, connections, and output displays. `ComponentSkeletons.tsx` shares their SVG
geometry between the hero and `/hero/skeleton`. The mix is randomized once when
the page loads and stays fixed across hover, scrolling, and theme changes.
Reloading the page chooses a new mix. Six fitted slots preserve each
component's proportions and keep the drawings readable. Their control placement and
proportions follow the current operator components, inspected in the isolated
app source preview; long content is represented by placeholder bars. Two overlapping, unequal elliptical
gradients form a faint, asymmetric feather around a fine pointer. Their opacity
falls off immediately from the center, without a bright plateau or circular rim.
The drawing extends slightly past both sides of its region and fades into the
page through broad edge masks. No blur, turbulence, or animation library is used.
Positions update at most once per animation frame, with a 180ms opacity fade
on entry/exit. SVG coordinate conversion keeps the reveal aligned
after scaling or scrolling. The drawing follows the selected theme, becomes a
static faint illustration for reduced motion or coarse pointers, and is hidden
below 761px. It is excluded from the accessibility tree and has no controls.
After 3.5 seconds without pointer activity, three of the component skeletons gently brighten in sequence
with low-opacity green and yellow accents (14% peak opacity).
The content highlights reuse the existing SVG artwork. Only their opacity animates, with a quiet interval
between passes. Pointer activity fades the highlights away and restores the
hover reveal immediately. The idle timer and animation pause while the artwork
is off screen, the tab is hidden, or the window loses focus. Reduced motion and
coarse pointers keep the static illustration without the idle cue.

`/hero/skeleton` shows each component separately at full opacity, in light or
dark mode, with a short description and a link back to the hero. This replaces
the earlier full-screen workspace sketch. The skeletons are decorative artwork,
not runtime loading states in the desktop app.

## Refresh the native service demonstration

1. From the repository root, run
   `node --import tsx scripts/hero-service-source.mts`. This isolated Vite server
   renders the actual `LiveHost` with in-memory service data at
   `http://127.0.0.1:5181/?phase=idle`. Its fixtures do not connect to the desktop
   engine, microphone, or congregation outputs, or read personal app storage.
2. Capture the service states at 1600 × 940, using the fixture phases and the
   native controls for their resulting views. Let fonts, reference highlighting,
   and layout settle. Save captures in `artifacts/hero/service/`, retaining the
   state names used by the playback timeline.
3. Each capture contains `{ html, css, parts, viewport }`: the actual
   `[data-shell]` outer HTML, the CSS matching the captured DOM, and native
   `transcript`, `stage`, `live`, `catches`, `listen`, `orb`, `actions`, `run`,
   and `navigation` fragments. `catches` captures the library pane beside
   `.tri-library-tabs`, including its current tab content. Capture portaled run
   dialogs separately in `parts.overlay`; absent overlays use a blank placeholder
   so the next state can close them. Keep `image-section` and `slides-section`
   captures for the open native dialogs. Dashboard and full-transcript captures
   are excluded from this operator-only export.
4. Run `node scripts/build-hero-service.mjs`. It sanitizes native markup,
   removes scripts, decorative app background images, and placeholder dot textures,
   deduplicates fragments and used CSS, and packages `app.html`, `app.css`,
   `states.json`, the approved sample slide, and local fonts in
   `web/public/hero-service`. The generated iframe remains script-free; the
   website owns its timeline and decorative actors.
5. Check the song, sermon, next-verse, image, and slide sequence on `/hero`,
   including chapter jumps in both directions, native dialog closure, helper
   click points, role bubbles, pause/replay, offscreen resume, and reduced motion. Stop
   the source server when the captures are complete.

## Archived standalone preview

The interactive UI at `/hero/preview` uses a fresh export of the desktop app,
including its current icons, controls, and transcript-above-run layout. The
full interface stays visible without a bottom gradient mask. The run of show
uses the app's empty state: zero sections and the native Add a section control.
Its component and frame styles live in `preview/`; the transcript demo replays
exported app states without loading the desktop runtime. The packager rejects
captures with a populated run or truncated export data.
To refresh that saved preview after desktop UI changes:

1. From the repository root, run `node --import tsx scripts/hero-source-preview.mts`.
   This browser-only Vite server uses in-memory fixtures; it does not edit desktop files.
2. Capture each URL `/?hero=idle`, `/?hero=book`, `/?hero=caught`,
   `/?hero=reading`, and `/?hero=done` at a 1440 × 900 viewport. Set the stage
   divider to “raise the library” so the stage is fully expanded. Let layout,
   scripture highlighting, and fonts settle before exporting.
3. Export this read-only expression for each phase. Join the chunk arrays outside
   the browser and save `{html, css, parts}` as `artifacts/hero/app-PHASE.json`:

   ```js
   (() => {
     const chunk = text => text.match(/[\s\S]{1,16000}/g) || [];
     const parts = {
       transcript: document.querySelector('.operator-rail-split > section .operator-empty'),
       stage: document.querySelector('[data-finder-drop="stage-preview"]').closest('section'),
       catches: document.querySelector('.catches-pane'),
       listen: document.querySelector('[data-guide="listen"]'),
       orb: document.querySelector('.tri-header-orb'),
       actions: document.querySelector('.tri-orb-actions'),
     };
     return {
       html: chunk(document.querySelector('[data-shell]').outerHTML),
       styles: [...document.querySelectorAll('style')].map(s => chunk(s.textContent)),
       parts: Object.fromEntries(Object.entries(parts).map(([key, node]) => [key, node.outerHTML])),
     };
   })()
   ```

4. Run `node scripts/build-hero-preview.mjs`. This sanitizes the snapshots,
   preserves native component fragments in inert templates, minifies CSS, and
   packages local fonts and the background in `web/public/hero-preview`.
5. Check `/hero/preview` at desktop and mobile sizes. Stop the source preview server.

To refresh the lightweight hero image after the export, run the packager with
`--poster`. Open `/hero-preview/capture.html` at 1600 × 940, wait for the fonts
and background to render, and capture the viewport. Encode it as
`web/public/hero-preview/interface.webp` at WebP quality 90, then remove the
temporary `capture.html`. This captures the reading state with all current app
controls. This poster remains available as an archived static fallback; the main
hero now uses the lightweight service demonstration described above.

The generated public files are self-contained. Normal website builds do not
need the capture server or source snapshot. Desktop UI changes require a refresh;
they do not silently add desktop code to the website bundle.
