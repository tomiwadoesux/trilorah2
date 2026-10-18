# Montfort mountain and cloud scene

Local extraction of the opening WebGL scene at <https://mont-fort.com/>, retrieved
15 October 2026. It retains the original mountain geometry, texture assets,
environment map and camera curves. The viewer adapts the cloud placement,
lighting and wind-driven clouds at runtime.
The selected direction is **01 — Dark rocky peaks**: a runtime material adapter
replaces the snow surface with textured charcoal stone and accent-colored patches on the
lower slopes and ledges, keeping the high summit and steep cliffs rocky.
The atmosphere matches `/hero`'s selected Carbon interface palette: soft gray
daylight on **#f0f1f3** and near-black night on **#060907**, with neutral or
green-tinted mist and clouds. The upper sky blends into that exact app background;
the studio surroundings, loading screen and controls use the same theme colors.
Slope patches use the site's forest-green accent, **#07271c** (`--site-green`),
in light mode and its yellow accent, **#e4d87a**, in dark mode. The main
mountain and distant valley peak switch accents with the theme.
The dark-mode mask selects the visibly green parts of the original light surface,
so faint moss blends on grey rock do not turn yellow.
Soft side lighting reveals the ridge shapes, with neutral night light keeping
the stone grey beside the yellow patches. The accent patches have feathered
edges and retain the existing rock grain. Haze increases with distance and
settles into lower terrain, keeping near ridges crisp and far peaks softer.
The light direction is fixed in world space while editing the camera.
The two cropped foreground mountain props from the source composition are
omitted at runtime: their open bases looked like floating terrain and one
appeared pasted over the main slope from the chosen cameras. The continuous
main terrain and distant valley peak remain, with the latter correctly ordered
behind the clouds and prevented from writing depth through its transparent base.
Light/dark mode adapts the scene and interface palettes. This is a standalone
study for editing; the existing Trilorah pages do not import it.

The page is a device-preview studio: its controls sit outside one embedded scene
at `index.html?embedded=1`. This interface is for choosing compositions; the clean
presentation is available at `index.html?view=final`.

## Alpine valley option

Choose **Alpine valley** in the Mountain style selector, or open
`index.html?view=final&look=alpine`. **Clouded mountain** returns to the existing
rocky scene. This option uses the Trading entry from the original camera path
(and its separate phone target), with the same mountain geometry and original
snow/rock mask. Its warm summit and blue valley lighting are a new local treatment
inspired by the Trading reference, not its original baked lighting.

The foreground stays clear. The main, chapter and transition cloud layers are
hidden, as are the original homepage peak props. Three smaller distant ridges
reuse the existing peak geometry, softened by atmospheric color and a base fade.
One wind-driven cloud bank crosses their lower slopes in world space and
depth-tests behind the main mountain. Narrow phone crops emphasize the main
summit; wider views expose more of the distant valley.

Light mode uses a higher sun (52° elevation, 135° direction); dark mode lowers it
to 16° and swings it to -125°, warming the summit against blue valley shadows.
The CSS sky opening moves from high left to low right with the theme.
Theme changes travel over 2.4 seconds with an ease-in-out curve: the sun direction,
mountain lighting, cloud colors and CSS sky fade together. Clicking again reverses
from the current appearance. The camera stays still. Reduced motion uses a short
200 ms color fade and skips the sun's travel. The theme button responds immediately;
the scene then settles into the selected mode.
The background is `alpine-look.css`: a gradient halo, soft vertical
light rays and a few subtle points behind the transparent mountain canvas.
Only CSS transforms and opacity animate, over 14–22 seconds. **Pause glow** freezes
the ambient rays and points; **Animate glow** resumes. Reduced-motion preferences
keep this ambient motion still. Explicit day/night changes remain available.
The camera stays fixed until a position slider is moved.

