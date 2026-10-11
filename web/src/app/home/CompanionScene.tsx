"use client";

import Image from "next/image";
import { useId, useState } from "react";
import { BookOpen, Check, StickyNote } from "@/components/icons";
import operator from "./assets/operator-workspace.png";
import transcript from "./assets/companion-transcript.png";
import verses from "./assets/companion-verses.png";
import notes from "./assets/companion-notes.png";
import give from "./assets/companion-give.png";
import reading from "./assets/companion-reading.png";
import "./companion-scene.css";

// Captures of the shipping interfaces, with an isolated sample service.
// Keeping the capture intact preserves the actual product's typography,
// controls and spacing instead of inventing a second interface for marketing.
const screens = {
  transcript: { image: transcript, label: "Transcript", description: "The live transcript with Psalm 46:10, reading options, and the companion's four bottom tabs." },
  verses: { image: verses, label: "Verses", description: "The companion's scripture list: Psalm 46:10, Psalm 46:1, and John 14:27." },
  notes: { image: notes, label: "Notes", description: "The companion's sermon notes: Be still and know, main points, and an application for the week." },
  give: { image: give, label: "Give", description: "The companion's Give tab before a church has configured its giving methods." },
};
type Screen = keyof typeof screens;

export function CompanionScene() {
  const [screen, setScreen] = useState<Screen>("transcript");
  const id = useId();

  return (
    <figure className="pd-companion-scene pd-actual-scene" aria-label="Trilorah desktop and congregation companion previews">
      <div className="pd-actual-desktop">
        <Image draggable={false} src={operator} alt="The actual Trilorah operator workspace, with run of service, preview, live output, and scripture library." sizes="(max-width: 640px) 850px, 1100px" quality={95} />
      </div>

      <div className="pd-actual-phone">
        <div className="pd-device-status" aria-hidden="true"><span>9:41</span><i /><span>▮▮▮ <b /></span></div>
        <div className="pd-phone-capture" id={`${id}-screen`}>
          {(Object.keys(screens) as Screen[]).map((key) => (
            <Image draggable={false} key={key} src={screens[key].image} alt={key === screen ? screens[key].description : ""} aria-hidden={key !== screen} className={key === screen ? "is-current" : ""} sizes="300px" quality={95} />
          ))}
          <div className="pd-capture-nav" role="group" aria-label="Explore the companion preview">
            {(Object.keys(screens) as Screen[]).map((key) => <button key={key} type="button" aria-label={screens[key].label} aria-pressed={screen === key} aria-controls={`${id}-screen`} onClick={() => setScreen(key)}><span className="pd-sr-only">{screens[key].label}</span></button>)}
          </div>
        </div>
        <div className="pd-device-home" aria-hidden="true" />
      </div>

      <div className="pd-app-details" aria-label="A closer look at the companion">
        <div className="pd-app-fragment pd-reading-fragment" aria-hidden="true"><Image draggable={false} src={reading} alt="" sizes="230px" quality={95} /></div>
        <button className="pd-app-fragment pd-notes-fragment" type="button" aria-label="Show sermon notes in the phone preview" onClick={() => setScreen("notes")}><span className="pd-fragment-crop"><Image draggable={false} src={notes} alt="" sizes="260px" quality={95} /></span><span className="pd-fragment-label">Keep the message close <span aria-hidden="true">↗</span></span></button>
      </div>

      <div className="pd-floating-verse" aria-hidden="true"><span><BookOpen size={14} /> Scripture identified</span><strong>Psalm 46:10</strong><small>Ready for the room.</small><Check size={15} className="pd-floating-check" /></div>
      <div className="pd-floating-note" aria-hidden="true"><StickyNote size={16} /><span>A thought worth keeping.<small>Notes, alongside the message.</small></span></div>
      <figcaption className="pd-capture-caption">Actual Trilorah screens <span aria-hidden="true">·</span> Sample service <span aria-hidden="true">·</span> Try the phone tabs</figcaption>
      <span className="pd-sr-only" role="status">{screens[screen].label} preview selected.</span>
    </figure>
  );
}
