/*
 * trilorah-inspect — Door 2 on macOS: see and operate any app through the
 * Accessibility tree.
 *
 * The operating system already describes every running app's interface as a
 * tree — windows, buttons, menus, fields — with names, states and the actions
 * each accepts. It exists so screen readers work; it means Trilorah can ask
 * "what buttons does this app have?" and press one by name, with no
 * screenshots, no pixel guessing and nothing asked of the other app.
 *
 * This is the operating layer only: it sees and presses. Which button means
 * "go live" in a given app is a recipe (controller/recipes), written by us or
 * taught by the operator at sound check — never guessed live on a Sunday.
 *
 *   trilorah-inspect check [--prompt]            is this process trusted? (asks once)
 *   trilorah-inspect apps                        running apps: name, bundle, pid
 *   trilorah-inspect see <app> [--all] [--pretty] [--depth N]
 *   trilorah-inspect find <app> <selector…>      elements matching, with paths
 *   trilorah-inspect press <app> <selector…> [--action AXPress] [--first]
 *   trilorah-inspect type <app> <selector…> --text "…" [--submit]
 *   trilorah-inspect menu <app> "File>New Note"
 *   trilorah-inspect focus <app>
 *   trilorah-inspect watch <app> [--count N] [--seconds N]   record which element the operator clicks
 *
 * Selectors: name:<text> (title/description/value/identifier contains, case-
 * insensitive), role:AXButton, id:<AXIdentifier>, path:0/3/2 (index path from
 * the app), or a bare word = name:. A press refuses to guess: more than one
 * match is an error unless --first is given.
 *
 * JSON out by default (Trilorah reads it); --pretty draws the tree for people.
 * Build: scripts/build-inspect.sh → controller/bin/trilorah-inspect
 */

import AppKit
import ApplicationServices
import Foundation

// MARK: - Output

func emit(_ value: Any) {
    let data = try! JSONSerialization.data(withJSONObject: value, options: [.prettyPrinted, .sortedKeys])
    FileHandle.standardOutput.write(data)
    FileHandle.standardOutput.write("\n".data(using: .utf8)!)
}

func fail(_ message: String, _ extra: [String: Any] = [:], code: Int32 = 1) -> Never {
    var body: [String: Any] = ["ok": false, "error": message]
    for (k, v) in extra { body[k] = v }
    emit(body)
    exit(code)
}

// MARK: - Arguments

struct Args {
    var positional: [String] = []
    var flags: [String: String] = [:]
    var switches: Set<String> = []

    init(_ argv: [String]) {
        var i = 0
        while i < argv.count {
            let a = argv[i]
            if a.hasPrefix("--") {
                let key = String(a.dropFirst(2))
                let valued = ["depth", "action", "text", "limit", "children", "seconds", "count"]
                if valued.contains(key), i + 1 < argv.count {
                    flags[key] = argv[i + 1]
                    i += 2
                    continue
                }
                switches.insert(key)
            } else {
                positional.append(a)
            }
            i += 1
        }
    }
    func int(_ key: String, _ fallback: Int) -> Int { flags[key].flatMap { Int($0) } ?? fallback }
}

// MARK: - Accessibility helpers

func attribute(_ element: AXUIElement, _ name: String) -> AnyObject? {
    var value: CFTypeRef?
    return AXUIElementCopyAttributeValue(element, name as CFString, &value) == .success ? value : nil
}

func text(_ element: AXUIElement, _ name: String) -> String? {
    guard let value = attribute(element, name) else { return nil }
    if let s = value as? String { return s.isEmpty ? nil : s }
    if let n = value as? NSNumber { return n.stringValue }
    if let u = value as? URL { return u.absoluteString }
    if let a = value as? NSAttributedString { return a.string.isEmpty ? nil : a.string }
    return nil
}

func children(of element: AXUIElement) -> [AXUIElement] {
    (attribute(element, kAXChildrenAttribute) as? [AXUIElement]) ?? []
}

func actionNames(_ element: AXUIElement) -> [String] {
    var names: CFArray?
    guard AXUIElementCopyActionNames(element, &names) == .success else { return [] }
    return (names as? [String]) ?? []
}