The glow is separate from the mountain lighting: changing CSS colors does not
cast light or shadows on the model. Edit the CSS keyframes to change its motion,
or drive the three layer elements from a future page animation. The distant
valley reuses existing textures and adds two draw batches (instanced peaks and
one cloud card), with no new downloads or shadow-map passes.
The existing WebGL renderer still redraws the
mountain while visible; this is not an on-demand static render. The clouded option
retains the original user-chosen device poses in `camera-views.js` unchanged.

## Chosen camera views

The user's web, iPad and iPhone compositions are stored at full precision in
`camera-views.js`. Open `index.html?view=final` for the clean responsive preview:
it starts with these chosen cameras, animated clouds, device buttons and the light/dark toggle,
without importing the camera editor or studio. The chosen material uses the
existing terrain and textures. Clouds move with the wind; moving the pointer
does not distort them or move the camera. The original mouse feedback simulation
is disabled.

The top buttons switch between Full window, Phone, iPad, Laptop and Desktop.
Rotate swaps the selected screen's dimensions while preserving its chosen pose.
One embedded scene resizes in place; Full window restores the edge-to-edge view.
Use `index.html?view=final&embedded=1` for the scene alone without preview controls.

**Camera & light** opens three position sliders: Left/right, Down/up and
Farther/closer. They translate the camera along its own axes. Position and target
move together, preserving the exact quaternion, up vector, field of view and
zoom. The camera stays where it is placed. **Reset position** restores the
chosen shot. There are no camera presets, automatic camera movements or playback
controls in this preview.

Final-preview adjustments are remembered for the web, iPad and phone camera
families during the current page session. Laptop and Desktop share the web
camera. Resizing or closing the panel preserves adjustments. **Copy view &
lighting** copies the full pose, logical screen size, camera-local offsets and
lighting settings. **View coordinates** displays selectable JSON. These
experiments do not overwrite `camera-views.js` or the studio's saved views.

The light controls expose the existing directional surface shading: Sun direction,
Sun height, Sun strength, Shadow fill, Rock detail and Terrain mist. Lower fill
makes unlit faces darker, while a lower light angle reveals slope changes. Terrain
mist controls distance haze only; it does not change the separate animated cloud
layers. Lighting settings stay shared across devices. Each theme remembers its
own manual sun and lighting adjustments during the page session; switching
themes restores those settings and updates the sliders. **Reset lighting**
restores the current theme's defaults. The clouded option also switches between
a higher daytime sun and a lower nighttime direction.

This lighting uses the existing rock normals and shader passes. It does not add
a visible sun disc or live cast shadows between peaks. Actual cast shadows would
need shadow-map rendering; the current controls add no textures or render passes.

Web uses a 50° lens at the 1920 × 963 reference viewport. iPad uses 55° at
834 × 1194; phone uses 55° at 390 × 844. Other viewport ratios naturally change
the crop. The inferred responsive rules select phone at widths up to 767px
(also landscape up to 960px wide and 600px tall), iPad through 1199px, and web
above that. Rotation reuses that device's chosen pose; separate landscape shots
have not been supplied.

The studio's **Use chosen framing** button restores the supplied shot for the
selected preview. Laptop and Desktop use the web shot; Full window follows the
responsive rules. Opening the studio, switching devices or rotating a preview
always restores the supplied camera for that device. Browser saves remain
available through the explicit Load saved button and never override a device
selection. The clean preview uses the same source-controlled choices.

## Open

With the existing web dev server running, open
<http://localhost:3003/mountain-scene/index.html>.

Or serve this folder independently, with no install or build:

```sh
cd web/public/mountain-scene
python3 -m http.server 8080 --bind 127.0.0.1
```

Then open <http://localhost:8080/>. Use HTTP rather than opening the HTML as a
`file://` URL, because ES modules and model loading require a server.

## Tweak

- **Camera → Explore camera:** take control of the current view. Drag to orbit,
  Shift-drag or right-drag to pan, and use the wheel/trackpad to move closer or
  farther away. The original scroll camera resumes with Return to scroll.
- **Camera coordinates:** inspect or edit the camera position and the point it
  looks toward. Distance changes physical camera placement; Field of view changes
  the lens angle. Copy view exports the current camera and screen as JSON.
  Save view stores a composition for the selected screen; Load saved restores it.
