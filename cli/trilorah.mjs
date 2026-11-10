#!/usr/bin/env node
/**
 * trilorah — the command-line client for a running Trilorah app.
 *
 * A thin remote control: all the intelligence (listening, recognition, the
 * Bible) lives in the installed Trilorah app. This connects to its local
 * control socket (electron/control/socketServer.ts), speaks JSON-RPC 2.0
 * one line per message, and prints honest results. No dependencies; runs on
 * plain Node 18+.
 *
 *   trilorah status [--json]
 *   trilorah listen start|stop
 *   trilorah scripture "John 3:16" [--version WEB]
 *   trilorah take ["John 3:16"] [--version WEB]
 *   trilorah clear | black | logo | wall
 *   trilorah next | prev
 *   trilorah events [--json]
 *
 * Exit codes: 0 done · 1 the app refused the command · 2 could not reach the
 * app or bad usage.
 */
import net from "node:net";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";

const PROTOCOL = "0.1.0"; // mirror of shared/control/schema.ts CONTROL_PROTOCOL
const APP_DIR = "ai-preacher-assistant";

function userDataDir() {
  const home = os.homedir();
  if (process.platform === "darwin") return path.join(home, "Library", "Application Support", APP_DIR);
  if (process.platform === "win32") return path.join(process.env.APPDATA || path.join(home, "AppData", "Roaming"), APP_DIR);
  return path.join(process.env.XDG_CONFIG_HOME || path.join(home, ".config"), APP_DIR);
}

function die(message, code = 2) {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}

function readDiscovery() {
  try {
    const found = JSON.parse(fs.readFileSync(path.join(userDataDir(), "control.json"), "utf8"));
    if (typeof found?.socket === "string") return found;
  } catch {
    /* not running */
  }
  return null;
}

/** Start the installed app invisibly (--hidden: engine on, nothing on screen). */
function launchApp(onGaveUp) {
  try {
    if (process.platform === "darwin") {
      const child = spawn("open", ["-g", "-b", "com.trilorah.app", "--args", "--hidden"], { stdio: "ignore" });
      child.on("exit", (code) => { if (code !== 0) onGaveUp(); });
      return true;
    }
    if (process.platform === "win32") {
      const exe = [
        path.join(process.env.LOCALAPPDATA || "", "Programs", "Trilorah", "Trilorah.exe"),
        path.join(process.env.ProgramFiles || "C:\\Program Files", "Trilorah", "Trilorah.exe"),
      ].find((p) => { try { return fs.existsSync(p); } catch { return false; } });
      if (!exe) return false;
      spawn(exe, ["--hidden"], { stdio: "ignore", detached: true }).unref();
      return true;
    }
  } catch {
    /* no launcher on this platform */
  }
  return false;
}

const NOT_RUNNING = "Could not find a running Trilorah. Open the Trilorah app first — the CLI is a remote control for it, not a second copy of it.";

async function discover() {
  const found = readDiscovery();
  if (found) return found;
  // The app is the brain; wake it quietly and wait for its socket.
  let gaveUp = false;
  if (!launchApp(() => { gaveUp = true; })) die(NOT_RUNNING);
  process.stderr.write("Waking Trilorah…\n");
  for (let waited = 0; waited < 20000 && !gaveUp; waited += 500) {
    await new Promise((r) => setTimeout(r, 500));
    const woke = readDiscovery();
    if (woke) return woke;
  }
  die(gaveUp ? "Trilorah does not seem to be installed on this computer. Install the app first — the CLI is only a remote control for it." : NOT_RUNNING);
}

/** One connection: hello, then whatever the command needs. */
async function connect(onReady, onEvent) {
  const { socket: socketPath } = await discover();
  const socket = net.createConnection(socketPath);
  let buffered = "";
  let nextId = 1;
  const waiting = new Map();

  const request = (method, params) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      waiting.set(id, { resolve, reject });
      socket.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
    });

  socket.setEncoding("utf8");
  socket.on("data", (chunk) => {
    buffered += chunk;
    let eol = buffered.indexOf("\n");
    while (eol >= 0) {
      const line = buffered.slice(0, eol).trim();
      buffered = buffered.slice(eol + 1);
      eol = buffered.indexOf("\n");
      if (!line) continue;
      let message;
      try { message = JSON.parse(line); } catch { continue; }
      if (message.method === "event") { onEvent?.(message.params); continue; }
      const pending = waiting.get(message.id);
      if (!pending) continue;
      waiting.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message || "the app refused"));
      else pending.resolve(message.result);
    }
  });
  socket.on("error", (e) => die(`Could not reach Trilorah (${e.code || e.message}). Is the app open?`));
  socket.on("connect", async () => {
    try {
      const hello = await request("hello", { protocol: PROTOCOL });
      onReady({ request, socket, snapshot: hello.snapshot });
    } catch (e) {
      die(e.message);
    }
  });
  return socket;
}