func frame(of element: AXUIElement) -> [String: Double]? {
    guard let p = attribute(element, kAXPositionAttribute), let s = attribute(element, kAXSizeAttribute) else { return nil }
    var point = CGPoint.zero
    var size = CGSize.zero
    guard CFGetTypeID(p) == AXValueGetTypeID(), CFGetTypeID(s) == AXValueGetTypeID(),
          AXValueGetValue(p as! AXValue, .cgPoint, &point), AXValueGetValue(s as! AXValue, .cgSize, &size) else { return nil }
    return ["x": point.x, "y": point.y, "w": size.width, "h": size.height]
}

func flag(_ element: AXUIElement, _ name: String) -> Bool? {
    guard let v = attribute(element, name) else { return nil }
    if CFGetTypeID(v) == CFBooleanGetTypeID() { return CFBooleanGetValue((v as! CFBoolean)) }
    return (v as? NSNumber)?.boolValue
}

// MARK: - The tree

struct Node {
    let path: String
    let depth: Int
    let role: String
    let subrole: String?
    let title: String?
    let description: String?
    let value: String?
    let identifier: String?
    let help: String?
    let enabled: Bool?
    let focused: Bool?
    let actions: [String]
    let element: AXUIElement

    /** The one name a person would call it. */
    var name: String? { title ?? description ?? identifier ?? help }
    /** Two more round trips per element, so only when asked for. */
    var frame: [String: Double]? { main.frame(of: element) }
    var pressable: Bool { actions.contains("AXPress") || actions.contains("AXConfirm") || actions.contains("AXOpen") }

    /** Worth showing in the compact view: it is named, pressable, or a container that matters. */
    var interesting: Bool {
        if title != nil || description != nil || identifier != nil { return true }
        if actions.contains("AXPress") || actions.contains("AXConfirm") { return true }
        return ["AXWindow", "AXSheet", "AXDialog", "AXTextField", "AXTextArea", "AXSearchField", "AXComboBox",
                "AXPopUpButton", "AXCheckBox", "AXRadioButton", "AXSlider", "AXTable", "AXOutline", "AXTabGroup",
                "AXMenuBarItem", "AXMenuItem", "AXToolbar"].contains(role)
    }

    func json(withFrame: Bool) -> [String: Any] {
        var o: [String: Any] = ["path": path, "role": role, "depth": depth]
        if let v = subrole { o["subrole"] = v }
        if let v = title { o["title"] = v }
        if let v = description { o["description"] = v }
        if let v = value { o["value"] = String(v.prefix(200)) }
        if let v = identifier { o["id"] = v }
        if let v = help { o["help"] = v }
        if let v = enabled { o["enabled"] = v }
        if let v = focused, v { o["focused"] = true }
        if !actions.isEmpty { o["actions"] = actions }
        if withFrame, let f = frame { o["frame"] = f }
        return o
    }
}

/* One round trip for every attribute of an element, instead of nine. The
   walk over a big app is thousands of elements; this is what makes a lookup
   seconds instead of a quarter of a minute. */
let describedAttributes: [String] = [kAXRoleAttribute, kAXSubroleAttribute, kAXTitleAttribute, kAXDescriptionAttribute,
                                     kAXValueAttribute, kAXIdentifierAttribute, kAXHelpAttribute, kAXEnabledAttribute, kAXFocusedAttribute]

func asText(_ value: AnyObject?) -> String? {
    guard let value = value else { return nil }
    if CFGetTypeID(value) == AXValueGetTypeID() { return nil }
    if let s = value as? String { return s.isEmpty ? nil : s }
    if CFGetTypeID(value) == CFBooleanGetTypeID() { return nil }
    if let n = value as? NSNumber { return n.stringValue }
    if let u = value as? URL { return u.absoluteString }
    if let a = value as? NSAttributedString { return a.string.isEmpty ? nil : a.string }
    return nil
}

func asFlag(_ value: AnyObject?) -> Bool? {
    guard let v = value else { return nil }
    if CFGetTypeID(v) == CFBooleanGetTypeID() { return CFBooleanGetValue((v as! CFBoolean)) }
    return (v as? NSNumber)?.boolValue
}

