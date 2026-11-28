<#
 trilorah-inspect (Windows) — Door 2 on Windows: see and operate any app
 through UI Automation, the twin of controller/macos/inspect.swift.

 Same commands, same JSON, same refusals. UI Automation ships inside every
 Windows 10/11, so nothing is installed on the church computer; PowerShell 5.1
 (also built in) runs this. The one Windows wrinkle: an app running "as
 administrator" is invisible to a normal process (UIPI) — EasyWorship normally
 is not, and `check` says so when it happens.

   powershell -NoProfile -ExecutionPolicy Bypass -File trilorah-inspect.ps1 <command> …

   check                                    can this process see other apps?
   apps                                     top-level windows: name, exe, pid
   see <app> [--all] [--pretty] [--depth N]
   find <app> <selector…>
   press <app> <selector…> [--first] [--at left|right] [--action toggle|select|expand|click]
   type <app> <selector…> --text "…" [--submit]
   menu <app> "File>Open"
   focus <app>
   key <app> <keys>                         e.g. f5, ctrl+enter, escape
   watch <app> [--count N] [--seconds N]    record which element the operator clicks

 Selectors as on the Mac: name:<text> (Name/HelpText contains, case-insensitive),
 role:Button (control type), id:<AutomationId>, path:0/3/2 (index path from
 the app's top window list), class:<window class> (Windows only: TsdSpeedButton,
 Edit…), bare word = name:. An ambiguous press is an error unless --first.
#>
param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Argv)

# A command's refusal, carried as an exception: the one-shot run prints it and exits with
# its code; the server (`serve`) answers the one request with it and keeps going.
class InspectFailure : System.Exception {
  [object]$Body; [int]$Code
  InspectFailure($body, $code) : base('inspect failure') { $this.Body = $body; $this.Code = $code }
}

$ErrorActionPreference = 'Stop'
$script:serving = $false
# Where a request's milliseconds went (app lookup, roots, search, the press itself…): the
# server sends it back with each answer, and Trilorah prints it for a slow call.
$script:trace = [ordered]@{}
function Spent([string]$what, [Diagnostics.Stopwatch]$clock) {
  $script:trace[$what] = [int]$script:trace[$what] + [int]$clock.ElapsedMilliseconds
}
Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes, System.Windows.Forms
# UI Automation reports physical pixels; without this, a scaled display (125 %, 200 %) makes
# Windows hand this process shrunken coordinates, and every fallback click lands short.
try {
  Add-Type -MemberDefinition '[DllImport("user32.dll")] public static extern bool SetProcessDPIAware();' -Name D -Namespace W
  [void][W.D]::SetProcessDPIAware()
} catch {}

# ---------------------------------------------------------------- output

function Emit($obj) {
  if ($script:serving) { [Console]::Out.WriteLine(($obj | ConvertTo-Json -Depth 8 -Compress)) }
  else { $obj | ConvertTo-Json -Depth 8 -Compress:$false }
}
function Fail($message, $extra = @{}, $code = 1) {
  $body = [ordered]@{ ok = $false; error = $message }
  foreach ($k in $extra.Keys) { $body[$k] = $extra[$k] }
  throw [InspectFailure]::new($body, $code)
}

# ---------------------------------------------------------------- arguments

$positional = @(); $flags = @{}; $switches = @{}
$valued = @('depth', 'action', 'text', 'limit', 'children', 'seconds', 'count', 'at', 'patience', 'pace')
function ParseArgs([string[]]$words) {
  $script:positional = @(); $script:flags = @{}; $script:switches = @{}
  for ($i = 0; $i -lt $words.Count; $i++) {
    $a = $words[$i]
    if ($a -like '--*') {
      $key = $a.Substring(2)
      if ($valued -contains $key -and $i + 1 -lt $words.Count) { $script:flags[$key] = $words[$i + 1]; $i++; continue }
      $script:switches[$key] = $true
    } else { $script:positional += $a }
  }
}
function IntFlag($key, $fallback) { if ($flags.ContainsKey($key)) { [int]$flags[$key] } else { $fallback } }

# ---------------------------------------------------------------- UIA helpers

$AE = [System.Windows.Automation.AutomationElement]
$Walker = [System.Windows.Automation.TreeWalker]::ControlViewWalker

# Every property and pattern a node is described from, asked for together: with a cache
# request each element costs one round trip into the app instead of a dozen (a dozen
# across six thousand elements was most of a 30-second search in MediaShout).
$Cache = New-Object System.Windows.Automation.CacheRequest
foreach ($prop in @($AE::NameProperty, $AE::HelpTextProperty, $AE::AutomationIdProperty, $AE::ClassNameProperty,
    $AE::ControlTypeProperty, $AE::BoundingRectangleProperty, $AE::IsEnabledProperty, $AE::HasKeyboardFocusProperty,
    $AE::ProcessIdProperty, $AE::NativeWindowHandleProperty, $AE::IsOffscreenProperty,
    [System.Windows.Automation.ValuePattern]::ValueProperty)) { $Cache.Add($prop) }
foreach ($pat in @([System.Windows.Automation.InvokePattern]::Pattern, [System.Windows.Automation.TogglePattern]::Pattern,
    [System.Windows.Automation.SelectionItemPattern]::Pattern, [System.Windows.Automation.ExpandCollapsePattern]::Pattern,
    [System.Windows.Automation.ValuePattern]::Pattern)) { $Cache.Add($pat) }
$Cache.TreeFilter = [System.Windows.Automation.Automation]::ControlViewCondition

# One call for all of an element's children (the control view, like the walker), not one
# per sibling: a path such as 0/5/9/17 is three calls, where sibling by sibling it was
# forty, each a trip into an app that may be busy drawing.
function Children($el) {
  $active = $Cache.Activate()
  try { $kids = $el.FindAll([System.Windows.Automation.TreeScope]::Children, [System.Windows.Automation.Condition]::TrueCondition) } finally { $active.Dispose() }
  $out = New-Object System.Collections.ArrayList
  foreach ($k in $kids) { $null = $out.Add($k) }
  return ,$out.ToArray()
}

