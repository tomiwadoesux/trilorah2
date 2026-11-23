# Shipped recipes

Recipes we write for the apps churches already use, so most churches never see
a teaching step. One JSON file per app, in the format of `../schema.ts`,
recorded with the four-question teacher (`controller/cli/teach.ts`) against
the real app and then trimmed by hand.

Recorded at the owner's Windows PC on 2026-11-23, each verified with
`verify` and run through `perform` against the real app:

| File | App | Abilities | Notes |
| --- | --- | --- | --- |
| `easyworship.json` | EasyWorship 7.4.2.12 | findVerse, findSong, show, clear | No next/previous: its live arrows are a drawn panel that ignores synthetic clicks (a real mouse works). Enter in its scripture box would send the verse live, so the recipe types without Enter — Preview updates as you type. Candidate fix: its Remote TCP protocol (`nextSlide`/`prevSlide`, mDNS `ezwremote`, paired once in EW). |
| `zionworx.json` | ZionWorx 4.1.1 | findSong, show, clear, next, previous | Its controls carry no names, so every step is a path + window class. Show is "add to playlist and present immediately", so the song search only filters the list (no separate preview). Next/previous exist only while something is presented, so verify reports them missing on an idle ZionWorx. No findVerse: the Bibles tab is not exposed to UI Automation. The curtain (clear) could not be watched working on a PC with no screen display. |
| `pewbeam.json` | Pewbeam 2.8.3 | findVerse, show, clear | A web-style app with good accessibility names. Typing a reference and Enter previews the verse; Escape then Enter puts it on the output; CLEAR takes it off (that button's name flips to "Show scripture again" while clear, so verify reports it missing then). No next/previous: its own API and OSC list `next`/`prev` as "still being wired through", and its Previous/Next buttons step the queue, not the chapter. No findSong: the Songs tab was not exposed to UI Automation on this PC. Its HTTP API (port 8080: /api/status, /api/health, /api/control) reports state but cannot pick a verse. |
| `mediashout.json` | MediaShout 7.7.1 | findVerse, show, clear, next, previous | A verse goes through its Bibles panel: open it (a real click — the toolbar button answers an accessibility press and opens nothing), type the reference, Insert Bible (adds the verse to the script as the selected cue), close the panel; show is Fire selected page. Each verse therefore adds a cue to the script. No findSong yet: its Lyrics panel closed itself when Enter was pressed in the song search, before Insert Lyrics could be read. MediaShout froze outright once on the sample script; a new blank script behaved. The trial's Activation Wizard appears on every launch. |
| `proclaim.json` | Proclaim 4.22 | show, clear, next, previous | Proclaim presents an order of service, not a search: ON AIR goes live from the selected item (and OFF air if pressed again), arrows step, the Blank quick screen clears. No findVerse/findSong: a verse is added as an item (Ctrl+Shift+O, On-Screen Bible, type the reference) in an editor whose controls carry no names or ids, so there is no steady cue to type into yet. On a one-monitor PC its full-screen output covers the window, so Blank could not be watched working. |

ProPresenter and OpenLP need no recipe: both have an API, and
`controller/propresenter` and `controller/openlp` drive them through it
(door 1). Each appears under **screen** by itself whenever its API answers.
(OpenLP's UI Automation was tried first: every lookup took 40–80 s on an
ordinary laptop and its tree went dark for minutes at a time; its API on port
4316 answered in milliseconds.)

Still to record: MediaShout, Proclaim, Presenter (WorshipTools), ZionWorx, Pewbeam, PowerPoint.

A taught recipe for the same app in Trilorah's data folder wins over the
shipped one — the church's own screen beats our guess about it.