func describe(_ element: AXUIElement, path: String, depth: Int) -> Node {
    var values: CFArray?
    var got: [AnyObject?] = Array(repeating: nil, count: describedAttributes.count)
    if AXUIElementCopyMultipleAttributeValues(element, describedAttributes as CFArray, AXCopyMultipleAttributeOptions(rawValue: 0), &values) == .success,
       let list = values as? [AnyObject] {
        for (i, v) in list.enumerated() where i < got.count {
            // A missing attribute comes back as an AXValue of type error.
            if CFGetTypeID(v) == AXValueGetTypeID(), AXValueGetType(v as! AXValue) == .axError { continue }
            got[i] = v
        }
    }
    return Node(
        path: path, depth: depth,
        role: asText(got[0]) ?? "?",
        subrole: asText(got[1]),
        title: asText(got[2]),
        description: asText(got[3]),
        value: asText(got[4]),
        identifier: asText(got[5]),
        help: asText(got[6]),
        enabled: asFlag(got[7]),
        focused: asFlag(got[8]),
        actions: actionNames(element),
        element: element
    )
}

/** Follow a saved path straight to its element — a handful of calls, no walk. Sunday's path. */
func resolve(app: AXUIElement, path: String) -> AXUIElement? {
    var parts = path.split(separator: "/").map(String.init)
    var current = app
    if parts.first == "menu" {
        guard let bar = attribute(app, kAXMenuBarAttribute) else { return nil }
        current = bar as! AXUIElement
        parts.removeFirst()
    }
    for part in parts {
        guard let i = Int(part) else { return nil }
        let kids = children(of: current)
        guard i < kids.count else { return nil }
        current = kids[i]
    }
    return current
}

struct WalkLimits {
    var maxDepth = 14
    var maxNodes = 6000
    /** Per parent, in compact mode: a song list with 3,000 rows is not 3,000 lines of output. */
    var maxChildren = 200
    /** Rows of a table, outline or list: the controls a recipe wants are never row #400. */
    var maxRows = 25
}

let rowContainers: Set<String> = ["AXTable", "AXOutline", "AXList", "AXBrowser", "AXGrid"]

/** Depth-first over the app's windows, then its menu bar (paths "menu/…"). */
func walk(app: AXUIElement, limits: WalkLimits, compactChildren: Bool, visit: (Node) -> Void) -> Bool {
    var count = 0
    var truncated = false
    func go(_ element: AXUIElement, _ path: String, _ depth: Int) {
        if count >= limits.maxNodes { truncated = true; return }
        count += 1
        let node = describe(element, path: path, depth: depth)
        visit(node)
        if depth >= limits.maxDepth { return }
        // A closed menu's items are still there; a menu bar item's menu is its one child.
        let kids = children(of: element)
        let cap = compactChildren ? (rowContainers.contains(node.role) ? limits.maxRows : limits.maxChildren) : Int.max
        for (i, kid) in kids.enumerated() {
            if i >= cap { truncated = true; break }
            go(kid, path.isEmpty ? "\(i)" : "\(path)/\(i)", depth + 1)
        }
    }
    for (i, win) in children(of: app).enumerated() { go(win, "\(i)", 0) }
    if let bar = attribute(app, kAXMenuBarAttribute) {
        go(bar as! AXUIElement, "menu", 0)
    }
    return truncated
}

// MARK: - Apps

func runningApps() -> [NSRunningApplication] {
    NSWorkspace.shared.runningApplications.filter { $0.activationPolicy == .regular }
}

func findApp(_ query: String) -> NSRunningApplication {
    let apps = runningApps()
    if let pid = Int32(query), let byPid = apps.first(where: { $0.processIdentifier == pid }) { return byPid }
    let q = query.lowercased()
    if let exact = apps.first(where: { ($0.localizedName ?? "").lowercased() == q || ($0.bundleIdentifier ?? "").lowercased() == q }) { return exact }
    let loose = apps.filter { ($0.localizedName ?? "").lowercased().contains(q) || ($0.bundleIdentifier ?? "").lowercased().contains(q) }
    if loose.count == 1 { return loose[0] }
    if loose.isEmpty { fail("no running app matches \"\(query)\" — is it open? (trilorah-inspect apps lists them)") }
    fail("\"\(query)\" matches more than one app", ["matches": loose.map { ["name": $0.localizedName ?? "", "bundle": $0.bundleIdentifier ?? "", "pid": $0.processIdentifier] }])
}

func requireTrust() {
    if !AXIsProcessTrusted() {
        fail("this process is not allowed to see other apps yet — run `trilorah-inspect check --prompt`, then allow it under System Settings › Privacy & Security › Accessibility", code: 3)
    }
}

