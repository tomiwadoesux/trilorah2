---
title: "Trilorah Privacy Policy"
status: "incomplete draft — held for the decisions and release checks in OPEN-FACTS.md"
reviewed_on: "2026-10-17"
effective_date: "unset — assign at publication"
operator: "Ayotomiwa Durojaye — supplied by the founder"
contact: "privacy@trilorah.com — proposed, confirmed not active by founder"
publication_dependencies: "OPEN-FACTS.md — internal; do not render with the policy"
evidence: ["evidence-desktop.md", "evidence-web-cloud.md", "legal-research.md"]
---

# Trilorah Privacy Policy

Trilorah is operated by **Ayotomiwa Durojaye**, based in Texas, USA. In this policy, “we” and “us” refer to that operator. This policy explains how information is handled through Trilorah's website, desktop application and connected services.

Your church chooses what material it puts into a service and which features it uses. A church's own computer, independently operated installation, files and other services can be subject to its own practices. This policy explains the Trilorah flows described below; it does not replace information your church or a separate provider gives you about its handling of your information. Describing information stored on a church's computer does not mean that we receive a copy of every local file.

## Information you provide

When you create an account, we receive the account details you submit, including your email address and account or church name. Account passwords are submitted to the configured authentication service. A church can also provide its name, public page address, logo, giving links and related profile information.

Material used in Trilorah can include songs, slides, images, videos, service plans, operator notes, sermon words, scripture references and generated notes. Preacher profiles and correction features can store names, preferences, vocabulary, heard words and recognition corrections. What is processed depends on the content and features used. Service material can reveal personal information, including religious beliefs, prayer requests or information about other people.

If you contact us, we receive your message, contact details and any diagnostic information or files you choose to provide. Please avoid sending passwords, API keys or private service material that is unnecessary for your request.

## Audio, transcription and generated notes

Trilorah can capture sound from an input selected by the operator, including an approved phone microphone. The speech engine determines how that audio is transcribed:

- **Local Whisper** processes speech on the computer. It writes short temporary audio files for transcription and attempts to remove them afterwards. Initial setup can download model or runtime files.
- **Deepgram** receives captured audio when its cloud speech engine is selected and configured. Configured vocabulary, such as church or preacher names, can also be sent to help recognition.

Choosing local speech does not turn every Trilorah feature into local-only processing. Cloud sharing, generated notes, optional background language-model analysis, online content and phone connections have separate data flows.

Generating sermon notes uses an external language-model service through the configured Hugging Face integration. Transcript text is included in the request. The current option labelled “local” notes also delegates generation to that cloud service. If optional background analysis is enabled and configured, it can send speech excerpts, recent transcript and reference/service context for analysis.

Provider handling of submitted information also depends on the service and account configuration being used. Selecting a local speech engine does not determine how those separate providers handle transcript text or other information they receive.

## Cloud services and public congregation pages

When cloud access is configured and an operator is signed in, starting listening can start a cloud service with public sharing and transcript publication enabled. Cloud service records can include the account, preacher, service title, transcript, service segments, scripture references, whether a passage was presented, and generated notes.

Public visibility and cloud storage are separate controls. While a cloud service is active, transcript uploads are not prevented merely by disabling public visibility or public transcript display. Stopping listening does not itself end the cloud service or delete previous uploads.

The congregation page for a public service can show shared passages, transcript, notes and church-provided giving information. People who can open the public link can access the information made available there; the web page is not restricted to church Wi-Fi merely by the desktop's Wi-Fi-sharing label.

Ending a service does not itself delete its stored content. The congregation page can continue to show a saved public service after the live session ends, and its history view can provide links to earlier public services. Shared transcripts and notes can be downloaded or shared by visitors. Stopping transcription, stopping sharing, removing a local file and deleting cloud records are different actions.

## Congregation visits and browser storage