const verseText = (v) => (v ? `${v.book} ${v.chapter}:${v.verse}${v.endVerse && v.endVerse !== v.verse ? `-${v.endVerse}` : ""} · ${v.version}` : "—");

function printSnapshot(s, json) {
  if (json) return process.stdout.write(`${JSON.stringify(s)}\n`);
  process.stdout.write(
    [
      `listening  ${s.listening ? "yes" : "no"}${s.asrStatus ? `  (${s.asrStatus})` : ""}`,
      `preview    ${verseText(s.preview)}`,
      `live       ${verseText(s.live)}`,
      `wall       ${s.screen}`,
    ].join("\n") + "\n"
  );
}

function runCommand(command, { json }) {
  connect(async ({ request, socket }) => {
    const result = await request("command", { command });
    if (json) process.stdout.write(`${JSON.stringify(result)}\n`);
    else if (!result.ok) process.stderr.write(`no: ${result.error}\n`);
    else if (result.live) process.stdout.write(`live: ${verseText(result.live)}\n`);
    else if (result.staged) process.stdout.write(`staged: ${verseText(result.staged)}\n`);
    else printSnapshot(result.snapshot, false);
    socket.end();
    process.exit(result.ok ? 0 : 1);
  });
}

function followEvents({ json }) {
  connect(
    async ({ request }) => {
      await request("subscribe", {});
      if (!json) process.stderr.write("following — ctrl-c to stop\n");
    },
    (event) => {
      if (json) return process.stdout.write(`${JSON.stringify(event)}\n`);
      const when = new Date(event.at).toTimeString().slice(0, 8);
      const p = event.payload;
      const line =
        event.channel === "transcript" ? `${p?.isFinal ? "  " : "~ "}${p?.text ?? ""}`
        : event.channel === "preview" || event.channel === "live" ? verseText(p)
        : typeof p === "string" ? p
        : JSON.stringify(p);
      process.stdout.write(`${when}  ${event.channel.padEnd(10)} ${line}\n`);
    }
  );
}

const HELP = `trilorah — remote control for the running Trilorah app

  trilorah status                     what it is hearing and showing
  trilorah listen start|stop          start or stop listening
  trilorah scripture "John 3:16"      stage a verse in the preview
  trilorah take ["John 3:16"]        put the preview (or this verse) on the wall
  trilorah next | prev                step the live reading
  trilorah clear | black | logo       the wall: background, black, or the logo
  trilorah wall                       bring the wall back to live
  trilorah console                    open the pop-up console (buttons, no typing)
  trilorah events                     follow what happens, line by line

  --version <name>   Bible translation for scripture/take
  --json             machine-readable output

The Trilorah app must be open on this computer; the CLI has no engine of its own.`;

function main() {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const versionAt = args.indexOf("--version");
  const version = versionAt >= 0 ? args[versionAt + 1] : undefined;
  const words = args.filter((a, i) => !a.startsWith("--") && (versionAt < 0 || i !== versionAt + 1));
  const [verb, ...rest] = words;

  switch (verb) {
    case "status":
      return runCommand({ kind: "status" }, { json });
    case "listen":
      if (rest[0] === "start" || rest[0] === "stop") return runCommand({ kind: `listen.${rest[0]}` }, { json });
      return die(`listen start or listen stop — not "${rest[0] ?? ""}"`);
    case "scripture":
      if (!rest[0]) return die('which verse? e.g. trilorah scripture "John 3:16"');
      return runCommand({ kind: "scripture.stage", reference: rest.join(" "), version }, { json });
    case "take":
      return runCommand({ kind: "live.take", ...(rest.length ? { reference: rest.join(" ") } : {}), version }, { json });
    case "next":
      return runCommand({ kind: "live.next" }, { json });
    case "prev":
    case "previous":
      return runCommand({ kind: "live.previous" }, { json });
    case "clear":
      return runCommand({ kind: "live.clear" }, { json });
    case "black":
    case "logo":
      return runCommand({ kind: "screen.set", state: verb }, { json });
    case "wall":
      return runCommand({ kind: "screen.set", state: "live" }, { json });
    case "console":
      return runCommand({ kind: "console.open" }, { json });
    case "events":
      return followEvents({ json });
    case "help":
    case undefined:
      process.stdout.write(`${HELP}\n`);
      return process.exit(verb ? 0 : 2);
    default:
      return die(`not a command: ${verb}\n\n${HELP}`);
  }
}

main();