function Patterns($el) {
  $names = @()
  foreach ($p in $el.GetSupportedPatterns()) { $names += ($p.ProgrammaticName -replace 'PatternIdentifiers\.Pattern$', '') }
  return ,$names
}

function Describe($el, $path, $depth, $live = $false) {
  # Cached properties when the element came through $Cache (one fetch for all of them);
  # live ones otherwise (the element under the pointer in `watch`), or when asked, to
  # check a remembered element against what it is now.
  $cur = $null; $cached = $false
  if ($live) { $cur = $el.Current } else { try { $cur = $el.Cached; $null = $cur.ControlType; $cached = $true } catch { $cur = $el.Current } }
  $node = [ordered]@{ depth = $depth; role = ($cur.ControlType.ProgrammaticName -replace '^ControlType\.', '') }
  if ($path -ne $null) { $node.path = $path }
  if ($cur.Name) { $node.title = $cur.Name }
  if ($cur.HelpText) { $node.help = $cur.HelpText }
  if ($cur.AutomationId) { $node.id = $cur.AutomationId }
  if ($cur.ClassName) { $node.class = $cur.ClassName }
  # Where it is, in physical pixels: what a fallback click aims at, and what a person checks against a screenshot.
  $b = $cur.BoundingRectangle
  if (-not $b.IsEmpty) { $node.rect = @([int]$b.X, [int]$b.Y, [int]$b.Width, [int]$b.Height) }
  $node.enabled = [bool]$cur.IsEnabled
  if ($cur.HasKeyboardFocus) { $node.focused = $true }
  try {
    $vp = $null
    if ($cached) {
      if ($el.TryGetCachedPattern([System.Windows.Automation.ValuePattern]::Pattern, [ref]$vp)) { $v = $vp.Cached.Value; if ($v) { $node.value = [string]$v } }
    } elseif ($el.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern, [ref]$vp)) {
      $v = $vp.Current.Value; if ($v) { $node.value = [string]$v }
    }
  } catch {}
  $acts = @()
  $supported = if ($cached) {
    $names = @(); $q = $null
    foreach ($pair in @(@('Invoke', [System.Windows.Automation.InvokePattern]::Pattern), @('Toggle', [System.Windows.Automation.TogglePattern]::Pattern),
        @('SelectionItem', [System.Windows.Automation.SelectionItemPattern]::Pattern), @('ExpandCollapse', [System.Windows.Automation.ExpandCollapsePattern]::Pattern),
        @('Value', [System.Windows.Automation.ValuePattern]::Pattern))) {
      if ($el.TryGetCachedPattern($pair[1], [ref]$q)) { $names += $pair[0] }
    }
    $names
  } else { Patterns $el }
  foreach ($p in $supported) {
    switch ($p) {
      'Invoke' { $acts += 'press' }
      'Toggle' { $acts += 'press' }
      'SelectionItem' { $acts += 'select' }
      'ExpandCollapse' { $acts += 'expand' }
      'Value' { $acts += 'type' }
    }
  }
  if ($acts.Count) { $node.actions = ($acts | Select-Object -Unique) }
  $node._el = $el
  return $node
}

function Interesting($n) {
  if ($n.title -or $n.id) { return $true }
  if ($n.actions) { return $true }
  return @('Window', 'Pane', 'Edit', 'ComboBox', 'Button', 'MenuItem', 'MenuBar', 'Tab', 'List', 'DataGrid', 'Tree', 'ToolBar') -contains $n.role
}

$rowContainers = @('List', 'DataGrid', 'Tree', 'Table')

# The app's "root": every top-level window belonging to the process, in z-order.
function AppRoots($procId) {
  $clock = [Diagnostics.Stopwatch]::StartNew()
  try { return (AppRootsNow $procId) } finally { Spent 'roots' $clock }
}
function AppRootsNow($procId) {
  $cond = New-Object System.Windows.Automation.PropertyCondition($AE::ProcessIdProperty, [int]$procId)
  $active = $Cache.Activate()
  try { $found = $AE::RootElement.FindAll([System.Windows.Automation.TreeScope]::Children, $cond) } finally { $active.Dispose() }
  # The app's main window is always root 0, whatever is stacked above it (a full-screen
  # output, a notification): a path recorded as 0/… must mean the same window on Sunday.
  $main = [long](Get-Process -Id $procId -ErrorAction SilentlyContinue).MainWindowHandle
  $first = @(); $rest = @()
  foreach ($w in $found) { if ($main -ne 0 -and [long]$w.Current.NativeWindowHandle -eq $main) { $first += $w } else { $rest += $w } }
  return ,($first + $rest)
}

function Walk($procId, $maxDepth, $maxNodes, $maxChildren, $maxRows, $compact, [scriptblock]$visit) {
  $script:walkCount = 0; $script:truncated = $false
  function Go($el, $path, $depth) {
    if ($script:walkCount -ge $maxNodes) { $script:truncated = $true; return }
    $script:walkCount++
    $node = Describe $el $path $depth
    & $visit $node
    if ($depth -ge $maxDepth) { return }
    $kids = Children $el
    $cap = if ($compact) { if ($rowContainers -contains $node.role) { $maxRows } else { $maxChildren } } else { [int]::MaxValue }
    for ($i = 0; $i -lt $kids.Count; $i++) {
      if ($i -ge $cap) { $script:truncated = $true; break }
      Go $kids[$i] ($(if ($path -eq '') { "$i" } else { "$path/$i" })) ($depth + 1)
    }
  }
  $roots = AppRoots $procId
  for ($i = 0; $i -lt $roots.Count; $i++) { Go $roots[$i] "$i" 0 }
  return $script:truncated
}

