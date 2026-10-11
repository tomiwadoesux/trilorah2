---
title: "Connect a microphone to Trilorah and check that it hears you"
slug: "connect-a-microphone"
audience: "An operator setting up sermon listening"
question: "How do I select the right microphone and confirm that transcription works?"
proposed_publication_date: "2026-03-09"
schedule_note: "Planning date requested for March–July 2026; not a publication record"
status: "draft — source reviewed; microphone hardware walkthrough and visuals pending"
reviewed_on: "2026-10-10"
task_ids: [audio.choose-input, audio.start-stop-listening, audio.troubleshoot, audio.phone-microphone]
---

# Connect a microphone to Trilorah and check that it hears you

Trilorah needs a usable audio source before it can recognize spoken scripture. Start by checking the input, then check the words. A moving audio level proves that sound is arriving; a new transcript shows that the speech engine is processing it.

Make this check in the room where you will use the app, with the microphone or soundboard feed you intend to use during the service.

## Choose the input

Connect the microphone or audio interface to the computer. If you are using a soundboard feed, the computer needs an audio device that exposes that feed as an input.

In the operator workspace, open **Audio** beneath the preview. Choose your input from the devices the computer reports. You can use the system default, but selecting a named device makes the choice easier to check with another volunteer.

If the device is missing, check its connection and the computer's microphone permissions. A label in Trilorah cannot make disconnected hardware available.

Changing the selected hardware input while listening restarts the listening path. Make that change before the sermon when possible, then run the check again.

## Start listening and say something specific

Select **Start listening** and say a short sentence at the level you expect during the service. For example: “This is our microphone check. We will read John chapter three, verse sixteen.”

Watch for two separate results:

1. The audio level responds while you speak.
2. New transcript words appear from the sentence you just said.

Do not use old transcript text as evidence that the current input works. Repeat a different sentence if you are unsure.

The listening control may change before the engine has finished starting. Initial setup can also require a microphone permission or preparation of a local speech model. Read any status or error message instead of repeatedly pressing the button.

## Sound is arriving, but no words appear

This points to the speech stage of the process rather than proving the input is wrong. Check the engine status and the selected speech configuration. A cloud speech provider needs its own valid configuration and connection; a local engine needs its model to be available.

Give the selected engine time to process a complete sentence. If it reports an error, keep the wording of that error when asking for help. “There is a level but no transcript” is more useful than “The microphone does not work.”

## Using a phone instead

The Audio menu also offers **phone (over wi-fi)**. The phone and computer must be on a suitable shared Wi-Fi network, with internet available to establish the connection.

Choose **connect phone**, scan the code, allow the phone's microphone, and approve the request on the desktop. After connection, choose **use phone audio**. Pairing the phone and selecting it as the listening input are separate steps.

Run the same level-and-transcript check. The phone microphone sends audio; it is a different feature from the phone remote that controls presentation actions.

## Finish the check

Once you can see new words, check one complete spoken Bible reference. Review any suggested passage before sending it live. Recognition does not automatically put the verse on the screen.

Use **Stop listening** when you have finished the test. If the result is still unclear, follow [the microphone troubleshooting guide](13-when-trilorah-cannot-hear-you.md).
