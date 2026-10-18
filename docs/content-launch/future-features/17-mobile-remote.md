---
id: "17"
title: "Your phone has been promoted."
slug: "mobile-remote-controls"
subtitle: "Control scripture, lyrics, slides, and media from a paired phone."
audience: "Church volunteers who need presentation controls away from the computer"
status: "draft — ready for copy review; release verification pending"
reviewed_on: "2026-10-11"
publication_date: null
publish_trigger: "Mobile remote passes paired-phone and desktop release checks."
source_paths: [public/mobile-remote.html, src/components/MobileRemotePanel.tsx, src/design/screens/useMobileRemote.ts, electron/integrations/mobileServer.ts, electron/integrations/mobileBridge.ts]
release_gate: "Verify real-phone pairing, approval, revocation, preview/live actions, and connection loss in the release build."
evidence: "evidence.md#1-mobile-remote-controls"
visuals: "README.md#components-and-visuals"
---

# Your phone has been promoted.

(You should probably thank us.)

Trilorah's mobile remote puts presentation controls on a phone paired with your computer. You can choose scripture, open saved lyrics, select slides and media, and see what's live while standing somewhere else in the room.

The computer still runs the service. Keep both devices on the same network and leave Trilorah running on the desktop.

## Check it from a seat

During rehearsal, take your phone to the back row. Select a prepared slide, check the preview, and press **Go live**. Now you can judge the actual screen from where people will read it, with the controls still in your hand.

Advance through lyric cards or presentation slides. Choose another passage. Clear the projected words when you're finished. For video, the remote also has playback controls.

The remote shows the desktop's current preview and live content. If another operator changes the preview before your **Go live** request reaches the computer, Trilorah asks you to review it again. Be aware that the scripture send control and a song card's **Live** button send that selection directly to the screen.

## Pair it before the service

1. Put the phone and computer on the same network, then open **Mobile remote** on the desktop and enable mobile access.
2. Scan the displayed QR code, or open the connection address on your phone.
3. Enter the pairing code and request access. Codes last two minutes.
4. Approve that phone on the desktop, then try a prepared item during rehearsal.

You can revoke a paired phone or turn off mobile access from the desktop. Guest Wi-Fi can block connections between devices, so use the network you have tested in the room.

This remote controls the connected computer; it doesn't turn the phone into a standalone presentation system. The phone microphone and public congregation page are separate features.

Start with one job: check a lyric slide from the back row, advance it, then clear it. For the desktop side of that rehearsal, follow [put the right content on the right screen](../articles/05-connect-the-right-screens.md).
