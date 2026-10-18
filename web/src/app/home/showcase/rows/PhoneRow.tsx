import { ShowcaseRow, ShowcaseShot } from '../ShowcaseRow';
import './phone-row.css';

/*
 * Operator remote · #remote (section class `.sc-row-companion`; placement in phone-row.css). The
 * congregation links point to the separate CompanionRow at #companion.
 * The existing CSS/demo id stays to preserve the remote's visual composition.
 *
 * Both panels are native captures (scripts/capture-showcase.mjs, @3x). In front, the real
 * phone remote (public/mobile-remote.html) in a minimal phone frame: Psalm 23:1 on screen,
 * three caught verses waiting, and the dock with go live and clear. Behind it, the desktop
 * app's mobile menu open over the live pane, so the reader sees where the remote comes from.
 *
 * Features, checked in the app's code:
 * - Mobile remote: electron/integrations/mobileServer.ts (MobileServer serves public/mobile-remote.html
 *   on the local network, pairing code + desktop approval), src/components/MobileMenu.tsx ('Mobile remote')
 * - Go live and clear from a phone: src/design/screens/useMobileRemote.ts — case 'verse' stages to preview,
 *   case 'live' promotes the preview only when its id still matches the desktop's, case 'screen' sets 'clear';
 *   the remote's dock buttons are #goLive and #clearScreen in public/mobile-remote.html
 * - QR code for the congregation: ipcMain 'show-qr' in electron/main.ts puts a QR card for
 *   `${publicWebUrl}/live/${slug}` on the outputs (also case 'qr' from the remote); the page is web/src/app/live/[slug]
 * - Nothing to install: the remote is a page the phone's browser opens from the desktop's address
 *   (MobileServer status().urls → http://<lan-ip>:<port>/remote); the congregation page is a web page
 * The phone microphone exists in the menu capture but is not advertised (not yet tried on a real phone).
 */
export function PhoneRow() {
  return (
    <ShowcaseRow
      id="companion"
      anchorId="remote"
      title="Run it from your phone."
      subtitle="Keep the operator in control."
      lead="Pair a phone as a remote to stage, send or clear from anywhere in the room."
      detail="The desktop approves each device. For people following the message, use the congregation companion below."
      features={['Paired operator remote', 'Go live and clear from a phone', 'Desktop approval', 'Runs in your phone’s browser']}
      learnMore={{ href: '/guide/remote.pair', label: 'Pair a mobile remote' }}
      caption="The actual paired phone remote stages Psalm 23:3, waits for Go live, then clears the screen. An enlarged view of its on-screen monitor shows the result."
      back={<ShowcaseShot src="/showcase/mobile-menu.webp" width={3375} height={1386} />}
      front={<PhoneFrame />}
    />
  );
}

/** The remote capture in a thin near-black phone body. Sized in cqw of the front panel, so it scales as one piece. */
function PhoneFrame() {
  return (
    <div className="sc-pr-phone" aria-hidden="true">
      <div className="sc-pr-screen">
        <ShowcaseShot src="/showcase/phone-remote.webp" width={1170} height={2532} />
      </div>
    </div>
  );
}
