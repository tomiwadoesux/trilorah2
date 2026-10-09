# Trilorah Cutout icons

Cutout is Trilorah’s original UI icon family: solid silhouettes, angular cuts, square terminals, and real transparent openings. The approved **Original Cutout** drawings are `bible`, `microphone`, `songs`, `search`, and `media`. Their geometry in `shared/cutout/core.ts` is fixed; the original study is in `src/design/entries/iconStudiesData.ts`. Use these five as the visual reference when extending the family.

The initial catalog contains 91 glyphs for the current interface. Add new meanings as the product grows. Coverage is for UI glyphs; brand and payment logos, real scannable QR codes, charts, and approved empty-state illustration artwork remain separate assets. The catalog’s `qr` icon is a symbol for a QR feature, not a working QR code.

## One source of truth

| File | Responsibility |
| --- | --- |
| `shared/cutout/core.ts` | The five approved reference drawings. Keep their geometry unchanged. |
| `shared/cutout/controls.ts` | Actions, arrows, navigation controls, and transport controls. |
| `shared/cutout/service.ts` | Service, presentation, people, device, and giving glyphs. |
| `shared/cutout/status.ts` | Status, connectivity, visibility, and related utility glyphs. |
| `shared/cutout/types.ts` | Definitions, semantic parts, category names, and motion names. |
| `shared/cutout/index.ts` | Combined registry, inferred icon names, SVG body generation, and standalone SVG generation. |
| `shared/cutout/motion.css` | Shared opt-in motion and reduced-motion behavior. |
| `src/ui/CutoutIcon.tsx` and `src/ui/icons.tsx` | Desktop React renderer and public component aliases. |
| `web/src/components/icons.tsx` | Web React renderer and public component aliases. |

Choose the nearest existing definition module. A module may contain multiple categories; `category` describes the glyph’s meaning rather than its filename. The available categories are `Service`, `Actions`, `Navigation`, `Devices`, `Status`, and `Giving`.

Keep geometry in the shared definitions. React aliases and generated SVG files must consume that geometry rather than contain separate copies. `markup` is trusted source code: never place user input, external SVG markup, scripts, or event handlers into it.

`npm run icons:build` runs `scripts/build-cutout-icons.mts`. It writes `public/cutout-icons/<name>.svg`, `manifest.json`, `sprite.svg`, `motion.css`, `CREATE-ICON.md` (a copy of this guide), and `trilorah-cutout-icons.zip`. It also rebuilds the marked icon-template block in `public/mobile-remote.html`. The manifest preserves labels, categories, geometry, part names, motion hints, and origins.

## Drawing rules

- Use `viewBox="0 0 32 32"`. Keep the main artwork approximately within coordinates 3–29, allowing small optical adjustments when necessary.
- Prefer solid `currentColor` paths and readable silhouettes. Match the reference family’s visual weight rather than turning every icon into an outline.
- Use 45° chamfers and angular bends where they fit the object. Keep open ends square. Avoid softened corners or ornamental detail that changes the family’s character.
- Make counters and gaps truly transparent. Use compound paths with `fill-rule="evenodd"`, or leave space between shapes. Never simulate a hole with a white or background-colored patch.
- Aim for 2.5–3 units of clear space in new counters and between important parts. Preserve the approved originals even where their existing details differ. Inspect at actual small sizes; a hole that only works at 64 px is too small.
- Filled paths are preferred. Where a stroke is useful, declare `fill="none"`, `stroke="currentColor"`, `stroke-width="2.5"`, `stroke-linecap="square"`, and `stroke-linejoin="miter"` explicitly, as in the original microphone stand.
- Avoid SVG IDs, masks, clip paths, gradients, filters, and `<defs>`. Icons must work repeatedly on the same page without collisions or background assumptions.
- Draw original geometry. Do not copy, trace, or slightly alter Solar or other third-party icon paths.

Check new glyphs beside the five references at 14, 16, 20, 24, and 32 px. Also inspect at the intended UI size, including 10–12 px controls where applicable. Verify recognition, apparent weight, alignment, and open counters on light and dark backgrounds.