function Resolve($procId, $path) {
  $clock = [Diagnostics.Stopwatch]::StartNew()
  try { return (ResolveNow $procId $path) } finally { Spent 'path' $clock }
}
function ResolveNow($procId, $path) {
  $parts = $path -split '/'
  $roots = AppRoots $procId
  $idx = [int]$parts[0]
  if ($idx -ge $roots.Count) { return $null }
  $cur = $roots[$idx]
  foreach ($p in $parts[1..($parts.Count - 1)]) {
    if ($parts.Count -eq 1) { break }
    $kids = Children $cur
    $i = [int]$p
    if ($i -ge $kids.Count) { return $null }
    $cur = $kids[$i]
  }
  return $cur
}

# ---------------------------------------------------------------- apps

function RunningApps() {
  # Every process with a top-level window on screen — not only those Windows calls a "main
  # window": an app showing nothing but its activation wizard (MediaShout) has none, and would
  # otherwise be invisible to `apps`, `press` and the rest.
  # (String keys on purpose: an ordered hashtable reads an int key as a position.)
  $byPid = [ordered]@{}
  foreach ($w in $AE::RootElement.FindAll([System.Windows.Automation.TreeScope]::Children, [System.Windows.Automation.Condition]::TrueCondition)) {
    $c = $w.Current
    if ($c.IsOffscreen -and -not $c.Name) { continue }
    $key = [string][int]$c.ProcessId
    if (-not $byPid.Contains($key)) { $byPid[$key] = [string]$c.Name }
    elseif (-not $byPid[$key] -and $c.Name) { $byPid[$key] = [string]$c.Name }
  }
  $out = @()
  foreach ($key in @($byPid.Keys)) {
    $p = Get-Process -Id ([int]$key) -ErrorAction SilentlyContinue
    if (-not $p) { continue }
    $title = if ($p.MainWindowTitle) { $p.MainWindowTitle } else { $byPid[$key] }
    $out += [ordered]@{ name = $p.ProcessName; title = $title; exe = $(try { [IO.Path]::GetFileName($p.Path) } catch { '' }); pid = $p.Id }
  }
  return ,$out
}

