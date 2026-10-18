# Native feature demonstrations

The five landing-page demonstrations replay captured results from the actual
Trilorah interface. They do not run the desktop engine, microphone, recognition,
remote API, or output windows in the visitor's browser.

- Scripture and lyrics reuse `/hero-service/app.html` and its deduplicated states.
- Service preparation uses the real service schedule and song picker.
- Screens uses the real Outputs card and settings with its built-in sample room.
- Phone uses `public/mobile-remote.html` against `scripts/remote-preview.mjs`.
  Its enlarged monitor is the remote's actual on-screen monitor, not a separate
  desktop app instance.

The source captures are in `artifacts/showcase/native/`. To repack them:

    node scripts/build-feature-demos.mjs

The exporter strips scripts, event handlers, remote dependencies, and active links.
Documents run in script-free same-origin sandboxed frames with restrictive CSP.
Sample data and captured interface markup are the only content replayed.

Each composition has a single clock and two fixed native crops. The close-up does
not pan or zoom between steps. The shared player loads within 450px, starts when
35% visible, pauses offscreen/when hidden, and unmounts distant frames. It stops at
the final result. Reduced motion shows the final state; Replay and Next step allow
manual inspection without automatic motion. Pointer travel varies by distance;
click feedback is 140ms; reading holds differ by sequence.

Validation: `npx vitest run --config web/vitest.config.ts` from the repository root.
The focused timeline tests verify capture coverage, reading holds, preview/live
separation and inert exports. Assets added by the three new native packs total
approximately 210 KiB gzip (HTML/CSS/state data); existing hero fonts/state packs
and landscape assets are reused. This is an asset measurement, not a production
page load or device performance benchmark.
