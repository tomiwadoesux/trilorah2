"use client";

import { useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { ArrowRight, BookOpen, Check, ChevronDown, Mic, Plus, Radio, RotateCcw, StickyNote } from "@/components/icons";
import BrandMark from "../live/[slug]/components/BrandMark";
import "./product-demos.css";

const verse = "Be still, and know that I am God.";

function Wordmark() {
  return <span className="pd-wordmark"><BrandMark className="pd-brand-mark" />trilorah</span>;
}

/** An illustrative operator view, using the same concepts as the desktop app. */
export function ProductWorkspace() {
  return (
    <figure className="pd-workspace" aria-label="Trilorah operator workspace preview">
      <div className="pd-windowbar"><Wordmark /><span className="pd-window-service">Sunday gathering <ChevronDown size={12} /></span><span className="pd-preview-label">PRODUCT PREVIEW</span></div>
      <div className="pd-workspace-grid">
        <aside className="pd-workspace-sidebar">
          <p className="pd-tiny-heading">YOUR WORKSPACE</p>
          <div className="pd-sidebar-link"><span className="pd-sidebar-square" />Overview</div>
          <div className="pd-sidebar-link pd-sidebar-link-active"><Radio size={17} />Live service</div>
          <div className="pd-sidebar-link"><BookOpen size={17} />Scripture library</div>
          <div className="pd-sidebar-link"><StickyNote size={17} />Sermon notes</div>
          <div className="pd-sidebar-divider" />
          <p className="pd-tiny-heading">RUN OF SERVICE</p>
          <div className="pd-service-item"><span className="pd-service-index">01</span><span>Welcome<small>Gathering together</small></span><Check size={12} /></div>
          <div className="pd-service-item"><span className="pd-service-index">02</span><span>Worship<small>A moment of praise</small></span><Check size={12} /></div>
          <div className="pd-service-item pd-service-item-current"><span className="pd-service-index">03</span><span>The message<small>Be still</small></span><span className="pd-live-dot" /></div>
          <div className="pd-service-item pd-service-item-next"><span className="pd-service-index">04</span><span>Closing prayer</span></div>
          <div className="pd-sidebar-footer"><span className="pd-avatar">S</span><span>Sunday team<small>Operator workspace</small></span></div>
        </aside>
        <div className="pd-workspace-center">
          <div className="pd-panel-heading"><span>Live presentation</span><span className="pd-status"><span className="pd-live-dot" />On screen</span></div>
          <div className="pd-stage">
            <div className="pd-stage-horizon" />
            <div className="pd-stage-verse"><p>{verse}</p><span>PSALM 46:10 · KJV</span></div>
            <span className="pd-stage-corner">SUNDAY GATHERING</span>
          </div>
          <div className="pd-stage-toolbar"><span><span className="pd-screen-symbol" />Stage output</span><span>Scripture · King James Version</span></div>
          <div className="pd-transcript-panel">
            <div className="pd-panel-heading"><span><Mic size={14} />Live transcript</span><span className="pd-listening"><i /><i /><i /><i /><i /><span>Listening</span></span></div>
            <p className="pd-transcript-older">Sometimes, the invitation is simply to pause. To quiet our hearts and remember who is with us.</p>
            <p className="pd-transcript-current">Let us turn to <mark>Psalm forty-six, verse ten.</mark> Be still, and know that I am God.<span className="pd-transcript-cursor" /></p>
            <div className="pd-detected-inline"><BookOpen size={13} /><span>Psalm 46:10 identified</span><Check size={12} /></div>
          </div>
        </div>
        <aside className="pd-workspace-inspector">
          <div className="pd-panel-heading"><span>Scriptures</span><BookOpen size={14} /></div>
          <div className="pd-scripture-card pd-scripture-card-selected"><span className="pd-scripture-card-label">ON SCREEN<span className="pd-live-dot" /></span><h3>Psalm 46:10</h3><p>{verse}</p><span className="pd-scripture-version">King James Version</span></div>
          <div className="pd-scripture-card"><span className="pd-scripture-card-label">EARLIER IN THE MESSAGE</span><h3>Psalm 46:1</h3><p>God is our refuge and strength, a very present help in trouble.</p><span className="pd-scripture-version">King James Version</span></div>
          <div className="pd-companion-status"><span className="pd-companion-status-icon"><Radio size={16} /></span><div>Companion is connected<small>One service. Every screen.</small></div><Check size={12} /></div>
        </aside>
      </div>
      <figcaption className="pd-workspace-caption"><span className="pd-live-dot" />A little less searching. A little more being present.</figcaption>
    </figure>
  );
}

export { CompanionScene } from "./CompanionScene";

type DemoTab = "prepare" | "present" | "follow";
type DemoReply = { heading: string; body: string; details: string[] };
const demoTabs: { id: DemoTab; label: string; eyebrow: string; heading: string; placeholder: string; prompts: string[] }[] = [
  { id: "prepare", label: "Prepare", eyebrow: "BEFORE THE GATHERING", heading: "Make room for the message.", placeholder: "What are you preparing for Sunday?", prompts: ["Plan a service around Psalm 46", "Get my scriptures ready", "Build a run of service"] },
  { id: "present", label: "Present", eyebrow: "IN THE MOMENT", heading: "Stay with what’s being said.", placeholder: "Try a scripture reference or a spoken phrase…", prompts: ["Let’s turn to Psalm 46:10", "Show the live transcript", "Keep the next verse ready"] },
  { id: "follow", label: "Follow along", eyebrow: "EVERYONE, TOGETHER", heading: "Bring the message closer.", placeholder: "What would you like to follow along with?", prompts: ["Read along on my phone", "Find the sermon notes", "See the scriptures again"] },
];

function replyFor(tab: DemoTab, prompt: string): DemoReply {
  const text = prompt.toLowerCase();
  if (tab === "follow") {
    if (/note/.test(text)) return { heading: "Keep the thought. Return to it.", body: "Sermon notes sit beside the live message in the congregation companion.", details: ["Open your church’s companion link", "Choose Notes", "Read the key thoughts from the message"] };
    if (/scripture|verse|psalm|read/.test(text)) return { heading: "Psalm 46:10", body: `“${verse}”`, details: ["King James Version", "Open Verses to return to passages shared in the service"] };
    return { heading: "The gathering, in your hands.", body: "The companion brings the live transcript, scriptures, and sermon notes into one simple mobile view.", details: ["Open your church’s companion link", "Choose Now, Verses, or Notes", "Follow along at your own pace"] };
  }
  if (tab === "present") {
    if (/transcript|listen|spoken/.test(text)) return { heading: "Every word has a place.", body: "“Let us turn to Psalm forty-six, verse ten. Be still, and know that I am God.”", details: ["A sample of the live transcript", "Scripture reference identified: Psalm 46:10"] };
    return { heading: "Psalm 46:10 · KJV", body: `“${verse}”`, details: ["Scripture is identified as it is spoken", "Review the passage in your workspace", "Present it to the room"] };
  }
  if (/scripture|verse|passage/.test(text)) return { heading: "Keep your scriptures close.", body: "Prepare a small collection of passages before the service, ready to return to when you need them.", details: ["Psalm 46:1 — God is our refuge", "Psalm 46:10 — Be still", "Choose your translation in the scripture library"] };
  return { heading: "A little structure. Room to be present.", body: "Start with a simple run of service and keep the message at the heart of it.", details: ["Welcome & opening prayer", "Worship", "The message · Psalm 46", "Reflection & closing prayer"] };
}

/** A local, deliberately labelled preview; no network request or simulated AI delay. */
export function AssistantDemo() {
  const [tab, setTab] = useState<DemoTab>("prepare");
  const [input, setInput] = useState("");
  const [question, setQuestion] = useState("");
  const [reply, setReply] = useState<DemoReply | null>(null);
  const id = useId();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const tabsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const current = demoTabs.find((item) => item.id === tab)!;

  function chooseTab(next: DemoTab) { setTab(next); setInput(""); setReply(null); setQuestion(""); }
  function submit(prompt = input) {
    const cleanPrompt = prompt.trim();
    if (!cleanPrompt) return;
    setQuestion(cleanPrompt); setReply(replyFor(tab, cleanPrompt)); setInput("");
  }
  function onSubmit(event: FormEvent) { event.preventDefault(); submit(); }
  function onTabKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % demoTabs.length;
    else if (event.key === "ArrowLeft") next = (index + demoTabs.length - 1) % demoTabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = demoTabs.length - 1;
    else return;
    event.preventDefault(); chooseTab(demoTabs[next].id); tabsRef.current[next]?.focus();
  }
  function reset() { setReply(null); setQuestion(""); setInput(""); inputRef.current?.focus(); }

  return (
    <div className="pd-assistant-demo">
      <div className="pd-demo-tabs" role="tablist" aria-label="Explore a service">{demoTabs.map((item, index) => <button key={item.id} ref={(node) => { tabsRef.current[index] = node; }} type="button" role="tab" id={`${id}-${item.id}-tab`} aria-controls={`${id}-panel`} aria-selected={tab === item.id} tabIndex={tab === item.id ? 0 : -1} onKeyDown={(event) => onTabKey(event, index)} onClick={() => chooseTab(item.id)}>{item.label}</button>)}</div>
      <div className="pd-assistant-screen" role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${tab}-tab`}>
        <div className="pd-assistant-toolbar"><Wordmark /><span className="pd-interactive-label"><span />Interactive preview</span></div>
        <div className={`pd-assistant-body ${reply ? "pd-assistant-body-replied" : ""}`}>
          {reply ? <div className="pd-response-area"><p className="pd-demo-question">{question}</p><div className="pd-demo-reply" role="status"><span className="pd-response-eyebrow"><BrandMark className="pd-brand-mark" />EXAMPLE WORKFLOW</span><h3>{reply.heading}</h3><p>{reply.body}</p><ul>{reply.details.map((detail) => <li key={detail}><Check size={13} /><span>{detail}</span></li>)}</ul></div><button className="pd-demo-reset" type="button" onClick={reset}><RotateCcw size={13} />Start again</button></div> : <div className="pd-assistant-welcome"><div className="pd-assistant-orbit" aria-hidden="true"><span /><span /><span /><span className="pd-assistant-orbit-core"><BrandMark className="pd-brand-mark" /></span></div><span className="pd-assistant-eyebrow">{current.eyebrow}</span><h3>{current.heading}</h3><p>From the first thought to the final amen.</p></div>}
          <div className="pd-composer-group">
            <form className="pd-composer" onSubmit={onSubmit}>
              <label className="pd-sr-only" htmlFor={`${id}-prompt`}>Explore the {current.label.toLowerCase()} workflow</label>
              <textarea id={`${id}-prompt`} ref={inputRef} value={input} maxLength={400} onChange={(event) => setInput(event.target.value)} placeholder={current.placeholder} rows={2} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); submit(); } }} />
              <div className="pd-composer-bottom"><span><Plus size={14} />A little help for what’s next</span><button type="submit" aria-label="Explore this example" disabled={!input.trim()}><ArrowRight size={18} /></button></div>
            </form>
            <div className="pd-prompt-options" aria-label="Try an example">{current.prompts.map((prompt) => <button key={prompt} type="button" onClick={() => submit(prompt)}>{prompt}<ArrowRight size={12} /></button>)}</div>
          </div>
        </div>
        <p className="pd-demo-disclaimer">Sample workflows · runs locally in this preview</p>
      </div>
    </div>
  );
}