$script:knownApps = @{}
function FindApp($query) {
  $clock = [Diagnostics.Stopwatch]::StartNew()
  try { return (FindAppCached $query) } finally { Spent 'app' $clock }
}
function FindAppCached($query) {
  # The server answers many requests about one app: once found, the app is remembered for as
  # long as that process is alive and still called the same thing.
  $known = $script:knownApps[$query]
  if ($known) {
    $alive = Get-Process -Id $known.pid -ErrorAction SilentlyContinue
    if ($alive -and $alive.ProcessName -eq $known.name) { return $known }
    $script:knownApps.Remove($query)
  }
  $app = FindAppNow $query
  $script:knownApps[$query] = $app
  return $app
}
function FindAppNow($query) {
  $apps = RunningApps
  if ($query -match '^\d+$') { $byPid = $apps | Where-Object { $_.pid -eq [int]$query }; if ($byPid) { return $byPid } }
  $q = $query.ToLower()
  $exact = $apps | Where-Object { $_.name.ToLower() -eq $q -or $_.exe.ToLower() -eq $q -or $_.exe.ToLower() -eq "$q.exe" }
  if ($exact) { return @($exact)[0] }
  $loose = @($apps | Where-Object { $_.name.ToLower().Contains($q) -or $_.title.ToLower().Contains($q) })
  if ($loose.Count -eq 1) { return $loose[0] }
  if ($loose.Count -eq 0) { Fail "no running app matches `"$query`" — is it open? (trilorah-inspect apps lists them)" }
  Fail "`"$query`" matches more than one app" @{ matches = $loose }
}

# ---------------------------------------------------------------- selectors

function ParseSelector($words) {
  $s = @{ name = $null; role = $null; path = $null; id = $null; value = $null; class = $null }
  foreach ($w in $words) {
    if ($w -match '^(name|role|path|id|value|class):(.*)$') {
      $k = $Matches[1]; $v = $Matches[2]
      if ($k -eq 'name') { $s.name = if ($s.name) { "$($s.name) $v" } else { $v } } else { $s[$k] = $v }
    } else { $s.name = if ($s.name) { "$($s.name) $w" } else { $w } }
  }
  return $s
}

function Matches($s, $n) {
  if ($s.path -and $n.path -ne $s.path) { return $false }
  if ($s.role -and $n.role.ToLower() -ne $s.role.ToLower().Replace('ax', '')) { return $false }
  if ($s.id -and $n.id -ne $s.id) { return $false }
  # The window class (TsdImageButton, Edit…): the one steady cue in apps whose names are
  # the text they show and whose ids are window handles that change on every launch.
  if ($s.class -and ([string]$n.class).ToLower() -ne $s.class.ToLower()) { return $false }
  if ($s.value -and -not (([string]$n.value).ToLower().Contains($s.value.ToLower()))) { return $false }
  if ($s.name) {
    $q = $s.name.ToLower()
    $hay = @($n.title, $n.help, $n.id) | Where-Object { $_ } | ForEach-Object { $_.ToLower() }
    if (-not ($hay | Where-Object { $_.Contains($q) })) { return $false }
  }
  return $true
}

function Combine($conds) {
  if ($conds.Count -eq 0) { return [System.Windows.Automation.Condition]::TrueCondition }
  if ($conds.Count -eq 1) { return $conds[0] }
  return New-Object System.Windows.Automation.AndCondition([System.Windows.Automation.Condition[]]$conds)
}

# The app searches itself: UI Automation's FindAll runs inside the app with the cues as a
# condition and the cache request for the rest, one round trip, where a walk from here
# was one round trip per property per element. An exact name is tried first (the
# tie-break a press makes anyway); only when nothing is called exactly that does the
# search widen to the old "contains" over name, help and id.
function Search($procId, $s) {
  $ignoreCase = [System.Windows.Automation.PropertyConditionFlags]::IgnoreCase
  $conds = @()
  if ($s.role) {
    $ct = [System.Windows.Automation.ControlType]::($s.role -replace '^(?i)ax', '')
    if ($ct) { $conds += New-Object System.Windows.Automation.PropertyCondition($AE::ControlTypeProperty, $ct) }
  }
  if ($s.id) { $conds += New-Object System.Windows.Automation.PropertyCondition($AE::AutomationIdProperty, $s.id) }
  if ($s.class) { $conds += New-Object System.Windows.Automation.PropertyCondition($AE::ClassNameProperty, $s.class, $ignoreCase) }
  $roots = AppRoots $procId
  $hits = New-Object System.Collections.ArrayList
  $clock = [Diagnostics.Stopwatch]::StartNew()
  $active = $Cache.Activate()
  try {
    if ($s.name) {
      # The words may be the control's name, its help text (MediaShout's toolbar) or its id.
      $called = New-Object System.Windows.Automation.OrCondition([System.Windows.Automation.Condition[]]@(
        (New-Object System.Windows.Automation.PropertyCondition($AE::NameProperty, $s.name, $ignoreCase)),
        (New-Object System.Windows.Automation.PropertyCondition($AE::HelpTextProperty, $s.name, $ignoreCase)),
        (New-Object System.Windows.Automation.PropertyCondition($AE::AutomationIdProperty, $s.name, $ignoreCase))))
      $exact = Combine ($conds + $called)
      foreach ($r in $roots) { foreach ($e in $r.FindAll([System.Windows.Automation.TreeScope]::Subtree, $exact)) { $null = $hits.Add($e) } }
    }
    if ($hits.Count -eq 0) {
      $wide = Combine $conds
      foreach ($r in $roots) { foreach ($e in $r.FindAll([System.Windows.Automation.TreeScope]::Subtree, $wide)) { $null = $hits.Add($e) } }
    }
  } finally { $active.Dispose(); Spent 'find' $clock }
  $clock = [Diagnostics.Stopwatch]::StartNew()
  $found = New-Object System.Collections.ArrayList
  foreach ($e in $hits) { $n = Describe $e $null 0; if (Matches $s $n) { $null = $found.Add($n) } }
  Spent "describe$($hits.Count)" $clock
  return ,$found
}

$script:knownElements = @{}
function Collect($procId, $s, $all) {
  if ($s.path) {
    $el = Resolve $procId $s.path
    if ($el) {
      $node = Describe $el $s.path (($s.path -split '/').Count - 1)
      if (Matches $s $node) { return ,@($node) }
    }
    # The path is where the control was; its id, name or class is what it is. A tree that
    # has shifted (a list that loaded, a panel that grew) moves the path, not the control,
    # so when the path no longer holds, the other cues are searched for on their own.
    if (-not ($s.id -or $s.name -or $s.class)) { return ,@() }
    $loose = @{}; foreach ($k in $s.Keys) { if ($k -ne 'path') { $loose[$k] = $s[$k] } }
    $s = $loose
  }
  # A search through a big app costs a second or two even inside it. The same button is
  # pressed every service - Fire, Next, Stop - so the control a selector resolved to is
  # kept, and the next request only checks it is still there and still answers to the
  # cues (a gone element throws; a renamed one no longer matches); either way a fresh
  # search follows.
  $key = "$procId|" + (($s.Keys | Sort-Object | ForEach-Object { "$_=$($s[$_])" }) -join '|')
  $known = $script:knownElements[$key]
  if ($known) {
    $clock = [Diagnostics.Stopwatch]::StartNew()
    $still = $null
    try { $still = Describe $known $null 0 $true } catch { $still = $null }
    Spent 'known' $clock
    if ($still -and (Matches $s $still)) { return ,@($still) }
    $script:knownElements.Remove($key)
  }
  $found = Search $procId $s
  if ($found.Count -eq 1) { $script:knownElements[$key] = $found[0]._el }
  $q = if ($s.name) { $s.name.ToLower() } else { $null }
  $sorted = $found | Sort-Object -Property @{ Expression = { if ($q -and ([string]$_.title).ToLower() -eq $q) { 0 } else { 1 } } }, @{ Expression = { if ($_.actions -contains 'press') { 0 } else { 1 } } }
  return ,@($sorted)
}

function Strip($n) { $c = [ordered]@{}; foreach ($k in $n.Keys) { if ($k -ne '_el') { $c[$k] = $n[$k] } }; return $c }

function Pick($found, $first, $what) {
  # ($found, not $matches: -match below writes PowerShell's automatic $Matches.)
  if ($found.Count -eq 0) { Fail "nothing matches $what" }
  # "Live" must not be a coin toss between Live and Go Live: when exactly one match is
  # called precisely what was asked for, that one is meant. (Collect sorts it first.)
  if ($found.Count -gt 1 -and $what -match '(?:^|\s)name:(.+?)(?:\s+(?:role|path|id|class|value):|$)') {
    $exactName = $Matches[1].Trim().ToLower()
    $exact = @($found | Where-Object { ([string]$_.title).ToLower() -eq $exactName })
    if ($exact.Count -eq 1) { return $exact[0] }
  }
  if ($found.Count -gt 1 -and -not $first) {
    Fail "$($found.Count) elements match $what — add role:/path: to say which, or --first" @{ matches = @($found | Select-Object -First 20 | ForEach-Object { Strip $_ }) }
  }
  return $found[0]
}

# The control a press or a type is aimed at, waited for: an app that is still opening a
# panel has not drawn the button yet, or has it greyed until its list loads (MediaShout
# enables Insert Bible a few seconds after Enter). A fast inspector arrives before that,
# so a missing or disabled control is looked for again every quarter second, up to
# --patience ms (5 s unless said otherwise), and only then refused. More than one match
# is refused at once: time does not make a selector less ambiguous.
function Aim($procId, $words, $first, $all) {
  $sel = ParseSelector $words
  $what = ($words -join ' ')
  $deadline = (Get-Date).AddMilliseconds((IntFlag 'patience' 5000))
  while ($true) {
    $found = Collect $procId $sel $all
    $target = $null; $why = $null
    if ($found.Count -eq 0) { $why = 'missing' }
    else {
      $target = Pick $found $first $what
      if (-not $target.enabled) { $why = 'disabled' }
    }
    $script:trace['tries'] = [int]$script:trace['tries'] + 1
    if (-not $why) { return $target }
    if ((Get-Date) -ge $deadline) {
      if ($why -eq 'missing') { Fail "nothing matches $what" }
      Fail "`"$($target.title)`" is disabled right now" @{ element = (Strip $target) }
    }
    Start-Sleep -Milliseconds 250
  }
}

function PressElement($el, $at = $null, $action = $null) {
  $p = $null
  # A part of the control was asked for ("the right half"): only a real click can mean that.
  if ($at) { return (ClickCentre $el $at) }
  # --action toggle|select|expand|click: one particular pattern, for a checkable list item
  # that Invoke would merely highlight (OpenLP's download lists) or a menu that must expand.
  switch ($action) {
    'toggle' { if ($el.TryGetCurrentPattern([System.Windows.Automation.TogglePattern]::Pattern, [ref]$p)) { $p.Toggle(); return 'Toggle' }; return $null }
    'select' { if ($el.TryGetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern, [ref]$p)) { $p.Select(); return 'Select' }; return $null }
    'expand' { if ($el.TryGetCurrentPattern([System.Windows.Automation.ExpandCollapsePattern]::Pattern, [ref]$p)) { $p.Expand(); return 'Expand' }; return $null }
    'click' { return (ClickCentre $el) }
  }
  if ($el.TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern, [ref]$p)) { $p.Invoke(); return 'Invoke' }
  if ($el.TryGetCurrentPattern([System.Windows.Automation.TogglePattern]::Pattern, [ref]$p)) { $p.Toggle(); return 'Toggle' }
  if ($el.TryGetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern, [ref]$p)) { $p.Select(); return 'Select' }
  if ($el.TryGetCurrentPattern([System.Windows.Automation.ExpandCollapsePattern]::Pattern, [ref]$p)) { $p.Expand(); return 'Expand' }
  # Last resort: a real click at its centre — the element has no pattern but is on screen.
  return (ClickCentre $el)
}

# A real mouse click on the middle of an element; $null when it has no place on screen.
# Delphi apps (EasyWorship) draw their buttons and boxes without any UI Automation
# pattern, so this is how most of their controls get pressed or focused.
function ClickCentre($el, $at = $null) {
  $r = $el.Current.BoundingRectangle
  if ($r.IsEmpty) { return $null }
  # --at left|right: a quarter of the way in from that side — EasyWorship's previous/next arrows
  # are the two halves of one drawn panel, one element to UI Automation.
  $frac = switch ($at) { 'left' { 0.25 } 'right' { 0.75 } default { 0.5 } }
  $x = [int]($r.X + $r.Width * $frac); $y = [int]($r.Y + $r.Height / 2)
  if (-not ('W.M' -as [type])) {
    Add-Type -MemberDefinition '[DllImport("user32.dll")] public static extern void mouse_event(uint f, uint x, uint y, uint d, UIntPtr i);' -Name M -Namespace W
  }
  # Arrive like a hand would — two real moves onto the spot, then down, a beat, up. Drawn
  # controls (EasyWorship's toolbar buttons and its previous/next arrows) decide what is under
  # the pointer from the move messages, so a pointer that appears from nowhere presses nothing.
  $b = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
  $nx = [uint32]([double]$x * 65535 / [Math]::Max(1, $b.Width - 1)); $ny = [uint32]([double]$y * 65535 / [Math]::Max(1, $b.Height - 1))
  $ABS_MOVE = [uint32]0x8001
  [W.M]::mouse_event($ABS_MOVE, [Math]::Max(0, $nx - 40), $ny, 0, [UIntPtr]::Zero); Start-Sleep -Milliseconds 40
  [W.M]::mouse_event($ABS_MOVE, $nx, $ny, 0, [UIntPtr]::Zero); Start-Sleep -Milliseconds 80
  [W.M]::mouse_event(2, 0, 0, 0, [UIntPtr]::Zero); Start-Sleep -Milliseconds 60
  [W.M]::mouse_event(4, 0, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 120
  return 'Click'
}

function Activate($procId) {
  $clock = [Diagnostics.Stopwatch]::StartNew()
  try { ActivateNow $procId } finally { Spent 'activate' $clock }
}
function ActivateNow($procId) {
  if (-not ('W.F' -as [type])) { Add-Type -MemberDefinition '[DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);' -Name F -Namespace W -ErrorAction SilentlyContinue }
  $h = (Get-Process -Id $procId).MainWindowHandle
  if ($h -ne 0) { [void][W.F]::SetForegroundWindow($h) }
}

# ---------------------------------------------------------------- commands

function Dispatch([string[]]$words) {
ParseArgs $words
if ($positional.Count -eq 0) { Fail 'usage: trilorah-inspect check|apps|see|find|press|type|menu|focus|key|watch|serve …' @{} 2 }
$command = $positional[0]

switch ($command) {
  'check' {
    $elevated = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    return ([ordered]@{ ok = $true; trusted = $true; elevated = $elevated; note = 'UI Automation needs no permission on Windows; an app run "as administrator" is only visible if this is too' })
  }
  'apps' { return ([ordered]@{ ok = $true; apps = (RunningApps) }) }
  'see' {
    if ($positional.Count -lt 2) { Fail 'see which app?' @{} 2 }
    $app = FindApp $positional[1]
    $all = $switches.ContainsKey('all')
    $nodes = New-Object System.Collections.ArrayList
    $trunc = Walk $app.pid (IntFlag 'depth' 14) (IntFlag 'limit' 6000) (IntFlag 'children' 200) 25 (-not $all) { param($n) if ($all -or (Interesting $n)) { $null = $nodes.Add($n) } }
    if ($switches.ContainsKey('pretty')) {
      [Console]::Out.WriteLine("$($app.name) (pid $($app.pid)) — $($nodes.Count) elements$(if ($trunc) { ', truncated' })")
      foreach ($n in $nodes) {
        $line = ('  ' * $n.depth) + $n.role
        if ($n.title) { $line += "  `"$($n.title)`"" }
        if ($n.value -and $n.value -ne $n.title) { $line += "  = " + ([string]$n.value).Substring(0, [Math]::Min(60, ([string]$n.value).Length)) }
        if (-not $n.enabled) { $line += '  (disabled)' }
        if ($n.actions -contains 'press') { $line += '  [press]' }
        [Console]::Out.WriteLine($line + "   ·" + $n.path)
      }
      return $null
    } else {
      return ([ordered]@{ ok = $true; app = $app; truncated = $trunc; count = $nodes.Count; elements = @($nodes | ForEach-Object { Strip $_ }) })
    }
  }
  'find' {
    if ($positional.Count -lt 3) { Fail 'find <app> <selector…>' @{} 2 }
    $app = FindApp $positional[1]
    $sel = ParseSelector $positional[2..($positional.Count - 1)]
    $m = Collect $app.pid $sel $switches.ContainsKey('all')
    # The same tie-break a press makes: one control called exactly the name asked for counts as the one match.
    if ($m.Count -gt 1 -and $sel.name) { $exact = @($m | Where-Object { ([string]$_.title).ToLower() -eq $sel.name.ToLower() }); if ($exact.Count -eq 1) { $m = $exact } }
    return ([ordered]@{ ok = $true; count = $m.Count; matches = @($m | Select-Object -First 50 | ForEach-Object { Strip $_ }) })
  }
  'press' {
    if ($positional.Count -lt 3) { Fail 'press <app> <selector…>' @{} 2 }
    $app = FindApp $positional[1]
    $target = Aim $app.pid $positional[2..($positional.Count - 1)] $switches.ContainsKey('first') $switches.ContainsKey('all')
    $at = if ($flags.ContainsKey('at') -and @('left', 'right') -contains $flags['at']) { $flags['at'] } else { $null }
    # Bring the app forward first: a click that also has to wake a background window is
    # spent on the waking in some drawn controls (EasyWorship's live arrows), and does nothing else.
    Activate $app.pid; Start-Sleep -Milliseconds 150
    $clock = [Diagnostics.Stopwatch]::StartNew()
    $how = PressElement $target._el $at $flags['action']
    Spent 'press' $clock
    if (-not $how) {
      $why = if ($flags['action']) { 'it has no "' + $flags['action'] + '" action' } else { 'no action and not on screen' }
      Fail "could not press `"$($target.title)`" — $why" @{ element = (Strip $target) }
    }
    return ([ordered]@{ ok = $true; action = $how; element = (Strip $target) })
  }
  'type' {
    if ($positional.Count -lt 3 -or -not $flags.ContainsKey('text')) { Fail 'type <app> <selector…> --text "…" [--submit]' @{} 2 }
    $app = FindApp $positional[1]
    $what = ($positional[2..($positional.Count - 1)] -join ' ')
    $target = Aim $app.pid $positional[2..($positional.Count - 1)] $switches.ContainsKey('first') $switches.ContainsKey('all')
    $how = 'value'
    $vp = $null
    try { $target._el.SetFocus() } catch {}
    # --keys: type it as a person would even where the box could be set in one go.
    if (-not $switches.ContainsKey('keys') -and $target._el.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern, [ref]$vp) -and -not $vp.Current.IsReadOnly) {
      $vp.SetValue($flags['text'])
    } else {
      Activate $app.pid; Start-Sleep -Milliseconds 150
      try { $target._el.SetFocus() } catch {}
      # A box UI Automation cannot focus (a drawn Delphi edit) still takes a click; without
      # one the keys would land wherever focus happens to be — in EasyWorship, the live pane.
      if (-not $target._el.Current.HasKeyboardFocus) {
        if (-not (ClickCentre $target._el)) { Fail "could not focus `"$what`" — it has no place on screen to click" @{ element = (Strip $target) } }
        if (-not $target._el.Current.HasKeyboardFocus) { Fail "`"$what`" did not take focus, so nothing was typed" @{ element = (Strip $target) } }
      }
      # Replace what the box held (Home, Shift+End: Ctrl+A means other things to some boxes), then
      # type one character at a time — EasyWorship's reference box parses as it goes and turns a
      # burst of "Psalm 23:1" into "Psalm 1:1".
      [System.Windows.Forms.SendKeys]::SendWait('{HOME}+{END}')
      Start-Sleep -Milliseconds 60
      $pace = IntFlag 'pace' 45
      foreach ($ch in $flags['text'].ToCharArray()) {
        [System.Windows.Forms.SendKeys]::SendWait(([string]$ch -replace '([+^%~(){}\[\]])', '{$1}'))
        Start-Sleep -Milliseconds $pace
      }
      $how = 'keys'
    }
    if ($switches.ContainsKey('submit')) {
      # A box set in one go still parses what it was given on its own clock (MediaShout's
      # reference box turns "Psalm" into "Psalms" and only then listens for Enter; an Enter
      # 300 ms after the value was lost, one 2 s after it was heard). So wait for the value
      # to settle - unchanged across two reads, after at least 750 ms - before Enter, two
      # seconds at most. (The one-shot run had this pause by accident, compiling its P/Invoke.)
      if ($how -eq 'value') {
        $clock = [Diagnostics.Stopwatch]::StartNew()
        $t0 = Get-Date; $last = $null
        do {
          Start-Sleep -Milliseconds 150
          $now = try { $vp.Current.Value } catch { $null }
          $waited = ((Get-Date) - $t0).TotalMilliseconds
          $settled = ($now -eq $last) -and ($waited -ge 750)
          $last = $now
        } until ($settled -or $waited -ge 2000)
        Spent 'settle' $clock
      }
      Activate $app.pid; Start-Sleep -Milliseconds 120; [System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
    }
    return ([ordered]@{ ok = $true; typed = $flags['text']; how = $how; element = (Strip $target) })
  }
  'menu' {
    if ($positional.Count -lt 3) { Fail 'menu <app> "File>Open"' @{} 2 }
    $app = FindApp $positional[1]
    $segments = $positional[2] -split '>' | ForEach-Object { $_.Trim().ToLower() }
    $roots = AppRoots $app.pid
    $menuCond = New-Object System.Windows.Automation.PropertyCondition($AE::ControlTypeProperty, [System.Windows.Automation.ControlType]::MenuBar)
    $bar = $null
    foreach ($r in $roots) { $bar = $r.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $menuCond); if ($bar) { break } }
    if (-not $bar) { Fail 'the app has no menu bar UI Automation can see' }
    $current = $bar; $trail = @()
    foreach ($seg in $segments) {
      $pool = Children $current
      $next = $pool | Where-Object { ([string]$_.Current.Name).ToLower().TrimEnd('.') -eq $seg } | Select-Object -First 1
      if (-not $next) { $next = $pool | Where-Object { ([string]$_.Current.Name).ToLower().Contains($seg) } | Select-Object -First 1 }
      if (-not $next) { Fail "no menu item `"$seg`" under $(if ($trail.Count) { $trail -join ' > ' } else { 'the menu bar' })" @{ available = @($pool | ForEach-Object { $_.Current.Name }) } }
      $trail += $next.Current.Name
      # Opening a menu is a press; its items only exist once it is open.
      $ec = $null
      if ($next.TryGetCurrentPattern([System.Windows.Automation.ExpandCollapsePattern]::Pattern, [ref]$ec)) { $ec.Expand(); Start-Sleep -Milliseconds 120 }
      $current = $next
    }
    if (-not $current.Current.IsEnabled) { Fail "`"$($trail -join ' > ')`" is disabled right now" }
    $how = PressElement $current
    return ([ordered]@{ ok = [bool]$how; pressed = $trail })
  }
  'focus' {
    if ($positional.Count -lt 2) { Fail 'focus <app>' @{} 2 }
    $app = FindApp $positional[1]; Activate $app.pid
    return ([ordered]@{ ok = $true; app = $app.name })
  }
  'key' {
    if ($positional.Count -lt 3) { Fail 'key <app> <keys>  e.g. ctrl+enter, f5, escape' @{} 2 }
    $app = FindApp $positional[1]; Activate $app.pid; Start-Sleep -Milliseconds 120
    $parts = $positional[2].ToLower() -split '\+'
    $mods = ''; $keyName = ''
    foreach ($p in $parts) { switch ($p) { 'ctrl' { $mods += '^' } 'control' { $mods += '^' } 'shift' { $mods += '+' } 'alt' { $mods += '%' } default { $keyName = $p } } }
    $named = @{ enter = '{ENTER}'; return = '{ENTER}'; tab = '{TAB}'; space = ' '; delete = '{DEL}'; backspace = '{BS}'; escape = '{ESC}'; esc = '{ESC}'; left = '{LEFT}'; right = '{RIGHT}'; up = '{UP}'; down = '{DOWN}'; home = '{HOME}'; end = '{END}'; pageup = '{PGUP}'; pagedown = '{PGDN}' }
    $k = if ($named.ContainsKey($keyName)) { $named[$keyName] } elseif ($keyName -match '^f(\d+)$') { "{F$($Matches[1])}" } else { $keyName }
    [System.Windows.Forms.SendKeys]::SendWait("$mods$k")
    return ([ordered]@{ ok = $true; keys = $positional[2]; app = $app.name })
  }
  'watch' {
    if ($positional.Count -lt 2) { Fail 'watch <app> [--count N] [--seconds N]' @{} 2 }
    $app = FindApp $positional[1]
    $want = IntFlag 'count' 1; $seconds = IntFlag 'seconds' 60
    # The P/Invoke names System.Drawing.Point, and Add-Type's compiler references only System.dll on its
    # own: without System.Drawing the type never compiles, [W.K] does not exist, the next line throws and
    # the watch ends before it begins — which the app used to read as "the operator skipped".
    try {
      Add-Type -ReferencedAssemblies System.Drawing -MemberDefinition '[DllImport("user32.dll")] public static extern short GetAsyncKeyState(int k); [DllImport("user32.dll")] public static extern bool GetCursorPos(out System.Drawing.Point p);' -Name K -Namespace W
    } catch { Fail "the click watcher could not start: $($_.Exception.Message)" }
    [Console]::Error.WriteLine("watching $($app.name) — click the control you want to teach ($want click(s), up to ${seconds}s)")
    $recorded = @(); $deadline = (Get-Date).AddSeconds($seconds); $wasDown = $false
    while ($recorded.Count -lt $want -and (Get-Date) -lt $deadline) {
      $down = ([W.K]::GetAsyncKeyState(1) -band 0x8000) -ne 0
      if ($down -and -not $wasDown) {
        $pt = New-Object System.Drawing.Point; [void][W.K]::GetCursorPos([ref]$pt)
        try {
          $el = $AE::FromPoint((New-Object System.Windows.Point($pt.X, $pt.Y)))
          if ($el -and $el.Current.ProcessId -eq $app.pid) {
            # The control a recipe should press: the clicked element or its nearest pressable ancestor.
            $control = $el
            for ($up = 0; $up -lt 4; $up++) {
              $pats = Patterns $control
              if (($pats -contains 'Invoke') -or ($pats -contains 'Toggle') -or ($pats -contains 'SelectionItem')) { break }
              $parent = $Walker.GetParent($control); if (-not $parent) { break }; $control = $parent
            }
            # Its path: climb to the top window counting positions among siblings.
            $indices = @(); $cur = $control; $path = $null
            for ($g = 0; $g -lt 40; $g++) {
              $parent = $Walker.GetParent($cur)
              if (-not $parent -or $parent -eq $AE::RootElement) {
                $roots = AppRoots $app.pid
                for ($ri = 0; $ri -lt $roots.Count; $ri++) { if ([System.Windows.Automation.Automation]::Compare($roots[$ri], $cur)) { $path = (@("$ri") + $indices) -join '/'; break } }
                break
              }
              $sib = Children $parent; $pos = -1
              for ($si = 0; $si -lt $sib.Count; $si++) { if ([System.Windows.Automation.Automation]::Compare($sib[$si], $cur)) { $pos = $si; break } }
              if ($pos -lt 0) { break }
              $indices = @("$pos") + $indices; $cur = $parent
            }
            $node = Describe $control $(if ($path) { $path } else { '?' }) 0
            $rec = Strip $node; $rec.clickedAt = @{ x = $pt.X; y = $pt.Y }
            $recorded += $rec
            # Stream the click the moment it lands, one compact line, so the caller can show the
            # trail growing and keep it when the operator ends the watch early ("that's it").
            [Console]::Out.WriteLine('{"click":' + ($rec | ConvertTo-Json -Depth 8 -Compress) + '}')
            [Console]::Error.WriteLine("  recorded: $($node.role) `"$($node.title)`" at $($rec.path)")
          }
        } catch {}
      }
      $wasDown = $down
      Start-Sleep -Milliseconds 15
    }
    Emit ([ordered]@{ ok = ($recorded.Count -ge $want); wanted = $want; recorded = $recorded; note = $(if ($recorded.Count -ge $want) { 'recorded' } else { "time ran out before $want click(s) landed in $($app.name)" }) })
    exit $(if ($recorded.Count -ge $want) { 0 } else { 1 })
  }
  default { Fail "unknown command `"$command`" — check|apps|see|find|press|type|menu|focus|key|watch|serve" @{} 2 }
}
}

# ---------------------------------------------------------------- running

# `serve`: stay up and answer requests, one JSON line in ({"id":…,"args":[…]}), one out
# ({"id":…,"result":{…}}). Starting PowerShell and loading UI Automation costs five or
# six seconds on an ordinary PC; Trilorah pays that once per session instead of per click.
function Serve() {
  $script:serving = $true
  # Spawned by an app, this process may inherit a lower priority or Windows' "efficiency
  # mode" (power throttling). Ask for normal speed and a little priority - it costs nothing
  # and this is the hand on the church's screen.
  try {
    [Diagnostics.Process]::GetCurrentProcess().PriorityClass = 'AboveNormal'
    if (-not ('W.P' -as [type])) {
      Add-Type -Name P -Namespace W -MemberDefinition @'
[StructLayout(LayoutKind.Sequential)] public struct PPTS { public uint Version; public uint ControlMask; public uint StateMask; }
[DllImport("kernel32.dll", SetLastError = true)] public static extern bool SetProcessInformation(IntPtr h, int cls, ref PPTS s, int size);
[DllImport("kernel32.dll")] public static extern IntPtr GetCurrentProcess();
public static bool FullSpeed() {
  PPTS s = new PPTS(); s.Version = 1; s.ControlMask = 1; s.StateMask = 0;
  return SetProcessInformation(GetCurrentProcess(), 4, ref s, Marshal.SizeOf(typeof(PPTS)));
}
'@
    }
    [void][W.P]::FullSpeed()
  } catch {}
  [Console]::OutputEncoding = [Text.Encoding]::UTF8
  $in = New-Object IO.StreamReader([Console]::OpenStandardInput(), [Text.Encoding]::UTF8)
  Emit ([ordered]@{ ok = $true; serving = $true })
  while ($true) {
    $line = $in.ReadLine()
    if ($line -eq $null) { break }
    if (-not $line.Trim()) { continue }
    $req = $null
    try { $req = ConvertFrom-Json $line } catch { Emit ([ordered]@{ ok = $false; error = 'not a request' }); continue }
    $words = @(); if ($req.args) { $words = @($req.args | ForEach-Object { [string]$_ }) }
    $answer = $null
    $script:trace = [ordered]@{}
    $clock = [Diagnostics.Stopwatch]::StartNew()
    if ($words.Count -gt 0 -and @('serve', 'watch') -contains $words[0]) {
      $answer = [ordered]@{ ok = $false; error = "$($words[0]) runs as its own process, not inside the server" }
    } else {
      try { $answer = Dispatch $words }
      catch [InspectFailure] { $answer = $_.Exception.Body }
      catch { $answer = [ordered]@{ ok = $false; error = "the inspector hit an error: $($_.Exception.Message)" } }
    }
    if ($answer -eq $null) { $answer = [ordered]@{ ok = $true } }
    Emit ([ordered]@{ id = $req.id; ms = [int]$clock.ElapsedMilliseconds; trace = $script:trace; result = $answer })
  }
}

if ($Argv.Count -ge 1 -and $Argv[0] -eq 'serve') { Serve; exit 0 }
try {
  $out = Dispatch $Argv
  if ($out -ne $null) { Emit $out }
  exit 0
} catch [InspectFailure] {
  Emit $_.Exception.Body
  exit $_.Exception.Code
} catch {
  Emit ([ordered]@{ ok = $false; error = "the inspector hit an error: $($_.Exception.Message)" })
  exit 1
}