The ID restriction applies to the icon’s own part markup. The export script adds predictable `tri-cutout-<name>` symbol IDs to the sprite and template IDs to the phone remote so those containers can be referenced.

## Parts and animation hooks

Each definition has a human-readable `label`, one `category`, and a `parts` array. Each part has a stable semantic `name`, trusted `markup`, an `origin`, and optionally a `motion` hint. Name the actual object, such as `lid`, `body`, `hands`, `beam`, or `clapper`; avoid names such as `path-1`.

The renderer turns each part into a group with these hooks:

```html
<g
  data-part="lid"
  data-motion="lift"
  data-origin="16 11"
  style="transform-box:view-box;transform-origin:16px 11px"
>
  <!-- Original SVG geometry -->
</g>
```

`data-part` is the stable animation target. `data-motion` exists only when the definition declares a motion. `data-origin` records the pivot in the 32 × 32 SVG coordinate system; the renderer defaults to `[16, 16]` if it is omitted. Give new parts an explicit, meaningful origin.

The generated `transform-box: view-box` and `transform-origin` keep pivots in SVG user coordinates. A pivot of `[16, 11]` remains the same point in the drawing when the rendered icon is 14 or 24 px wide. Do not replace it with a percentage of the individual part’s bounding box.

Separate components that could move independently without destroying the meaning: a trash lid and body, scan corners and beam, or clock face and hands. Leave structural parts still when movement would detach connected geometry or obscure another part. More parts do not require more animation. Omit `motion` when there is no useful safe default.

The available motion hints are `lift`, `turn`, `pulse`, `sway`, `scan`, `press`, and `slide`. Check the actual keyframes in `motion.css` before assigning one. In particular, `turn` makes a complete revolution, so confirm that the chosen part and pivot are appropriate and that its movement stays inside the available space.

## Add an icon

1. Search `CUTOUT_ICONS` and existing public aliases for the intended meaning. Reuse an existing glyph when it communicates the same action.
2. Choose a unique kebab-case registry name, a readable label, a category, and the minimum useful semantic parts. Use the five approved drawings as the style reference.
3. Add a definition to the appropriate shared module. Keep that module’s `as const satisfies Record<string, CutoutDefinition>` assertion. A simple new entry could look like this:

   ```ts
   bookmark: {
     label: 'Bookmark',
     category: 'Service',
     parts: [{
       name: 'ribbon',
       origin: [16, 29],
       motion: 'lift',
       markup: '<path fill="currentColor" stroke="none" d="M8 3h16l3 3v23L16 22 5 29V6l3-3Z"/>',
     }],
   },
   ```

4. Existing modules are already spread into `CUTOUT_ICONS` in `shared/cutout/index.ts`; adding a key to one automatically updates `CutoutIconName` and `CUTOUT_NAMES`. If a genuinely new module is needed, import and spread its exported definition object in the registry. Check for duplicate keys, since a later spread can overwrite an earlier one.
5. Use the desktop generic component directly, or add a public alias where useful. Preserve existing names and default sizes when changing aliases:

   ```tsx
   // Desktop usage after adding the definition:
   <CutoutIcon name="bookmark" size={16} />

   // Optional desktop alias in src/ui/icons.tsx:
   export const BookmarkIcon = icon('bookmark');

   // Optional web alias in web/src/components/icons.tsx:
   export const Bookmark = createCutoutIcon('bookmark');
   ```

6. Keep icons decorative inside an already-labeled button or link. Use `label` when the icon itself needs an accessible name. Color follows `currentColor`; set color on the caller rather than introducing hard-coded paint into the paths.
7. Rebuild the exported catalog and check types from the repository root:

   ```sh
   npm run icons:build
   npx vitest run shared/cutout/cutout.test.ts
   npm run typecheck
   ```

8. Inspect the catalog preview, exported SVGs, and the real UI. Check small sizes, light and dark surfaces, repeated instances, and any intended motion. Exported files are generated outputs; fix their shared source and rebuild rather than editing them by hand.

## Use motion intentionally

Icons are static by default. A `motion` hint prepares a part for animation; it does not start animation on its own.

