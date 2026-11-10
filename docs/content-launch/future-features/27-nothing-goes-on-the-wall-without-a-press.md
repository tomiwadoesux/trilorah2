---
title: "Nothing goes on the wall without a press. Even on someone else's software."
slug: "nothing-on-the-wall-without-a-press"
series: "The church that wouldn't switch"
series_order: 4
audience: "Team leads and pastors who want to know what an automated system is and is not allowed to do during a service"
question: "If Trilorah can operate our presentation app, what stops it from putting something on the screen we didn't choose?"
status: "draft — describes the implemented control rules in the working tree; held for release verification"
reviewed_on: "2026-11-10"
task_ids: []
---

# Nothing goes on the wall without a press. Even on someone else's software.

The first thing a pastor asks when you describe software that can operate the church's projector is some version of: *what stops it?* It is the right question, and it deserves a precise answer rather than a reassuring one.

## The rule, and where it lives

Trilorah never sends anything to a screen on its own. When the preacher names a passage, Trilorah catches it and stages it in the preview, where it waits. A person presses **Go live**. That has been the rule for Trilorah's own screens from the start, and when Trilorah is operating another app it is enforced in the same place: the one command layer that every button, remote and console goes through. A detection can stage. Only a press can take. There is no setting that changes this, because we did not build one.

## What it will refuse

Automating someone else's software is a good reason to be more careful, not less, so the refusals are explicit and in words:

- **Press with nothing staged.** *"Nothing is staged to take live."* Not a silent success.
- **A button that has moved or been renamed.** Each taught control is remembered by several clues — its name, its type, its place in the app. If an update changes the button, the clues no longer agree and Trilorah stops: *"the go-live button — no control matches any more."* It does not press the thing that is now where the button used to be.
- **A control that is disabled.** *"'Go Live' is disabled right now."* If the app will not let a person press it, Trilorah will not either.
- **Half a sequence.** If a step fails midway, the rest do not run. Half an action in another program is worse than none.

Every one of these arrives as a notice on the operator's screen, saying which step and why, with Trilorah still listening and nothing changed on the projector.

## The check before every service

Before you rely on a taught app, Trilorah looks up every control it knows — without pressing anything — and tells you whether it is still where it was left. The console shows *EasyWorship ✓* or *EasyWorship !*. If one control has moved, you re-teach that one step, about ten seconds, and the fix is saved. Do it at sound check and the service starts with a known-good map.

## What this costs you

A press. Every verse, every clear, every step, is a deliberate human action. Some people will want the computer to just do it. We think a room full of people looking at a wall is exactly the place where a human should be the last thing in the chain, and we have built the software so that it cannot be talked out of that on a Sunday morning.
