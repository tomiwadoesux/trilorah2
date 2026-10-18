---
title: "Connect a microphone and check it in Trilorah"
slug: "connect-a-microphone"
audience: "An operator setting up sermon listening"
question: "How do I select the right microphone and confirm that transcription works?"
proposed_publication_date: "2026-03-09"
schedule_note: "Planning date requested for March–July 2026; not a publication record"
status: "draft — source reviewed; microphone hardware walkthrough and visuals pending"
reviewed_on: "2026-10-11"
task_ids: [audio.choose-input, audio.start-stop-listening, audio.troubleshoot, audio.phone-microphone]
---

# Connect a microphone and check it in Trilorah

A microphone check needs two results: sound arriving and new words appearing. The audio level checks the first. The transcript checks the second.

Test with the microphone or soundboard feed you will use during the service. A successful laptop-microphone test says little about a different input at the sound desk.

## 1. Select the input

Connect the microphone or audio interface to the computer. A soundboard feed needs to reach an input device the computer can use.

Open **Audio** beneath preview and select the device. **System default** follows the computer's choice; a named input makes your selection easier to confirm with the sound team.

If the device is missing, check its connection and microphone permissions. Select it once it appears. Changing the hardware input while listening restarts the listening path, so repeat the test after a change.

## 2. Check a sentence you have just spoken

Choose **Start listening** and speak at the level expected during the service. Try: “This is our microphone check. We will read John chapter three, verse sixteen.”

Watch for both results:

1. The audio level moves while you speak.
2. The transcript gains words from that sentence.

Old transcript text does not confirm the current input. Say a different sentence if you need to make the result obvious.

The listening control can change before the speech engine finishes starting. Read any status message. Initial setup may need microphone permission or a local speech model to finish preparing.

## 3. Check where the problem begins

**No audio level:** return to the selected device, permissions, and connection. For a soundboard feed, ask the sound operator to confirm that speech reaches the computer's input.

**Audio level, but no new words:** check the speech engine's status and configuration. A cloud provider needs its valid setup and connection; a local engine needs its model. Give it a complete sentence to process, and keep any error message when asking for help.

**New words, but the wrong words:** test with the actual speaker and audio arrangement. Check what the transcript contains before judging the scripture suggestion that follows it.

## A phone can supply the microphone

Choose **phone (over wi-fi)** in Audio. Keep the phone and computer on the same suitable Wi-Fi network, with internet available to establish the connection.

1. Choose **connect phone** and scan the code.
2. Allow microphone access on the phone.
3. Approve the phone on the desktop with **Allow microphone**.
4. Once connected, select **Use phone audio**.

That final step selects phone audio and starts listening. Pairing alone does not complete the setup. Run the same level-and-transcript check, and keep the phone's microphone page open.

Phone audio supplies sound. The mobile presentation remote is a separate feature.

## Finish with one spoken reference

Say a complete Bible reference and inspect any resulting candidate. Check it before sending it live; recognized speech does not automatically project a verse.

Use **Stop listening** when the test is finished. If a check still fails, continue with [the microphone troubleshooting guide](13-when-trilorah-cannot-hear-you.md).