```tsx
<TrashIcon size={16} />
<TrashIcon size={16} animated />
```

The `animated` prop opts into the shared CSS and plays one cycle by default. It does not create a permanent loop. Keeping the prop `true` across renders does not retrigger the animation. Tie feedback to an actual interaction or state change; do not animate every icon in the interface. The desktop renderer imports `motion.css`, and the web app loads it in its root layout. Standalone SVG consumers need the shared stylesheet and `data-animate="true"` if they want this CSS behavior.

Use the React renderer or inline SVG when you need to target individual parts. An SVG embedded through an `<img>` does not expose its internal groups to selectors in the surrounding document.

The shared stylesheet disables this motion under `prefers-reduced-motion: reduce`. For custom JavaScript animations, apply the same preference explicitly and cancel running animations if the preference changes.

For targeted feedback, keep a stable mounted icon and use its forwarded ref. Scope selectors to that instance, animate its part group, and clean up the animation when the trigger changes or the component unmounts:

```tsx
import { useEffect, useRef } from 'react';
import { TrashIcon } from './icons'; // Adjust this import to the caller.

// Start at 0; increment trigger after the relevant interaction.
export function DeleteFeedback({ trigger }: { trigger: number }) {
  const iconRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    );
    const lid = iconRef.current?.querySelector<SVGGElement>(
      '[data-part="lid"]',
    );
    if (trigger === 0 || reducedMotion.matches || !lid) return;

    const animation = lid.animate(
      [
        { transform: 'translateY(0)', offset: 0 },
        { transform: 'translateY(-1.5px)', offset: 0.45 },
        { transform: 'translateY(0)', offset: 1 },
      ],
      {
        duration: 800,
        easing: 'cubic-bezier(.22,1,.36,1)',
        iterations: 1,
      },
    );

    const cancelForReducedMotion = () => {
      if (reducedMotion.matches) animation.cancel();
    };
    reducedMotion.addEventListener('change', cancelForReducedMotion);
    return () => {
      reducedMotion.removeEventListener('change', cancelForReducedMotion);
      animation.cancel();
    };
  }, [trigger]);

  // Parent control supplies the accessible name. Leave animated off here.
  return <TrashIcon ref={iconRef} size={18} />;
}
```

Keep the component’s React key stable. Do not select parts globally with `document.querySelector`, because many instances share the same semantic part names. Do not combine the built-in `animated` behavior and a custom animation on the same part. Animate the inner group rather than the outer `<svg>`: the caller may already rotate, scale, or position the root with classes or styles, and that transform must remain intact.

## Prompt for a future icon

Copy this prompt and supply the name, meaning, and suggested parts. Parts can be `infer` if the object does not have an obvious decomposition.

```text
Add a Trilorah Original Cutout UI icon.

Name: [unique kebab-case name]
Meaning: [what users should recognize or do]
Parts: [semantic components, or "infer"]

Read docs/CUTOUT-ICONS.md and the current shared/cutout definitions,
registry, types, motion stylesheet, and React wrappers. Search for an
existing equivalent before adding a new glyph.

Match the five approved originals in shared/cutout/core.ts without
changing their geometry. Draw original paths; do not copy or trace
Solar or other third-party icon geometry. Use the 32 × 32 grid,
approximately 3–29 bounds, solid currentColor shapes, angular 45°
chamfers, square terminals, and true transparent counters. Keep new
important gaps around 2.5–3 units. Do not use background patches,
SVG IDs, masks, clip paths, gradients, or filters.

Add one definition to the appropriate shared module with a readable
label, an existing category, stable semantic part names, and explicit
SVG-coordinate origins. Only assign existing motion hints to parts
that can safely move; keep structural parts still. Leave animation
off by default and preserve reduced-motion behavior.

Use the shared registry for all rendering and exports. Add a public
React alias only where useful, preserving existing aliases and sizes.
Run npm run icons:build, npx vitest run shared/cutout/cutout.test.ts,
and npm run typecheck, then inspect the icon
beside the approved references at its real UI size and at 14, 16, 20,
24, and 32 px on light and dark backgrounds. Check repeated instances
and any intended animation. Report the files changed and validation.
```