// MARK: - Selectors

struct Selector {
    var name: String?
    var role: String?
    var path: String?
    var identifier: String?
    var value: String?

    init(_ words: [String]) {
        for w in words {
            if let r = w.range(of: ":") , ["name", "role", "path", "id", "value"].contains(String(w[w.startIndex..<r.lowerBound])) {
                let key = String(w[w.startIndex..<r.lowerBound])
                let val = String(w[r.upperBound...])
                switch key {
                case "name": name = (name.map { $0 + " " } ?? "") + val
                case "role": role = val
                case "path": path = val
                case "id": identifier = val
                case "value": value = val
                default: break
                }
            } else {
                name = (name.map { $0 + " " } ?? "") + w
            }
        }
    }

    var isEmpty: Bool { name == nil && role == nil && path == nil && identifier == nil && value == nil }

    func matches(_ n: Node) -> Bool {
        if let p = path, n.path != p { return false }
        if let r = role, n.role.lowercased() != r.lowercased() { return false }
        if let i = identifier, (n.identifier ?? "") != i { return false }
        if let v = value, !(n.value ?? "").lowercased().contains(v.lowercased()) { return false }
        // name: is what the control is CALLED, never its contents — a note whose
        // text says "new note" is not the New Note button. value: is for contents.
        if let q = name?.lowercased() {
            let hay = [n.title, n.description, n.identifier, n.help].compactMap { $0?.lowercased() }
            if !hay.contains(where: { $0.contains(q) }) { return false }
        }
        return true
    }
}

/** Recipes target controls, not row #436 of a list, so the list cap applies unless --all. */
func collect(app: AXUIElement, selector: Selector, limits: WalkLimits, all: Bool) -> [Node] {
    // A saved path goes straight there; the other cues then confirm it is still the same control.
    if let path = selector.path {
        guard let element = resolve(app: app, path: path) else { return [] }
        let node = describe(element, path: path, depth: path.split(separator: "/").count - 1)
        return selector.matches(node) ? [node] : []
    }
    var found: [Node] = []
    _ = walk(app: app, limits: limits, compactChildren: !all) { n in if selector.matches(n) { found.append(n) } }
    // Pressable and exactly-named first, so "Done" finds the Done button before a label that mentions it.
    let q = selector.name?.lowercased()
    found.sort { a, b in
        let ae = q != nil && (a.name ?? "").lowercased() == q!, be = q != nil && (b.name ?? "").lowercased() == q!
        if ae != be { return ae }
        if a.pressable != b.pressable { return a.pressable }
        return false
    }
    return found
}

/** One element, or a refusal to guess. */
func pick(_ matches: [Node], first: Bool, what: String) -> Node {
    if matches.isEmpty { fail("nothing matches \(what)") }
    if matches.count > 1 && !first {
        fail("\(matches.count) elements match \(what) — add role:/path: to say which, or --first",
             ["matches": matches.prefix(20).map { $0.json(withFrame: false) }])
    }
    return matches[0]
}

// MARK: - Typing (fallback when the field will not take a value directly)

func postKeys(_ string: String) {
    let source = CGEventSource(stateID: .combinedSessionState)
    for ch in string.unicodeScalars {
        var u = [UniChar](String(ch).utf16)
        let down = CGEvent(keyboardEventSource: source, virtualKey: 0, keyDown: true)!
        down.keyboardSetUnicodeString(stringLength: u.count, unicodeString: &u)
        down.post(tap: .cghidEventTap)
        let up = CGEvent(keyboardEventSource: source, virtualKey: 0, keyDown: false)!
        up.keyboardSetUnicodeString(stringLength: u.count, unicodeString: &u)
        up.post(tap: .cghidEventTap)
        usleep(2000)
    }
}

func postReturn() {
    let source = CGEventSource(stateID: .combinedSessionState)
    CGEvent(keyboardEventSource: source, virtualKey: 36, keyDown: true)!.post(tap: .cghidEventTap)
    CGEvent(keyboardEventSource: source, virtualKey: 36, keyDown: false)!.post(tap: .cghidEventTap)
}

// MARK: - Watching clicks (teach-by-showing)

var watchPid: pid_t = 0
var watchWant = 1
var watchApp: AXUIElement?
var watchRecorded: [[String: Any]] = []

