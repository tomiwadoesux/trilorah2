# Mobile remote

Open **Mobile remote** in the desktop header, enable access, and choose the computer’s Wi-Fi/Ethernet address. Scan its QR on a phone connected to the same trusted network. Generate a code, enter it on the phone, then approve the named phone on the desktop. Codes last two minutes and can only issue one device token.

The desktop must remain running. Access must be enabled each app session; approved phones are remembered. Turning access off closes connections. **Revoke** invalidates a phone’s token on its next request. Disconnect on the phone removes its local token.

## Controls

The phone interface now has only **Verses, Songs, and Slides** tabs. A single card shows the heard/selected item; its action changes from **Go live** to **Next** once that item is presented. Scripture entry stays fixed at the bottom, with book/chapter/verse autocomplete, range entry, translations, and word-search suggestions. Media, Themes, and Online tabs have been removed from the phone interface; their underlying desktop capabilities remain available on the desktop.

- Scripture reference/range lookup, translation selection, keyword search, detected-scripture review/dismissal, preview, Go live, previous/next verse within a chapter.
- Existing songs and their sections; imported presentations and locally created quick decks; existing media and video playback/volume.
- Live/preview labels and text, image previews for supported local images up to 3 MB, and clear/black/logo/restore.
- Scripture layout, font, color, size, margin, dimming, and library backgrounds.
- Select queued run-of-service items, create/start/pause/reset timers, display/dismiss messages, and start/stop desktop listening.
- Start/stop the existing public transcript/scripture service and show its congregation QR. Cloud sign-in and the church link must already be configured on the desktop.

Content is staged before Go live. The command checks the preview ID so a newly detected scripture or another operator’s selection cannot silently replace what the phone intended to present. Previous/next buttons change the live verse, song section, or imported slide directly. Controls continue operating when the desktop opens another tab.

Importing files, editing song lyrics, arranging the rundown, full slide design, and account/preacher administration remain desktop tasks. This implementation does not stream audio; the separate research is in AUDIO-STREAMING-RESEARCH.md.

## Connection and separation

The Electron app serves a small, self-contained phone page and authenticated JSON commands on TCP **8082**. The page polls current desktop state approximately once per second. It uses the desktop renderer’s existing engine, projector and rundown providers through a bounded IPC request/reply bridge. There is no separate phone app to install and no hosted control relay or subscription required for this LAN connection.

The private control page, public congregation page, and preacher profiles remain separate. Private pairing credentials use their own store (`userData/mobile/remote-pairing.json`), separate from the existing port-8081 integration. Public links never receive control tokens or pairing codes; the mobile API does not expose arbitrary IPC, file browsing, cloud credentials or preacher training records.

The LAN connection uses HTTP. Use trusted Wi-Fi; do not port-forward it to the internet. Windows Firewall must allow the app on Private networks, and guest-network client isolation must be disabled for these devices to connect. An internet connection is needed for public sharing and any configured cloud speech service, but not for LAN control itself.

Commands are not automatically retried. The server rejects overlapping mutations; the bridge expires unacknowledged requests. After a timeout, inspect live state before retrying because a command may have reached the desktop. Host/origin checks, pairing rate limits, bounded request bodies, and per-request token checks protect the endpoint.

## Verification

`npm run build` checks TypeScript and builds the desktop and bundled mobile page.

`npm test` includes real HTTP pairing, approval, expiry, revocation, origin/host protection, payload/rate limits, and bridge timeout tests.

After building, `npx electron scripts/mobile-smoke.cjs` launches the actual app with an isolated temporary profile. It exercises the phone page at a 390px width, pairing, scripture/song presentation, tab switching, screen controls, themes, timers/messages, an imported slide, congregation QR, and revocation. It does not sign in, start a public service, or use a microphone. Its screenshot path is printed on success. A physical phone, church router, projector hardware, and authenticated live cloud publishing still require on-site verification.
