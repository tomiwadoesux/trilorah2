---
title: "Why there's no AI in the Sunday loop"
slug: "no-ai-in-the-sunday-loop"
series: "The church that wouldn't switch"
series_order: 5
audience: "Technical team leads and church leaders weighing what an AI-driven tool means for reliability, cost and connectivity"
question: "Does operating our presentation app with Trilorah need the internet or an AI model during the service?"
status: "draft — describes the design and the working-tree implementation; held for release verification"
reviewed_on: "2026-11-10"
task_ids: []
---

# Why there's no AI in the Sunday loop

Trilorah listens to a sermon and finds the scripture in it. That part uses intelligent software; nobody will be surprised. What may surprise you is how much of the rest we have deliberately kept dumb, and why the part that operates another program contains no AI at all on a Sunday.

## Two jobs that should never share a clock

There are two different things going on when Trilorah drives a presentation app.

**Learning** is working out which control is *Go live* in this particular program. That happens once, at sound check, by you clicking it. It takes two minutes and never has to be repeated unless the app changes.

**Operating** is pressing that control at 10:04 while the preacher is still talking. It happens hundreds of times a year and has to work every single time.

Keeping these apart is the whole design. Operating is a replay of what was learned: *press the element called Go Live; type into the field called Search.* No model is consulted, no image is sent anywhere, no server is asked. The operating system answers the question "where is that button?" in a few milliseconds, and the press happens.

## What that buys a church

**Speed.** A verse is on the screen before the preacher finishes the sentence. A model that has to look at a screenshot and think before each click adds a second or two per step, which in a live service is the difference between a tool and a toy.

**It works without the internet.** Churches with no connection, or one that falls over when 300 phones arrive, still get everything. Nothing in the operating loop leaves the computer.

**It costs nothing per press.** Screenshot-driven automation bills you for every click. A replay bills nobody.

**It is explainable.** When something stops working, Trilorah can tell you which named control it could not find, because it was looking for a name, not a pattern of pixels.

## Could an AI help with the learning part?

It could. A model could read the list of an app's controls — which is text, not pictures — and guess which one means *Go live*. We considered it and left it out, at least for now. Clicking the real button yourself is more accurate than a guess, faster than reading a model's proposal, and the failure mode of a wrong guess is a button pressed in someone else's software with a congregation watching. If it ever earns a place, it will be as a helper that highlights "probably this one?" for you to confirm, never as something that acts alone.

## The honest boundary

"No AI in the loop" is a statement about the automation, not a promise about the whole product. The listening is still a speech engine, local or cloud depending on how you set Trilorah up, and recognition is still a judgement with the operator as the final check. What we are promising is narrower and, we think, more useful: the part that touches your projector is a replay of your own clicks, and it will do the same thing at the same speed whether or not the internet is there.