- **Adjust scene:** cloud speed, density, field of view, and shared atmosphere
  colors. Changes persist in local storage.
- **Light mode / Dark mode:** the button beside Adjust scene switches both the
  landscape and interface palettes. It also restores that theme's atmosphere
  colors; the selected theme persists in local storage.
- **Reset scene:** restore the configured defaults, including light mode, and
  return to the summit.
- **Export settings:** download scene settings, the current `camera` and all
  manually saved `deviceViews` as JSON.
- **H:** hide/show the interface. A small button restores it on touch devices.
- **`config.js`:** edit `defaults`, the `themes` palettes or `layout` scroll
  dimensions. After editing defaults, click Reset scene to replace saved browser
  values.
- **`scene.js`:** readable bootstrap and shader-control adapter. Modify the
  `makeCloudEditable` function for shared cloud uniforms and transition sheets.
- **`windy-clouds.js`:** rounded mountain banks, directional shading, continuous
  wind and continuous cloud cover without synchronized fading.
- **`terrain-composition.js`:** omits the two cropped foreground peak props while
  preserving the continuous mountain and the distant valley backdrop.
- **`rocky-terrain.js`:** the dark rocky surface adapter. It leaves the original
  source assets and vendor bundle intact, so removing its bootstrap call restores
  the original snowy materials.
- **`atmosphere.js`:** overcast sky and theme-aware cloud colors, reusing the
  existing sky mesh and noise texture without adding assets or render passes.
- **`cloud-interaction.js`:** disables the original mouse feedback simulation
  and supplies a neutral texture for extracted materials that still expect it.
- **`render-budget.js`:** drawing-buffer pixel budget and visibility pausing.
- **`studio.js`:** device sizes, preview scaling, parent controls and device views.
- **`final-preview.js`:** device buttons and a resizable fixed-camera preview.
- **`scene.css` / `index.html`:** replace the study interface with your content.

The scene opens in light mode unless a saved theme is present, with a **55°**
field of view. Cloud speed is **1.00** and density is **0.90**. Nine existing
mountain cloud cards form denser banks with rounded overlapping lobes, soft
fringes, lighter edges and darker cores. The silhouettes and their noise detail
travel together with a small gust variation. Clouds pass through the view
instead of making every layer fade into existence.
A persistent, noise-shaped lower mist floor keeps the view atmospheric as thinner
patches cross the ridges; there is no synchronized clearing phase. Broad soft
card boundaries replace the old horizontal band that could expose a straight
cutoff. Aspect-correct screen noise prevents the nearest tilted cards from
stretching puffs into vertical streaks.

The mountain-bank shader uses five texture reads instead of the prior six,
with no added images, geometry, render passes or animation loops. The terrain
cleanup also reduces the extra peak instance count from three to one. Chapter cloud
sheets retain their separate original effects. `cloudPlacement.heightOffset`
lifts the existing banks by 25 world units to veil the mountain face. Existing
browser settings receive this wind-and-density preset once; later manual edits
persist. The travelling-cloud update restores wind speed to its default once;
later speed edits persist. Removed pointer and parallax settings are ignored.
The theme, saved camera compositions and lighting remain unchanged by these
migrations. Sky and mountain haze remain visible at zero cloud density.

Light/Shadow adjust fog and sky-shadow colors. Daylight uses `#d6dadd` / `#cbd0d2`,
with a `#f0f1f3` sky opening. Night uses `#252e2a` / `#0d1511`, with a diffuse
`#26322c` opening, a darker cloud ceiling, and subdued neutral terrain light.
The backgrounds, surface, text and control accents follow the Carbon palette in
`src/app/hero/heroLooks.ts`: the light accent is `#07271c`, while the dark accent
is `#e4d87a`. Controls and the mountain's slope patches share these accent colors.
The raw sky shader blends its upper edge into the
theme's exact background color. No landscape photos are loaded by the scene.
Cloud highlights and terrain lighting also change with the theme. The canvas
has no brightness filter. Sky/cloud shaders receive display RGB while terrain
materials and fog receive linear RGB, matching the original renderer's pipeline.
Existing browser settings receive the new palette once while retaining their
theme and cloud density; later manual palette edits continue to persist.
Theme changes synchronize between open studio and final previews without
changing another preview's device framing or cloud settings.

