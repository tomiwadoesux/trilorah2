# Trilorah live audio research

Research date: 2026-09-28. Status: proposed architecture and estimates; not implemented or load-tested. Recheck provider prices and terms before launch.

## Agreed product scope

- Each church can publish live audio from its Trilorah computer to its public QR companion page, alongside transcripts and scriptures.
- Listening is online: listeners may use mobile data or any internet connection. This is not restricted to the church network.
- Everyone in a church service hears the same source feed, including audiences of 1,000 or more; each church has a separate service session.
- Do not retain an audio recording or replay archive. Use bounded temporary memory buffers, discard expired audio, and clear buffers at service end.
- Target approximately 4–8 seconds of intentional delay to allow transcription to stabilize. Start testing at eight seconds. This is a target, not a latency or accuracy guarantee.
- This feature is separate from the private mobile control link and from preacher profiles/training data. The mobile remote remains in scope independently.
- Earlier references to OBS/video streaming were a misunderstanding. Neither is required for this feature.

## Recommended architecture

Capture the selected microphone or soundboard input once on the church computer. Timestamp audio against a stable sample timeline. Feed transcription immediately while holding broadcast audio in a short RAM buffer. Publish one audio stream to a relay, which distributes it to listeners. Send timestamped transcript batches through a fast live channel.

The listener's word highlighting must follow the audio actually playing, with an explicit mapping to the original source timeline. Recognition arrival time and the phone's wall clock are not sufficient. Pauses, reconnects, late joins, and speech-engine restarts must preserve or re-establish that mapping.

Use a church/service identifier, authorized publisher connections, and listen-only audience access. Provider secrets belong on the backend. Test tenant isolation and avoid giving public viewers remote-control permissions.

The leading monetary option is raw **Cloudflare Realtime SFU**, which distributes audio using WebRTC. Its integration still needs authentication, signaling, reconnection, explicit delay, and playback-timeline work. It is distinct from Cloudflare RealtimeKit and Cloudflare Stream.

Alternative: audio-only HLS with a server such as MediaMTX, configured for memory-only rolling segments and recording disabled. This may simplify media-playhead mapping, but hosting, distribution costs, and actual mobile latency need comparison in a prototype. WebRTC does not automatically solve precise delayed word synchronization.

Sources:
- https://developers.cloudflare.com/realtime/sfu/
- https://developers.cloudflare.com/realtime/sfu/platform/limits/
- https://developer.apple.com/documentation/HTTP-Live-Streaming
- https://github.com/bluenviron/mediamtx/blob/main/mediamtx.yml
- https://developer.mozilla.org/en-US/docs/Web/API/RTCRtpReceiver/jitterBufferTarget

## Transfer is not recording

GB in the estimates measures bytes delivered over the network, not stored audio. A single source feed delivered to 1,000 devices still requires a copy to reach each device. With a relay, the church uploads once and the relay handles that distribution.

An eight-second delay necessarily holds audio temporarily. The intended promise is no application-retained recording, not zero temporary bytes. Provider retention terms must be checked before making an end-to-end no-retention claim. A listener's ability to record their own playback is outside the app's control.

At 48 kbps mono:

`48,000 bits/second / 8 * 3,600 seconds = 21.6 MB per listener-hour`

For 1,000 listeners, one hour is 21.6 GB of audio payload. Budget **30–40 MB per listener-hour** for planning with transport overhead. This is an engineering allowance, not a measured rate or guaranteed bound. Higher music quality/stereo can increase consumption.

## Provider comparison

| Option | Published price or constraint | Assessment |
| --- | --- | --- |
| Cloudflare Realtime SFU | 1,000 GB/month shared SFU/TURN allowance; then USD 0.05/GB egress; ingress free | Best monetary fit among options checked; custom integration required |
| LiveKit Cloud | Free tier: 5,000 participant minutes/month, 50 GB, 100 concurrent participants; Ship starts at USD 50/month | More application tooling; 100 listeners plus publisher for one hour already exceeds free participant/minute allowances |
| Direct WebRTC | No hosted media fee for direct traffic; signaling and sometimes TURN required | Desktop upload and connection count grow with listeners; poor default for large public audiences |
| Self-hosted Icecast/MediaMTX/LiveKit | Free software; server, bandwidth, and operations still need providing | Useful with existing infrastructure; not automatically zero-cost internet distribution |

Cloudflare's allowance is shared by Trilorah's account, not independently granted to every church. Other services such as Workers, databases, or transcription are separate costs.

Sources:
- https://developers.cloudflare.com/realtime/sfu/platform/pricing/
- https://livekit.com/pricing
- https://docs.livekit.io/deploy/admin/quotas-and-limits/
- https://webrtc.org/getting-started/turn-server
- https://icecast.org/docs/

## Monthly audio-delivery estimates

