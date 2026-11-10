---
title: "Three ways software can control other software. We picked the boring one."
slug: "three-ways-to-control-another-app"
series: "The church that wouldn't switch"
series_order: 2
audience: "Technical team leads and anyone curious how Trilorah can operate a presentation app it was never designed for"
question: "How does Trilorah press buttons in another program, and why did we choose the accessibility tree over an AI that looks at the screen?"
status: "draft — working-tree implementation tested on macOS desktop apps; Windows and EasyWorship untested; held for release verification"
reviewed_on: "2026-11-10"
task_ids: []
---

# Three ways software can control other software. We picked the boring one.

When we decided Trilorah had to operate the presentation software a church already owns, the first question was mechanical. How does one program press a button in another? There are three doors, and the choice between them decides whether the thing works on a Sunday or only in a demo.

## Door one: the app offers its functions

Some apps publish a list of things other software may ask them to do — "show slide 12", "search songs for *amazing*". ProPresenter, OBS and vMix have something like this. It is the best door when it exists: reliable, fast, and the app's own idea of what it can do.

The catch is the word *when*. EasyWorship does not have one. Neither do most of the apps churches actually run. A door that only a few apps install is not a plan for the rest.

## Door three: an AI looks at the screen and clicks

The fashionable option. Take a screenshot, ask a model where the Go live button is, click there, repeat. It works on anything, which is its whole appeal.

It is also slow — a model has to look and think before every click — it costs money per click, it needs the internet, and it breaks the moment someone drags the window two inches to the left. A church volunteer will drag the window. We keep this door as a parachute for the rare control nothing else can reach, and never as the way the service runs.

## Door two: the accessibility tree

Every operating system already describes every running program's interface as a structured list: each window, button, menu and text field, with its name, its state and the actions it accepts. The list exists so screen readers can work. It means a program can ask "what buttons does this app have right now?" and get an answer like *Go live — a button — enabled — can be pressed*, then press it by name.

No screenshots. No guessing. No model. No internet. Tens of milliseconds. And nothing is asked of the other app; the operating system is the one answering.

That is the door we chose. It is the least glamorous of the three and the only one that behaves the same at 10:04 on a Sunday as it did at the Saturday sound check.

## What this looks like in practice

In our current build, Trilorah can read an application's controls — a few thousand elements of a busy app in about a second — find a control by name, and press it. Pointed at a plain text editor as a stand-in, it typed a reference into the document, pressed the bold button, pressed align-centre, and read back from the editor that each one had happened. The same commands the Trilorah console and remote already use, landing in someone else's program.

Door one still gets used wherever an app offers it. Door two is the floor under everything. Door three waits in the cupboard.

The next piece is about the part that makes this safe to hand to a church: how Trilorah learns which button is which, and why no AI is involved in that on a Sunday either.
