---
title: "Trilorah FAQ"
status: "draft — source-reviewed; release and publication checks remain"
reviewed_on: "2026-10-17"
audience: "Church volunteers preparing and running services"
editorial_record: "FAQ-evidence.md"
---

# Before your first service

<!-- F01 -->
## Can we use our existing computer, sound system and screens?

Your computer needs to run a supported Trilorah build, recognise the connected display and receive the microphone or soundboard feed you want Trilorah to hear. Assign the screen in **Dashboard → Outputs**, then select the sound input in **Audio**. Test the actual projector and sound feed before your first service; a laptop preview cannot check a cable or the soundboard routing. Follow the [setup and rehearsal guide](../../community/GETTING-STARTED.md).

<!-- F02 -->
## What works without internet?

You can present prepared songs, locally stored slides and media, and the Bible texts installed on your computer. Local Whisper can transcribe after its speech model and any required runtime have been downloaded. Cloud speech, generated notes, online content searches and the public congregation page need internet access. A saved web link does not turn an online video into an offline file.

<!-- F03 -->
## Do we need separate accounts or API keys for AI features?

Local Whisper transcribes on your computer without a speech-provider account or API key. Deepgram cloud speech and generated sermon notes require working access to their respective providers, which can carry separate charges. The source licence does not include a cloud-service allowance or a support plan. The [setup guide](../../community/GETTING-STARTED.md#5-add-listening-if-you-need-it) explains the speech options.

<!-- F04 -->
## Can we bring our existing songs, presentations and media?

Trilorah imports song files in ChordPro, OpenLyrics XML and plain text, as well as supported images and videos. PowerPoint and OpenDocument presentations become static slide images using LibreOffice and Poppler; animations and editable slide objects do not carry over. Imports from EasyWorship and ProPresenter can bring across supported content, with different limits for each format—EasyWorship service order and layouts need rebuilding, for example. Review the import warnings and rehearse the result before presenting it; see the [song guide](../articles/07-prepare-song-lyrics.md) and [slide guide](../articles/10-create-announcements-and-import-slides.md).

<!-- F05 -->
## Can Trilorah find a passage when the preacher quotes it without naming the reference?

Yes, when the transcribed words give the matchers enough evidence, Trilorah can suggest a scripture from the quotation. It can also look for passages from a remembered phrase, person or event. Short, common phrases, paraphrases, unclear audio and wording outside the indexed material can produce no match or more than one plausible result. Check the suggestion before sending it live; the [recognition guide](../articles/04-how-scripture-recognition-works.md) explains the process.

<!-- F06 -->
## Which Bible translations and spoken languages can we use?

Check the Bible picker in your installed app for the translations available in that build; online translations also depend on the build's provider access and connection. The recognition engine has language packs for English, Spanish, French, Portuguese, Hindi and Chinese, while the speech transcriber has its own language setting and model requirements. A language pack does not mean every quotation matcher supports that language equally, and the interface is currently in English. Rehearse the combination of speaker, speech engine, language and Bible translation you intend to use.

<!-- F07 -->
## What goes on screen automatically, and what do we control?

Newly caught spoken references and quotations are suggestions; recognising one does not send it live. You control what you present, but some actions send immediately: double-clicking or pressing Enter on a verse row, submitting a complete scripture reference, and choosing a phrase-search result. Separately, opt-in **Auto advance** can follow speech through scripture already live and move to the next verse in the same chapter; it is disabled each time you launch Trilorah. Configured voice commands can also change the output, so rehearse those controls before enabling them during a service.

<!-- F08 -->
## Can we still find and show a verse if recognition misses it?

Yes. Type the reference or search using the words you remember, then check the passage you find. A single click on a verse row previews it; double-clicking or pressing Enter on the row sends it live, and selecting a phrase-search result also sends it live. Use the [manual scripture search guide](../articles/09-find-scripture-from-a-phrase.md) to practise that fallback before you need it.

<!-- F09 -->
## Can one volunteer prepare at home and another run the service?

Yes—save a **.tri** service package, review what it includes, and open it on the service computer with **.tri → open service**. Selected local resources can travel in the package, while remote web addresses remain links. The receiving computer still needs its own screen assignments, audio devices and provider setup. Open the file there, check any warnings and play important media before the service; see the [save and transfer guide](../../community/GETTING-STARTED.md#6-save-the-service-and-check-the-handoff).

<!-- F10 -->
## Can we control the service from a phone?

Yes, through the mobile remote while Trilorah is running on the desktop computer. Connect the phone to the same reachable local network, open the displayed link or QR code, enter the pairing code and approve the phone on the desktop. The paired phone can select supported content, send it live and move through scripture, lyric cards or slides; you can revoke its access from the desktop. Guest-network isolation or firewall rules can prevent a connection; the [phone-control guide](../future-features/17-mobile-remote.md) covers pairing and limits.

<!-- F11 -->
## Where do the audio and transcript go?

Local Whisper transcribes on your computer; selecting Deepgram streams audio to Deepgram, and generated notes currently use a cloud provider even if the notes option says “local.” If cloud is configured and you're signed in, starting listening can also start a public service and upload transcript text. Switching off public visibility or transcript display does not by itself stop all uploads for an active cloud service. Saved exports can contain sermon text and notes too, so review your setup and the [Privacy Policy](../../legal/PRIVACY-POLICY.draft.md) before using sensitive material.

<!-- F12 -->
## Can our church customise Trilorah?

Yes. The current original source uses PolyForm Perimeter 1.0.1, which permits church use and internal customisation while restricting providing a competing product to others—even for free. Trilorah is source-available; the licence does not grant unrestricted rights to publish a competing version. Read the [licence and scope notes](../../legal/LICENSING.md), including the separate terms for third-party software and content, before redistributing it.

# Downloads

<!-- D01 -->
## What should we set up after installing?

Connect and assign a display, prepare a short service, and practise changing what is live. If you want scripture recognition, choose the sound input and speech engine, finish any required downloads and check that fresh words appear when you speak. Save the rehearsal as a **.tri** file and reopen it. The [first-service guide](../../community/GETTING-STARTED.md) takes you through those checks.

<!-- D02 -->
## Can we install it on a home computer and a church computer?

Yes, for your church's use under the current source licence. Use a compatible build on each computer and transfer the prepared service with a **.tri** package. Devices, screen assignments and provider settings need checking separately on each machine. See the [handoff steps](../../community/GETTING-STARTED.md#6-save-the-service-and-check-the-handoff).

<!-- D03 -->
## What if the installer will not open?

Check that the installer matches your computer and came from the intended release, then keep the exact error message. An unsigned Mac build may need approval through macOS's per-app security controls; do not turn off system-wide security protections. If the message says the file is damaged, incompatible or blocked for another reason, diagnose that message before proceeding. The [installation guide](../../community/GETTING-STARTED.md#1-choose-and-install-the-desktop-app) explains the current installer choices.

<!-- D04 -->
## Will an update keep our songs and prepared services?

Save your current service and keep a separate copy of the **.tri** file before updating. A service package contains the content you selected; it is not a complete backup of every library item, account or computer setting. Read the release notes, reopen the saved service after updating and rehearse the screen, sound and media you depend on. If you need more resources in the package, use **change included content…** before saving it.

<!-- D05 -->
## How do we move to a replacement computer?

On the old computer, save the service as a **.tri** package and include the resources you need. Install a compatible Trilorah build on the replacement, choose **.tri → open service**, and check the imported result. Set up that computer's displays, sound input and providers, then test any linked online content and essential media. Follow the [transfer and rehearsal steps](../../community/GETTING-STARTED.md#6-save-the-service-and-check-the-handoff) before retiring the old setup.