/** The index path from the app (or its menu bar) down to this element, by climbing parents. */
func pathOf(_ element: AXUIElement, app: AXUIElement) -> String? {
    var indices: [String] = []
    var current = element
    for _ in 0..<40 {
        if CFEqual(current, app) { return indices.reversed().joined(separator: "/") }
        guard let parentRef = attribute(current, kAXParentAttribute) else { return nil }
        let parent = parentRef as! AXUIElement
        let siblings = children(of: parent)
        guard let i = siblings.firstIndex(where: { CFEqual($0, current) }) else {
            // A menu bar's parent is the app, but the bar is not among the app's children.
            if text(current, kAXRoleAttribute) == "AXMenuBar" { return (["menu"] + indices.reversed()).joined(separator: "/") }
            return nil
        }
        indices.append(String(i))
        current = parent
    }
    return nil
}

/** The control a recipe should press: the clicked element or its nearest pressable ancestor. */
func pressableAncestor(_ element: AXUIElement) -> AXUIElement {
    var current = element
    for _ in 0..<4 {
        let acts = actionNames(current)
        if acts.contains("AXPress") || acts.contains("AXConfirm") || acts.contains("AXOpen") { return current }
        guard let parentRef = attribute(current, kAXParentAttribute) else { break }
        current = parentRef as! AXUIElement
    }
    return element
}

let watchCallback: CGEventTapCallBack = { _, type, event, _ in
    guard type == .leftMouseDown, let app = watchApp else { return Unmanaged.passUnretained(event) }
    let point = event.location
    var hit: AXUIElement?
    let systemWide = AXUIElementCreateSystemWide()
    guard AXUIElementCopyElementAtPosition(systemWide, Float(point.x), Float(point.y), &hit) == .success, let element = hit else {
        return Unmanaged.passUnretained(event)
    }
    var pid: pid_t = 0
    AXUIElementGetPid(element, &pid)
    // Clicks in other apps are not lessons about this one.
    guard pid == watchPid else { return Unmanaged.passUnretained(event) }
    let control = pressableAncestor(element)
    let path = pathOf(control, app: app)
    let node = describe(control, path: path ?? "?", depth: path?.split(separator: "/").count ?? 0)
    var record = node.json(withFrame: true)
    record["clickedAt"] = ["x": point.x, "y": point.y]
    if !CFEqual(control, element) {
        let exact = describe(element, path: pathOf(element, app: app) ?? "?", depth: 0)
        record["clickedExactly"] = exact.json(withFrame: false)
    }
    watchRecorded.append(record)
    FileHandle.standardError.write("  recorded: \(node.role) \"\(node.name ?? "")\" at \(path ?? "?")\n".data(using: .utf8)!)
    return Unmanaged.passUnretained(event)
}

// MARK: - Commands

let args = Args(Array(CommandLine.arguments.dropFirst()))
guard let command = args.positional.first else {
    fail("usage: trilorah-inspect check|apps|see|find|press|type|menu|focus …", code: 2)
}