The original cloud clock was elapsed wall time. This viewer uses a continuous,
adjustable clock that pauses with rendering when hidden or offscreen, so the
exact cloud phase can differ. Reduced-motion preferences disable cloud drift
while retaining explicit scrolling and manual camera controls.

## Interaction and rendering budget

Cloud animation is driven only by wind. There are no cloud pointer listeners,
cursor uniforms or spring updates, and camera parallax is disabled. The original
512 × 512 feedback simulation remains disabled: one buffer becomes a neutral
1 × 1 texture for materials that still expect it, and the other buffer is
released. The final camera stays still and retains its viewing angle when its
position sliders are adjusted. The studio's explicit orbit, pan and zoom
controls remain available.

The drawing buffer is capped at two million pixels, with a maximum pixel ratio
of 1.5 on desktop and 1.25 for coarse pointers or widths below 768px. Larger
viewports can use a ratio below 1 to stay within that pixel budget. The viewport,
renderer and shared resolution uniforms use the same capped ratio.
Rendering pauses when the document is hidden, the page is suspended, or the
scene leaves the viewport; resuming resets the clock delta.

The polish adds no assets, texture samples, shadow passes or separate animation
loop. It still renders the existing WebGL scene and transparent cloud layers;
the pixel cap and removed feedback pass reduce work, but frame rate depends on
the device and has not been benchmarked on physical hardware.

## Device previews and saved views

Choose a screen at the top of the Camera panel, frame the shot, then Save view.
Rotate swaps the width and height of a fixed preset.

| Preview | Logical viewport, CSS pixels |
| --- | --- |
| Full window | Current browser window size |
| Phone | 390 × 844 |
| iPad | 834 × 1194 |
| Laptop | 1440 × 900 |
| Desktop | 1920 × 963 (chosen web reference) |

Each preset resizes the embedded scene's actual viewport, so its responsive
layout and camera aspect ratio use those dimensions. The display percentage
only scales the preview to fit the editor. These frames do not emulate device
hardware or performance.

In the original studio, switching screens always loads the chosen shot, including after camera edits.
Save view explicitly persists an edited composition in local storage, with
separate slots for each fixed device and orientation. Full window has one slot.
Load saved explicitly restores the selected slot. The selected preview is
restored when the studio opens again, using its source-controlled chosen view.
Remove this saved view clears only the selected slot, keeping its current framing.

Copy view includes the device, orientation, viewport width/height/aspect, camera
pose and normalized `scrollProgress`. Copy all saved views bundles every
manually saved shot as `{ version, views }`; drafts are excluded. The JSON text
box also provides a selectable copy if clipboard access is unavailable.

## Scene structure