Assumptions: 48 kbps mono, eight service hours/month per church, all listed listeners connected throughout, 30–40 MB per listener-hour planning allowance, and no other usage consuming the shared free allowance. USD; excludes tax, transcription, website/database, development, support, and existing internet/hardware.

| Usage | Estimated transfer/month | Estimated SFU charge |
| --- | --- | --- |
| One church, 100 listeners | 24–32 GB | USD 0 |
| One church, 1,000 listeners | 240–320 GB | USD 0 |
| One church, 5,000 listeners | 1,200–1,600 GB | USD 10–30 |
| Ten churches, 1,000 listeners each | 2,400–3,200 GB | USD 70–110 total |

Formula: `max(0, total monthly billable GB - 1,000) * USD 0.05`.

The connection/authentication backend might fit a free tier initially. A USD 5/month paid Workers starting allowance is a planning baseline, not a guaranteed total backend bill; additional usage and services can cost more. Thus one church at 1,000 listeners for eight hours could initially fit roughly USD 0–5/month for audio delivery plus a lightweight backend, conditional on measured usage and applicable allowances.

Backend pricing: https://developers.cloudflare.com/workers/platform/pricing/

## Possible Trilorah audio add-on prices — not decided

| Proposed price | Included listening/month | Estimated delivery cost after shared free allowance is exhausted |
| --- | --- | --- |
| USD 19/month | 5,000 listener-hours | USD 7.50–10 |
| USD 39/month | 10,000 listener-hours | USD 15–20 |

One listener-hour is one person listening for one hour. For example, 1,000 people listening for two hours consumes 2,000 listener-hours. These are proposed product prices, not provider quotes or validated margins. Backend, support, payment processing, and other costs still reduce margin. Do not promise unlimited usage before measuring actual costs; included usage and overage behavior remain undecided.

## Transcription and current implementation gaps

Source inspection found:

- `src/lib/micCapture.ts` already captures selected audio inputs and supported Windows device audio.
- `electron/asr/audioBus.ts` currently has one transcription sink; sharing capture with broadcast needs explicit fan-out.
- `electron/cloud/cloudSync.ts` flushes queued writes every 15 seconds. A faster live transcript path is needed for the target delay.
- Transcript `offset_ms` currently uses recognition-delivery wall time rather than original audio sample time. Correct this before claiming synchronization.
- `web/src/lib/syncPrefs.ts` assumes a 20-second external-stream delay plus a four-second hold. Direct audio needs its own playback mapping.
- The current web stream player embeds YouTube/Facebook rather than receiving direct Trilorah audio.
- Local Whisper does not currently return word timings through the app integration. Whisper.cpp has experimental word-timestamp capabilities that need integration and validation.
- `electron/asr/whisperLocal.ts` creates temporary WAV chunks and deletes them. Strict RAM-only audio processing requires replacing this path.

Local transcription avoids per-minute API charges but consumes computer resources. Transcribe once per church, never separately for each listener. The current local pipeline accumulates approximately five seconds of audio before inference, so a four-second target cannot be assumed achievable.

If Deepgram is used, explicitly configure and verify its model-improvement opt-out for its stated zero-retention handling after processing. Current app configuration must not be assumed to satisfy that requirement.

Sources:
- https://github.com/ggml-org/whisper.cpp#word-level-timestamp-experimental
- https://developers.deepgram.com/trust-security/your-data

The existing Supabase Free realtime limit is 200 concurrent connections. Transcript delivery can hit this limit even while audio remains within its free allowance. Evaluate a scalable live fan-out path, send batches of timestamped words, and animate highlighting locally on each phone. Archive writes can remain separate.

Source: https://supabase.com/docs/guides/realtime/limits

## Validation before launch

1. Demonstrate capture, delayed playback, and word alignment on actual iPhone Safari and Android devices.
2. Measure recognition time on representative church computers and choose a realistic delay.
3. Test late joining, pauses, phone background/lock behavior, network stalls, reconnection, input disconnection, and ending a service.
4. Load-test 1,000 listeners and simultaneous churches; measure actual bandwidth and backend consumption.
5. Verify bounded buffers and absence of application audio files, recording jobs, persistent audio caches, or audio-bearing logs.
6. Verify provider retention settings and church isolation.

The public page should offer Listen, mute, connection state, and Return to live. Browsers may require a tap before playing audio. Offer an in-room reading mode with audio off: people hearing the physical room cannot have that sound delayed to match finalized captions.

Source: https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay

## Mobile remote remains a separate workstream

The private paired mobile link should control verses, detected-scripture approval, search, translations, themes, songs, presentations, media, live/preview, clear/black/logo, service rundown, listening, timers/messages, and online-sharing/QR actions. Desktop and phone state must remain synchronized, with reconnect handling and revocable permissions. Preacher profiles and training data belong in their separate church account area.

This research does not authorize starting a paid subscription or implement any of the proposed audio features.