When you open a congregation page associated with a service, it records visit information. This includes a random browser identifier, service and account identifiers, browser/device information, visit timestamps, and IP-derived city and country information. The page requests the IP and approximate location from **ipapi.co** and stores the returned IP address with the visit information in the configured cloud database. It periodically refreshes the visit's last-seen time while the page is open.

The browser identifier is saved in browser storage so visits and any supported scripture feedback can be associated with that browser. It is not your account name, but the identifier and associated records are not anonymous merely because the identifier is random.

The website also uses account-session cookies and local browser storage for features such as reading preferences, transcript timing preferences and phone connection details. Personal notes and saved passages in the congregation page's notebook are kept in that browser's storage. Writing in that notebook does not itself upload those notes to the church's cloud service. If you use Share or Download, you create or send a separate copy. The desktop keeps settings, guide progress and other local application state on its computer.

You can clear cookies and local storage through your browser. This can sign you out, reset preferences, remove your notebook or disconnect a saved phone session. Other people who can use the same browser profile may also be able to open information stored there. Clearing browser data does not delete records already stored by the service or copies you have downloaded or shared.

## Phones, remote controls and integrations

Phone microphone pairing exchanges the phone/computer names, identifiers and connection details through Supabase signaling. WebRTC connection setup also uses a Google STUN service. After pairing and desktop approval, microphone audio is sent to the desktop and processed by its selected speech engine; transcript snippets and scripture references can be sent back to the phone.

The separate phone presentation remote connects to the running desktop and uses pairing approval and a saved device token. An approved remote can receive meaningful service information, including preview/live content, lyrics, scripture suggestions and service order, and perform supported control actions. The desktop's remote controls allow paired access to be revoked.

Online searches and downloads contact the relevant provider. Depending on the feature used, these can include Pixabay, Pexels, YouTube, LRCLIB and YouVersion, as well as model/runtime download hosts. Requests can include searches, selected content, a configured provider key and ordinary network/request information.

Opening an embedded church stream connects you to its video provider, such as YouTube or Facebook. Giving links can take you to a church's chosen payment provider. Those providers handle information under their own arrangements; opening a giving link is separate from processing a donation through Trilorah.

## How information is used and shared

The flows above support account access, service preparation and presentation, speech recognition, scripture suggestions, sharing with a congregation, requested note generation, paired-device operation, attendance information, user corrections and support.

Information can be available to the church team managing its account or computer, the audience for content made public, approved remote devices and the providers needed for the selected feature. Material you export or send to someone else creates a separate copy under the recipient's control.

## Where information is stored and how long it is kept

Trilorah stores application settings, selected content, preacher-learning records, saved device information and other local files on the presentation computer. User-saved service packages and exported notes remain at the locations chosen by the user and can contain sermon or preacher information, depending on the selected export.

Pending cloud writes can be kept in a local upload queue and retried when a connection is available. Cloud records, provider records, local records, exports and backups have separate lifetimes. A limit on which records a view retrieves does not establish when the underlying records are erased.

## Your controls and requests

You can choose audio inputs and supported providers, stop listening, manage sharing using the available controls, and revoke a paired presentation remote. Check the complete setup when deciding whether a service should use online features; selecting local speech alone does not disable every network-connected feature.

Depending on your location and applicable law, you may have rights to request access, correction, deletion or a copy of personal information, and other rights or choices concerning particular uses. Use our [privacy contact](../support/SUPPORT-PAGE.draft.md#questions-about-your-data) to make a request or ask about your information. We may need to verify your identity or authority before taking action. You do not need to send a password or API key with a request.

A request can involve information controlled by your church or another provider as well as information handled by Trilorah. Removing a preacher profile, signing out, ending a service or uninstalling the desktop application does not automatically erase all related local, exported, cloud and provider copies.

## Keeping this policy current

When our practices change, we will update this policy and its effective date. Where applicable law requires additional notice or a choice before a new use, we will provide it.

For product help, use our [support contact](../support/SUPPORT-PAGE.draft.md#contact-support).