| File | Purpose |
| --- | --- |
| `config.js` | Defaults, dark/light palettes and scroll dimensions |
| `studio.js` | Device preview iframe, mirrored controls and saved device views |
| `final-preview.js` | Lightweight device switcher around one fixed-camera scene |
| `preview-devices.js` | Shared phone, iPad, laptop and desktop screen dimensions |
| `camera-views.js` | Exact chosen shots, reference viewports and responsive selection |
| `presentation-camera.js` | Responsive camera with manual position offsets and a fixed viewing angle |
| `camera-position.js` | Camera-local translation math and offset bounds |
| `camera-playground.js` / `.css` | Camera/light sliders and pose/lighting export |
| `rocky-terrain.js` | Dark rock surface adaptation using existing texture assets |
| `atmosphere.js` | App-matched overcast sky and theme-aware cloud palette |
| `alpine-look.js` / `.css` | Alpine camera, transparent canvas and animated CSS glow |
| `distant-valley.js` | Distant instanced ridges and a depth-tested background cloud bank |
| `theme-transition.js` | Interruptible sunlight and atmosphere interpolation on the existing scene ticker |
| `cloud-interaction.js` | Disables mouse feedback and provides a neutral compatibility texture |
| `render-budget.js` | Pixel-ratio cap and pause/resume for hidden or offscreen scenes |
| `scene.js` | Engine bootstrap, editable controls, theme switching and persistence |
| `camera-editor.js` | Optional free camera, live coordinates and saved views |
| `assets/models/mountains.glb` | Mountain mesh, sky, global clouds, camera and target paths |
| `assets/models/homepage/Homepage.glb` | Additional homepage scenery |
| `assets/models/homepage/TopChapters.glb` | CloudSea and SparseClouds geometry |
| `assets/textures/` | Original noise, surface textures, lightmap and EXR environment |
| `vendor/App.ST3WWojO.js` | Original bundled Three.js renderer and scene code |
| `vendor/*.js` | Original engine dependencies, including GSAP/ScrollTrigger |
| `shaders/` | Readable reference extracts of the original cloud and mouse shaders |
| `assets-manifest.json` | Public source URLs, checksums and vendor modifications |

The `.glb` models can be opened in Blender. Scene materials are replaced by custom
shaders at runtime, so opening the mesh alone does not reproduce the clouds.
The shader reference files are documentation; runtime changes belong in
`scene.js` or the vendor module.

For deeper edits, `window.mountainScene` exposes the running engine in DevTools:

```js
const { app, options, sceneUniforms, applyOptions } = window.mountainScene;
const camera = app.webgl.camera;
const mountain = app.webgl.mainScene.mountains.mountainMaterial;
const clouds = app.webgl.pages.Homepage.chapters.TopChapters.clouds;
options.cloudSpeed = 1.5;
applyOptions();
```

## Camera and scrolling

The original camera spline, chapter timelines and smooth scrolling drive the
opening pullback. The hero and TopChapters retain their source virtual dimensions
of 150vh and 1289.485677vh in `layout`; shortening those dimensions changes the
movement along the path. The study exposes two screen heights of scrolling
(`scrollVh: 200`) and clips later chapters.
Original surrounding page content is omitted, so scroll timing at other viewport
sizes can differ from the source site's responsive text layout.

Free camera mode pauses scrolling inside the preview and disables the original camera's
automatic pose updates, preserving the scene itself. Returning to scroll restores
the original path. Copy view preserves position, target, orientation, lens settings
and scroll position alongside device metadata so a chosen composition can be
used later.

## Provenance

The mountain models, textures and bundled implementation are third-party
materials from Montfort's public website; this extraction does not establish
reuse rights or add a license to them. Original library notices remain in the
vendor modules. No tracking scripts, cookie widgets, audio, site content or
branding graphics are loaded. All scene assets are local.

The vendor module has three small adaptations recorded in the manifest: resolve
asset URLs relative to the module, expose shared uniforms, and omit unrelated
font preloads. Only the Hero and TopChapters are initialized by the new bootstrap.

## Requirements and validation

The implementation requires WebGL 2, as does the original renderer. Previous
browser checks covered both themes, the rocky surface, the supplied desktop,
iPad and phone framings, studio resizing, and saved-view restoration. The camera
editor was also checked for orbit, pan, zoom, coordinate/lens editing, copying
and returning to scroll mode. Original asset checksums and the chosen camera
data remain unchanged. This adapts the existing mountain mesh rather than
replacing it with the concept board's mesh.

For the lighting, cloud and render-budget polish, JavaScript
syntax and lightweight mock checks cover the new controls and rendering
lifecycle. Browser checks passed for desktop light and dark themes, phone and
iPad framing, with no console warnings or errors. These
are functional and layout checks, not FPS benchmarks or performance tests on
physical devices.

Manual camera and lighting controls passed syntax and mock checks for translated
positions and targets, exact orientation preservation, stationary camera ticks,
bounds, device-family memory, theme preservation and lighting reset. Browser
validation covers the sliders, theme switching and shader compilation.
