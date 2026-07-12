# Church Presentation Software Advanced Features Plan

## Overview

This software aims to be an advanced church presentation tool (superior to EasyWorship) with a modern UI. Previous AI agent extracted state into Zustand stores and separated UI components, but stopped before replacing the 3447-line `App.tsx` monolith with the new architecture.

## Requirements

### 1. Refactor App.tsx to Thin Shell (Prerequisite)

- Provide TabDeck for navigation.
- Implement Sidebar.
- Clean up `App.tsx` down to ~150 lines, connecting existing extracted components (`SongsTab`, `ScripturesTab`, `ThemesTab`, `PresentationsTab`).

### 2. Multiple Outputs Support

- **Three output options**, each taking the same content but capable of different themes.
- **Alternate Output** designed specifically for livestreaming / in-house display.
- Independent electron windows rendered with sync from Zustand stores via IPC.

### 3. Streaming Integration

- Output alpha channel downstream to a video mixer.
- Integration with streaming platforms (vMix, OBS, Wirecast) via WebSockets/OBS-websocket.
- NDI support (wirelessly to another computer) and generic capture cards (Blackmagic, Magewell, Aja).
- Phone camera input (WebRTC).

### 4. Create and Edit Slides (Presentation & Theme Editor)

- Robust Shape Engine and Inspector for text editing.
- Built on Fabric.js (HTML5 Canvas).
- Manage basic shapes, text styling, layouts, layers (z-order).

### 5. Mini Video Editor

- Built-in capability for trimming added video files.
- FFMPEG.wasm based implementation to run directly in the app.

### 6. MIDI Sync & Integration

- Sync/control multiple application instances using MIDI In & Out.
- Integrate with Loop Community Prime, Multitracks Playback App, and Ableton Live.

### 7. Stream Deck & Companion Plugins

- Expose WebSocket API or HTTP API.
- Support external control from Elgato Stream Deck and Bitfocus Companion.

---

## Action Plan & Steps

### Step 1: Complete the "Thin Shell" Refactor (App.tsx -> TabDeck)

- [x] Create `src/components/layout/Sidebar.tsx` and `src/components/layout/TabDeck.tsx`.
- [x] Rewrite `src/App.tsx` resolving state using `appStore`, `scriptureStore`, etc., and keeping only essential effects (Whisper, Service Timer, IPC).

### Step 2: Install Required Dependencies

- [x] Slide Editor: `npm install fabric`
- [x] Video Editor: `npm install @ffmpeg/ffmpeg @ffmpeg/util`
- [x] MIDI: `npm install easymidi` (or `webmidi` if run in renderer, but `easymidi` on main process is better for sync). Let's just use the native Web MIDI API in the browser/renderer.
- [x] OBS Integration: `npm install obs-websocket-js`
- [x] Streamdeck/Companion Control: `npm install ws` (for local socket server in main process).

### Step 3: Implement Slide Editor

- [x] Set up Fabric canvas within `SlideEditorTab.tsx`.
- [x] Build Inspector Panel for text styling and Shape Engine (Add Rect, Circle, Text).
- [x] Store slide models via `slideEditorStore.ts`.

### Step 4: Implement Mini Video Editor

- [x] Set up FFMPEG.wasm in `VideoEditorTab.tsx`.
- [x] Create timeline component with drag-handles for trimming in/out.

### Step 5: Implement Multiple Outputs & Streaming Setup

- [x] In main process, support spawning 3 unique output windows (Main, Alternate, Third).
- [x] Transparent backgrounds in electron to support Alpha channel logic for OBS.
- [x] In renderer, build generic Output renderer that loads the active theme overlaid on green/transparent backgrounds.

### Step 6: Implement MIDI and Streamdeck/Companion API

- [x] Add `LocalServer.ts` module in the Main Process to accept WebSocket connections for Stream Deck/Companion.
- [x] Add `MidiSync.ts` in renderer using Web MIDI API to listen to commands mapping to next slide / previous slide.
