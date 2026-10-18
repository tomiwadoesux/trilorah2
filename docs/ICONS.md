# Trilorah UI icons

The desktop app, website, congregation companion, phone microphone and
standalone phone remote use **Nubo**, provided by `@nubo-icons/react@0.3.0`.
Unselected items use **Line**; selected controls use **Duo** with Nubo's
default 30% secondary fill and the control's existing color.

Official documentation: https://nubo.davidumoru.me/docs

`shared/icons/nubo.ts` maps Trilorah's semantic icon names to Nubo's exports.
The adapters in `src/ui/NuboIcon.tsx` and `web/src/components/icons.tsx` keep
React local to each app: desktop uses React 19 and web uses React 18.
Named imports keep unused Nubo glyphs out of the bundles.

Pass `selected={isSelected}` on icons in tabs, navigation and toggles.
The desktop `Button`, `DashboardButton`, library toolbar and tab dock also
supply selection through `IconSelection`, so caller-provided icons inherit
their control's state. An explicit `selected` prop takes precedence.

Existing public icon names, sizes, refs, SVG props and accessible labels remain
supported. Labelled icons are announced; icons inside labelled controls are
decorative. Glyphs stay still; motion belongs to their surrounding controls.

## Closest available symbols

Nubo does not have an exact counterpart for every previous Trilorah glyph.
These names retain their existing meaning in code and use the following symbols:

| Trilorah use | Nubo glyph |
| --- | --- |
| Scripture | BookOpen |
| Scan | Camera |
| QR / join code | SquaresFour |
| Listening / live audio | Microphone |
| Presentations | Monitor |
| Giving | Wallet |
| Prayer | Heart |
| Communion | HeartStraight |
| Branding / palette | SlidersHorizontal |
| Bank | Building |
| Language | Globe |
| Save | Archive |
| Split / merge | Scissors / Link |

The QR code itself remains generated data. Brand marks, payment-provider logos,
charts and illustrative scenes are separate from the UI glyph system.
The earlier Cutout library remains a historical design exploration.

## Adding an icon

Use named Nubo Line and Duo exports. Add its semantic mapping, import both glyphs into
the relevant adapter and expose it through `src/ui/icons.tsx` or the web adapter.
Do not add a second icon pack or hand-draw a generic control icon.

`npm run icons:build` synchronizes Nubo templates and the license notice into
`public/mobile-remote.html`. The phone remote stays self-contained and needs
no React runtime or external icon requests. The historical Cutout exporter
is available separately as `npm run icons:build:cutout`.

Nubo is MIT-licensed, copyright 2026 David Umoru. The complete notice ships in
`public/licenses/nubo.txt` and `web/public/licenses/nubo.txt`.
