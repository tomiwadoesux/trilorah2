---
title: "Some churches won't switch. Fair enough."
slug: "some-churches-wont-switch"
series: "The church that wouldn't switch"
series_order: 1
audience: "Heads of media and technical departments, team leads, and anyone deciding what software a church runs its screens on"
question: "Why is Trilorah learning to work with the software a church already has, instead of asking the church to replace it?"
status: "draft — founder premise supplied November 10, 2026; working-tree implementation, held for release verification"
reviewed_on: "2026-11-10"
task_ids: []
---

# Some churches won't switch. Fair enough.

We built a church presentation workspace and then met the churches. A good number of them liked what Trilorah does with scripture — the preacher says "John three sixteen" and the verse is ready before he finishes the sentence — and had no intention of moving their Sunday off the software they already run. Not next month. Not after a demo. Not for free.

We thought about this for a while and concluded they were right.

## What "switching" actually costs a church

A presentation app is not a file you replace. It is a library of every song the worship team has sung for a decade, with the sections marked the way the drummer expects. It is the muscle memory of three operators who can run a service without looking at the keyboard. It is the pastor's announcements template, the Easter backgrounds, the one setting somebody changed in 2019 that makes the projector behave. Asking a church to switch is asking it to throw that away and rebuild it, during the one week of the year with no service in it. (There is no such week.)

So when a team lead told us "we're an EasyWorship church" or "we've been on ProPresenter for years", that was not resistance to be overcome. It was a sensible person protecting a working Sunday.

## What had to be done instead

If the church will not come to Trilorah, Trilorah has to go to the church. The thing people wanted was the listening — the scripture caught from speech, staged, ready to send. They did not want a second program on the screen. They wanted that verse to appear in *their* program.

That meant teaching Trilorah to operate other software. Not replace it. Operate it: find the verse in the app the church already uses, put it up, take it down, step through, the way an operator would — with the operator still deciding when.

We are building exactly that. The first thing to say about it is the honest thing: in our current build it works, and it works on ordinary desktop applications we test with; it has not yet been run against EasyWorship itself, which only exists on Windows, and we will say so plainly the day it has. The rest of this series explains how it works, what it refuses to do, and what "ready" means before we let it anywhere near a service.

## The rule that doesn't move

One thing stayed fixed through all of this. Trilorah never puts anything on a screen by itself. A caught verse waits in the preview until someone presses Go live. That was true on our own screens; it is true when the screen belongs to someone else's software, and if anything it matters more there. Nobody should discover on a Sunday morning that an AI has opinions about their projector.

The next piece is about the three ways a program can control another program, and why we chose the boring one.