switch command {
case "check":
    let prompt = args.switches.contains("prompt")
    let options = [kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: prompt] as CFDictionary
    let trusted = AXIsProcessTrustedWithOptions(options)
    emit(["ok": true, "trusted": trusted,
          "note": trusted ? "this process may see and operate other apps" : "allow it under System Settings › Privacy & Security › Accessibility" + (prompt ? " (macOS just asked)" : " (run with --prompt to be asked)")])
    exit(trusted ? 0 : 3)

case "apps":
    emit(["ok": true, "apps": runningApps().map { ["name": $0.localizedName ?? "", "bundle": $0.bundleIdentifier ?? "", "pid": $0.processIdentifier, "active": $0.isActive] }])

case "see":
    requireTrust()
    guard args.positional.count >= 2 else { fail("see which app?", code: 2) }
    let app = findApp(args.positional[1])
    let root = AXUIElementCreateApplication(app.processIdentifier)
    var limits = WalkLimits()
    limits.maxDepth = args.int("depth", limits.maxDepth)
    limits.maxNodes = args.int("limit", limits.maxNodes)
    limits.maxChildren = args.int("children", limits.maxChildren)
    let all = args.switches.contains("all")
    var nodes: [Node] = []
    let truncated = walk(app: root, limits: limits, compactChildren: !all) { n in if all || n.interesting { nodes.append(n) } }
    if args.switches.contains("pretty") {
        print("\(app.localizedName ?? "?") (\(app.bundleIdentifier ?? ""), pid \(app.processIdentifier)) — \(nodes.count) elements\(truncated ? ", truncated" : "")")
        for n in nodes {
            let indent = String(repeating: "  ", count: n.depth)
            var line = "\(indent)\(n.role)"
            if let s = n.subrole { line += "/\(s.replacingOccurrences(of: "AX", with: ""))" }
            if let t = n.name { line += "  \"\(t)\"" }
            if let v = n.value, n.title != v { line += "  = \(String(v.prefix(60)).replacingOccurrences(of: "\n", with: "⏎"))" }
            if n.enabled == false { line += "  (disabled)" }
            if n.actions.contains("AXPress") { line += "  [press]" }
            line += "   ·\(n.path)"
            print(line)
        }
    } else {
        emit(["ok": true, "app": ["name": app.localizedName ?? "", "bundle": app.bundleIdentifier ?? "", "pid": app.processIdentifier],
              "truncated": truncated, "count": nodes.count, "elements": nodes.map { $0.json(withFrame: args.switches.contains("frames")) }])
    }

case "find":
    requireTrust()
    guard args.positional.count >= 3 else { fail("find <app> <selector…>", code: 2) }
    let app = findApp(args.positional[1])
    let root = AXUIElementCreateApplication(app.processIdentifier)
    let selector = Selector(Array(args.positional.dropFirst(2)))
    let matches = collect(app: root, selector: selector, limits: WalkLimits(), all: args.switches.contains("all"))
    emit(["ok": true, "count": matches.count, "matches": matches.prefix(50).map { $0.json(withFrame: true) }])

case "press":
    requireTrust()
    guard args.positional.count >= 3 else { fail("press <app> <selector…>", code: 2) }
    let app = findApp(args.positional[1])
    let root = AXUIElementCreateApplication(app.processIdentifier)
    let selector = Selector(Array(args.positional.dropFirst(2)))
    let what = args.positional.dropFirst(2).joined(separator: " ")
    let matches = collect(app: root, selector: selector, limits: WalkLimits(), all: args.switches.contains("all"))
    let target = pick(matches, first: args.switches.contains("first"), what: what)
    if target.enabled == false { fail("\"\(target.name ?? target.role)\" is disabled right now", ["element": target.json(withFrame: false)]) }
    let action = args.flags["action"] ?? (target.actions.contains("AXPress") ? "AXPress" : target.actions.first ?? "AXPress")
    let result = AXUIElementPerformAction(target.element, action as CFString)
    if result != .success { fail("\(action) on \"\(target.name ?? target.role)\" failed (AXError \(result.rawValue))", ["element": target.json(withFrame: false)]) }
    emit(["ok": true, "action": action, "element": target.json(withFrame: false)])

case "type":
    requireTrust()
    guard args.positional.count >= 3, let value = args.flags["text"] else { fail("type <app> <selector…> --text \"…\" [--submit]", code: 2) }
    let app = findApp(args.positional[1])
    let root = AXUIElementCreateApplication(app.processIdentifier)
    let selector = Selector(Array(args.positional.dropFirst(2)))
    let what = args.positional.dropFirst(2).joined(separator: " ")
    let target = pick(collect(app: root, selector: selector, limits: WalkLimits(), all: args.switches.contains("all")), first: args.switches.contains("first"), what: what)
    AXUIElementSetAttributeValue(target.element, kAXFocusedAttribute as CFString, kCFBooleanTrue)
    var how = "value"
    if AXUIElementSetAttributeValue(target.element, kAXValueAttribute as CFString, value as CFTypeRef) != .success {
        // Some fields only take keystrokes; they need the app in front for that.
        app.activate()
        usleep(150_000)
        AXUIElementSetAttributeValue(target.element, kAXFocusedAttribute as CFString, kCFBooleanTrue)
        postKeys(value)
        how = "keys"
    }
    if args.switches.contains("submit") {
        if how == "value" { AXUIElementPerformAction(target.element, "AXConfirm" as CFString) }
        if how == "keys" || !target.actions.contains("AXConfirm") { app.activate(); usleep(50_000); postReturn() }
    }
    emit(["ok": true, "typed": value, "how": how, "element": target.json(withFrame: false)])

case "menu":
    requireTrust()
    guard args.positional.count >= 3 else { fail("menu <app> \"File>New Note\"", code: 2) }
    let app = findApp(args.positional[1])
    let root = AXUIElementCreateApplication(app.processIdentifier)
    guard let bar = attribute(root, kAXMenuBarAttribute) else { fail("the app has no menu bar") }
    let segments = args.positional[2].split(separator: ">").map { $0.trimmingCharacters(in: .whitespaces).lowercased() }
    var current = bar as! AXUIElement
    var trail: [String] = []
    for segment in segments {
        // A menu bar item or menu item holds its menu as its single child.
        var pool = children(of: current)
        if pool.count == 1, text(pool[0], kAXRoleAttribute) == "AXMenu" { pool = children(of: pool[0]) }
        guard let next = pool.first(where: { (text($0, kAXTitleAttribute) ?? "").lowercased() == segment })
            ?? pool.first(where: { (text($0, kAXTitleAttribute) ?? "").lowercased().contains(segment) }) else {
            fail("no menu item \"\(segment)\" under \(trail.isEmpty ? "the menu bar" : trail.joined(separator: " > "))",
                 ["available": pool.compactMap { text($0, kAXTitleAttribute) }])
        }
        trail.append(text(next, kAXTitleAttribute) ?? segment)
        current = next
    }
    if flag(current, kAXEnabledAttribute) == false { fail("\"\(trail.joined(separator: " > "))\" is disabled right now") }
    let result = AXUIElementPerformAction(current, kAXPressAction as CFString)
    if result != .success { fail("could not press \(trail.joined(separator: " > ")) (AXError \(result.rawValue))") }
    emit(["ok": true, "pressed": trail])

case "focus":
    guard args.positional.count >= 2 else { fail("focus <app>", code: 2) }
    let app = findApp(args.positional[1])
    emit(["ok": app.activate(), "app": app.localizedName ?? ""])

/*
 * watch: teach-by-showing. "Show me how you put something on the screen" —
 * the operator clicks, and this records WHICH element they clicked (its path
 * and cues), not where the mouse was. A listen-only event tap sees the click;
 * the element under it comes from the accessibility tree; the nearest
 * pressable ancestor is what a recipe will press. Nothing is pressed here.
 */
case "watch":
    requireTrust()
    guard args.positional.count >= 2 else { fail("watch <app> [--count N] [--seconds N]", code: 2) }
    let app = findApp(args.positional[1])
    let want = args.int("count", 1)
    let seconds = args.int("seconds", 60)
    watchPid = app.processIdentifier
    watchWant = want
    watchApp = AXUIElementCreateApplication(app.processIdentifier)
    FileHandle.standardError.write("watching \(app.localizedName ?? "the app") — click the control you want to teach (\(want) click\(want == 1 ? "" : "s"), up to \(seconds)s)\n".data(using: .utf8)!)
    let mask = CGEventMask(1 << CGEventType.leftMouseDown.rawValue)
    guard let tap = CGEvent.tapCreate(tap: .cgSessionEventTap, place: .headInsertEventTap, options: .listenOnly,
                                      eventsOfInterest: mask, callback: watchCallback, userInfo: nil) else {
        fail("could not listen for clicks — macOS may also want Input Monitoring for this process", code: 3)
    }
    let source = CFMachPortCreateRunLoopSource(kCFAllocatorDefault, tap, 0)
    CFRunLoopAddSource(CFRunLoopGetCurrent(), source, .commonModes)
    CGEvent.tapEnable(tap: tap, enable: true)
    let deadline = Date().addingTimeInterval(TimeInterval(seconds))
    while watchRecorded.count < want && Date() < deadline {
        CFRunLoopRunInMode(.defaultMode, 0.25, true)
    }
    CGEvent.tapEnable(tap: tap, enable: false)
    emit(["ok": watchRecorded.count >= want, "wanted": want, "recorded": watchRecorded,
          "note": watchRecorded.count >= want ? "recorded" : "time ran out before \(want) click\(want == 1 ? "" : "s") landed in \(app.localizedName ?? "the app")"])
    exit(watchRecorded.count >= want ? 0 : 1)

default:
    fail("unknown command \"\(command)\" — check|apps|see|find|press|type|menu|focus", code: 2)
}
