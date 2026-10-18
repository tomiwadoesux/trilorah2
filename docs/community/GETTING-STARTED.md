# Get ready for your first service

Rehearse a small service before using Trilorah in front of the congregation. Use the computer, screen and sound feed intended for the service, with time to correct anything that does not behave as expected.

## 1. Choose and install the desktop app

The [website's download configuration](../../web/src/app/download/release.ts) currently points to [release v0.4.8](https://github.com/tomiwadoesux/trilorah2/releases/tag/v0.4.8). Open that release and check its actual assets and release notes before downloading.

| Computer | Installer named in the current configuration |
| --- | --- |
| Mac with Apple silicon | `Trilorah-0.4.8-arm64.dmg` |
| Windows PC with an x64 processor | `Trilorah.Setup.0.4.8.exe` |

There is no Intel Mac, Windows ARM or Linux installer listed in that configuration. Minimum operating-system versions and hardware requirements have not been verified in this guide. An installer name alone does not establish compatibility with your computer.

On a compatible Mac, open the DMG and copy Trilorah to Applications. On Windows, run the installer from the release. Open Trilorah after installation. Keep your existing presentation arrangement available until this computer has completed a rehearsal.

The current Mac build configuration is unsigned, so macOS may block it on first launch. Confirm that the file came from the intended release, then follow the operating system's per-app approval flow if you choose to proceed. If installation fails, keep the exact message and use [support](../support/SUPPORT-PAGE.draft.md). Do not turn off system-wide security controls to make an installer run.

## 2. Connect and check the screen

Connect the projector or TV, select its correct hardware input, and confirm that your operating system recognises it.

In Trilorah, open **Dashboard → Outputs**. Give the intended output a **job**, such as projector, and choose the physical **display** it should use. A named display makes the destination explicit. **No screen — off** disables that output.

Prepare a recognisable test item and send it live. Look at the physical screen: check the destination, the image edges and whether the words can be read from the back of the room. A correct laptop preview does not check the projector's input or cable.

## 3. Make a short practice service

Use the plus beside **run of show** to open **Add a section**. Create a welcome section, worship, scripture and closing. Open a section and choose **Add items** to add prepared content.

For this rehearsal, use a short welcome slide, one song you have checked, one Bible passage and a closing slide. Open each item and inspect its content. Play any essential video before the service. Imported or online material still needs checking.

Use **Notes → Add note** for an operator cue, such as “Start the song after the welcome.” Notes are for the operator; use a presentation slide for words the room needs to read.

## 4. Learn what changes the screen

Preview an item, then choose **go live** to present it. Practice moving to the next lyric section or slide and returning to the previous one.

Some shortcuts send content directly: double-clicking a verse row or pressing Enter on it sends it live; Enter in the scripture reference field also sends the resolved passage live. Phrase-search selections can send a passage live too. Practice these while the room is available for testing.

Newly recognised spoken references and quotations arrive as suggestions rather than being sent live by the recognition delivery gate. Check the passage before presenting it. **Auto advance** is separate: when enabled, it follows speech through scripture already live and can advance to the next verse in that chapter. Configured voice commands are another route to output changes. Leave optional automatic controls off until you have rehearsed their behaviour.

## 5. Add listening if you need it

You can prepare and run the practice content before testing recognition. For listening, connect the microphone or soundboard interface and open **Audio** beneath preview to choose its input. Allow microphone access when the operating system asks.

In **Settings → Audio & speech**, check the selected speech engine:

- **whisper-local** transcribes on the computer. First use can download a speech model; Windows x64 may also need its one-time speech-engine download. Prepare this before an internet-free rehearsal.
- **deepgram** uses an external cloud speech service and needs its working configuration and internet connection. Its keys are managed on the same settings page. Provider availability and charges are separate from the source licence.

Choose **Start listening** and say a fresh sentence: “This is our microphone check. We will read John chapter three, verse sixteen.” Check both the moving audio level and newly transcribed words. Existing transcript text does not prove the selected input works now.

If you see no audio level, check the device, permissions and soundboard feed. If the level moves but no new words appear, read the speech engine's status and any download or provider error. Stop listening when the test is finished.

Local speech is one part of the setup. Starting listening can also initialise cloud service sharing when cloud is configured. The current notes implementation can send transcript text to its cloud provider even when a “local” notes option is selected. Do not rely on those labels as a whole-service offline or privacy guarantee; confirm the data flows for your intended setup before using real sermon material.

## 6. Save the service and check the handoff

1. Open the **.tri** file controls beside the run of service.
2. Choose **save**, name the package and review the included content.
3. Choose **save .tri**, finish the file dialog and check the result and warnings.

After the first save, run and layout edits can autosave to the active file. **change included content…** lets you add resources beyond the existing selection. **save as…** creates a separate service file.

On another computer, choose **.tri → open service** to continue the saved service. **import content** copies selected items into the current work; any selected run is appended. Read replacement and import confirmations before proceeding.

A `.tri` file can carry selected resources and embedded local media. Remote web addresses remain links. The receiving computer still needs its own screen assignments, audio devices and any provider setup. Open the service there, play important media and complete the same rehearsal.

You are ready for a service when you can follow the short run, change the screen deliberately, recover from a missed suggestion and reopen the saved work. Continue with the [longer task guides](README.md#guide-drafts) for any step that needs more attention.

## Source review

Reviewed October 17, 2026 against [release links](../../web/src/app/download/release.ts), [packaging](../../electron-builder.yml), [outputs](../../src/design/screens/dashboard/outputs/fromEngine.ts), [run controls](../../src/design/screens/run/RunRail.tsx), [.tri controls](../../src/design/screens/run/TriPackageActions.tsx), [speech selection](../../electron/asr/provider.ts), [local speech](../../electron/asr/whisperLocal.ts), [speech runtime preparation](../../electron/asr/offlineRuntime.ts), [screen delivery](../../electron/engine/verseDelivery.ts), [Auto advance](../../src/design/screens/AutoAdvance.tsx), [main-process startup/listening](../../electron/main.ts) and [notes providers](../../electron/llm/notesProvider.ts). This is a source review; installer, hardware and provider walkthroughs remain to be completed.
