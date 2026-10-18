# Trilorah community documentation

Start with one small service: a welcome slide, a song, a Bible passage and a closing slide. Check them on the screen the congregation will actually see, then save the service for the next operator.

| You want to… | Start here |
| --- | --- |
| Install the desktop app and rehearse a service | [Getting started](GETTING-STARTED.md) |
| Run or build the desktop app from source | [Build from source](BUILD-FROM-SOURCE.md) |
| Find a longer explanation of a task | [Guide drafts](#guide-drafts) |
| Report a problem | [Support information draft](../support/SUPPORT-PAGE.draft.md) |
| Understand source reuse and the licence decision | [Licensing status](../legal/LICENSING.md) |

## What this covers

Trilorah is a desktop application for preparing and presenting songs, scripture, slides, media and a service order. Scripture recognition can suggest passages while someone speaks. The operator still needs to check the suggestion and choose what goes live. Separately enabled **Auto advance** can follow reading through scripture already live; configured voice commands can also change the output.

The desktop app keeps running while a paired phone remote controls it. A phone microphone is a separate connection and has different setup requirements.

Original Trilorah source code is available under [PolyForm Perimeter 1.0.1](../../LICENSE). It permits church use and internal customisation while restricting providing competing products to others, including free competing versions. Read the [licensing scope](../legal/LICENSING.md) and [NOTICE](../../NOTICE); third-party material retains its own terms, and valid earlier grants are not revoked. An optional Trilorah-operated paid service remains for a later decision. A paid plan, its inclusions and its prices have not been announced here.

## A practical reading order

1. Complete [Getting started](GETTING-STARTED.md) on the presentation computer.
2. Rehearse with the actual display and, if you need recognition, the actual sound feed.
3. Save a `.tri` service and open it on the receiving computer if another person will operate it.
4. Read the task guide for the part that needs more setup.

Using local speech does not mean the whole service stays offline or on the computer. Cloud sharing, online Bible chapters, online searches, phone audio and generated sermon notes have their own connections and data flows. Choose and test the features you intend to use; do not treat an offline speech selection as a global privacy switch.

## Guide drafts

These longer articles are source-reviewed editorial drafts, not a record that every step has been demonstrated in the current installer. They are useful explanations; follow current on-screen labels where an older draft differs.

| Task | Draft |
| --- | --- |
| Rehearse a first service | [First-service checklist](../content-launch/articles/02-first-service-checklist.md) |
| Set up audio and transcription | [Connect a microphone](../content-launch/articles/03-connect-a-microphone.md) |
| Understand scripture suggestions | [How recognition works](../content-launch/articles/04-how-scripture-recognition-works.md) |
| Assign a projector or other screen | [Connect the right screens](../content-launch/articles/05-connect-the-right-screens.md) |
| Prepare the run of service | [Build an order of service](../content-launch/articles/06-build-an-order-of-service.md) |
| Prepare lyrics | [Prepare song lyrics](../content-launch/articles/07-prepare-song-lyrics.md) |
| Prepare media | [Use images and videos](../content-launch/articles/08-use-images-and-videos.md) |
| Create slides or import a presentation | [Announcements and presentation import](../content-launch/articles/10-create-announcements-and-import-slides.md) |
| Move a service to another computer | [Save and transfer](../content-launch/articles/11-save-and-transfer-a-service.md) |
| Diagnose listening problems | [Audio troubleshooting](../content-launch/articles/13-when-trilorah-cannot-hear-you.md) |

The in-app Messenger and website guide use shared short lessons from the [product map](../product-guide/README.md). The articles above are not automatically published to the website.

## Documentation status

Reviewed against the working tree on **October 17, 2026**; `package.json` reports version **0.4.8**. The download configuration points to v0.4.8 assets, but this documentation pass did not download or launch them. Source implementation can differ from a packaged release.

No installation, microphone, physical display, paired-phone or cloud-service walkthrough was run for this documentation. Report the app version and the step that differs when requesting help.
