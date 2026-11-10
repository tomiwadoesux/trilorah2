---
title: "EasyWorship first. Here's exactly where that stands."
slug: "easyworship-first"
series: "The church that wouldn't switch"
series_order: 6
audience: "Churches running EasyWorship, ProPresenter or similar who want to know what Trilorah can do with their software today, and what is still a plan"
question: "Can Trilorah operate EasyWorship right now, and what will we be able to see and when?"
status: "draft — status report; update before publication with the result of the Windows session and the first shipped recipe"
reviewed_on: "2026-11-10"
task_ids: []
---

# EasyWorship first. Here's exactly where that stands.

This series has explained why Trilorah is learning to operate the presentation software a church already runs, how it does it, and what it refuses to do. This last piece is the one that matters if you are the person who has to decide whether to try it: a plain account of what is proven, what is built but unproven, and what does not exist yet.

## Proven

In our current build, Trilorah can read the controls of a running application, find one by name, press it, type into it, and check afterwards that the app did what was asked. The teaching flow — five questions, five clicks — produces a saved map of an app, verifies it without pressing anything, and lets you switch the console's Go live, Clear, Next and Previous onto that app.

We have demonstrated the whole chain end to end on a plain text editor used as a stand-in: a reference typed into its document, its buttons pressed, its state read back. We chose a stand-in because it is on every Mac and cannot put anything on a projector; it is a demonstration of the mechanism, not of a church's Sunday.

## Built, not yet proven

The Windows side. EasyWorship exists only on Windows, so the Windows version of the control tool is written — the same commands, over Windows' built-in accessibility interface, with nothing for a church to install — and has not yet been run on a Windows machine. We expect the first session with it to produce a round of fixes. That is normal for code that has never met its platform, and we would rather say so than pretend.

## Does not exist yet

An EasyWorship recipe. Nobody has sat at EasyWorship and answered the five questions, so there is no shipped map for it. The same is true of ProPresenter, MediaShout, OpenLP and PowerPoint. The plan is that we record these ourselves and ship them inside Trilorah, so a church with EasyWorship installed sees it appear under **screen** with no teaching step. The plan is not the product; until a recipe is recorded and has survived a sound check, EasyWorship is on the list, not in the box.

## The risk we will tell you about either way

Some older applications draw their own controls in a way the operating system cannot describe, which would leave the accessibility door unable to see a particular button. If EasyWorship turns out to be one of those for some control, the fallback is its keyboard shortcuts, which the tool can send, and the honest answer may be "these three abilities work and this one needs a shortcut." We will know within the first few minutes of the Windows session, and we will publish what we find.

## What to do if you run one of these apps

Nothing, yet. Keep running your service the way you do. When there is a recorded recipe for your app that has passed a sound check, this page will say so, with the version it was recorded against and what it was able to do. If you would like to be the church it is first tested with, we would like to hear from you — a real EasyWorship machine and a team lead with twenty minutes is precisely what the next step needs.

We started this because some churches would not switch, and they were right not to. The least we can do is tell them exactly what works before we ask them to try it.
