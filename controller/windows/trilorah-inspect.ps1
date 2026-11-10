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
   press <app> <selector…> [--first]
   type <app> <selector…> --text "…" [--submit]
   menu <app> "File>Open"
   focus <app>
   key <app> <keys>                         e.g. f5, ctrl+enter, escape
   watch <app> [--count N] [--seconds N]    record which element the operator clicks

 Selectors as on the Mac: name:<text> (Name/HelpText contains, case-insensitive),
 role:Button (control type), id:<AutomationId>, path:0/3/2 (index path from
 the app's top window list), bare word = name:. An ambiguous press is an error
 unless --first.
#>
param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Argv)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes, System.Windows.Forms

# ---------------------------------------------------------------- output

function Emit($obj) { $obj | ConvertTo-Json -Depth 8 -Compress:$false; }
function Fail($message, $extra = @{}, $code = 1) {
  $body = [ordered]@{ ok = $false; error = $message }
  foreach ($k in $extra.Keys) { $body[$k] = $extra[$k] }
  Emit $body
  exit $code
}

# ---------------------------------------------------------------- arguments

$positional = @(); $flags = @{}; $switches = @{}
$valued = @('depth', 'action', 'text', 'limit', 'children', 'seconds', 'count')
for ($i = 0; $i -lt $Argv.Count; $i++) {
  $a = $Argv[$i]
  if ($a -like '--*') {
    $key = $a.Substring(2)
    if ($valued -contains $key -and $i + 1 -lt $Argv.Count) { $flags[$key] = $Argv[$i + 1]; $i++; continue }
    $switches[$key] = $true
  } else { $positional += $a }
}
function IntFlag($key, $fallback) { if ($flags.ContainsKey($key)) { [int]$flags[$key] } else { $fallback } }

# ---------------------------------------------------------------- UIA helpers

$AE = [System.Windows.Automation.AutomationElement]
$Walker = [System.Windows.Automation.TreeWalker]::ControlViewWalker

function Children($el) {
  $out = @()
  $c = $Walker.GetFirstChild($el)
  while ($c -ne $null) { $out += $c; $c = $Walker.GetNextSibling($c) }
  return ,$out
}

function Patterns($el) {
  $names = @()
  foreach ($p in $el.GetSupportedPatterns()) { $names += ($p.ProgrammaticName -replace 'PatternIdentifiers\.Pattern$', '') }
  return ,$names
}

function Describe($el, $path, $depth) {
  $cur = $el.Current
  $node = [ordered]@{
    path = $path; depth = $depth
    role = ($cur.ControlType.ProgrammaticName -replace '^ControlType\.', '')
  }
  if ($cur.Name) { $node.title = $cur.Name }
  if ($cur.HelpText) { $node.help = $cur.HelpText }
  if ($cur.AutomationId) { $node.id = $cur.AutomationId }
  if ($cur.ClassName) { $node.class = $cur.ClassName }
  $node.enabled = [bool]$cur.IsEnabled
  if ($cur.HasKeyboardFocus) { $node.focused = $true }
  try {
    $vp = $null
    if ($el.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern, [ref]$vp)) {
      $v = $vp.Current.Value; if ($v) { $node.value = [string]$v }
    }
  } catch {}
  $acts = @()
  foreach ($p in (Patterns $el)) {
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
function AppRoots($pid) {
  $cond = New-Object System.Windows.Automation.PropertyCondition($AE::ProcessIdProperty, [int]$pid)
  $found = $AE::RootElement.FindAll([System.Windows.Automation.TreeScope]::Children, $cond)
  $out = @(); foreach ($w in $found) { $out += $w }
  return ,$out
}

function Walk($pid, $maxDepth, $maxNodes, $maxChildren, $maxRows, $compact, [scriptblock]$visit) {
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
  $roots = AppRoots $pid
  for ($i = 0; $i -lt $roots.Count; $i++) { Go $roots[$i] "$i" 0 }
  return $script:truncated
}

function Resolve($pid, $path) {
  $parts = $path -split '/'
  $roots = AppRoots $pid
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
  $out = @()
  foreach ($p in Get-Process | Where-Object { $_.MainWindowHandle -ne 0 }) {
    $out += [ordered]@{ name = $p.ProcessName; title = $p.MainWindowTitle; exe = $(try { [IO.Path]::GetFileName($p.Path) } catch { '' }); pid = $p.Id }
  }
  return ,$out
}

function FindApp($query) {
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
  $s = @{ name = $null; role = $null; path = $null; id = $null; value = $null }
  foreach ($w in $words) {
    if ($w -match '^(name|role|path|id|value):(.*)$') {
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
  if ($s.value -and -not (([string]$n.value).ToLower().Contains($s.value.ToLower()))) { return $false }
  if ($s.name) {
    $q = $s.name.ToLower()
    $hay = @($n.title, $n.help, $n.id) | Where-Object { $_ } | ForEach-Object { $_.ToLower() }
    if (-not ($hay | Where-Object { $_.Contains($q) })) { return $false }
  }
  return $true
}

function Collect($pid, $s, $all) {
  if ($s.path) {
    $el = Resolve $pid $s.path
    if (-not $el) { return ,@() }
    $node = Describe $el $s.path (($s.path -split '/').Count - 1)
    if (Matches $s $node) { return ,@($node) } else { return ,@() }
  }
  $found = New-Object System.Collections.ArrayList
  $null = Walk $pid 14 6000 200 25 (-not $all) { param($n) if (Matches $s $n) { $null = $found.Add($n) } }
  $q = if ($s.name) { $s.name.ToLower() } else { $null }
  $sorted = $found | Sort-Object -Property @{ Expression = { if ($q -and ([string]$_.title).ToLower() -eq $q) { 0 } else { 1 } } }, @{ Expression = { if ($_.actions -contains 'press') { 0 } else { 1 } } }
  return ,@($sorted)
}

function Strip($n) { $c = [ordered]@{}; foreach ($k in $n.Keys) { if ($k -ne '_el') { $c[$k] = $n[$k] } }; return $c }

function Pick($matches, $first, $what) {
  if ($matches.Count -eq 0) { Fail "nothing matches $what" }
  if ($matches.Count -gt 1 -and -not $first) {
    Fail "$($matches.Count) elements match $what — add role:/path: to say which, or --first" @{ matches = @($matches | Select-Object -First 20 | ForEach-Object { Strip $_ }) }
  }
  return $matches[0]
}

function PressElement($el) {
  $p = $null
  if ($el.TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern, [ref]$p)) { $p.Invoke(); return 'Invoke' }
  if ($el.TryGetCurrentPattern([System.Windows.Automation.TogglePattern]::Pattern, [ref]$p)) { $p.Toggle(); return 'Toggle' }
  if ($el.TryGetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern, [ref]$p)) { $p.Select(); return 'Select' }
  if ($el.TryGetCurrentPattern([System.Windows.Automation.ExpandCollapsePattern]::Pattern, [ref]$p)) { $p.Expand(); return 'Expand' }
  # Last resort: a real click at its centre — the element has no pattern but is on screen.
  $r = $el.Current.BoundingRectangle
  if ($r.IsEmpty) { return $null }
  [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point([int]($r.X + $r.Width / 2), [int]($r.Y + $r.Height / 2))
  Add-Type -MemberDefinition '[DllImport("user32.dll")] public static extern void mouse_event(uint f, uint x, uint y, uint d, UIntPtr i);' -Name M -Namespace W
  [W.M]::mouse_event(2, 0, 0, 0, [UIntPtr]::Zero); [W.M]::mouse_event(4, 0, 0, 0, [UIntPtr]::Zero)
  return 'Click'
}

function Activate($pid) {
  Add-Type -MemberDefinition '[DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);' -Name F -Namespace W -ErrorAction SilentlyContinue
  $h = (Get-Process -Id $pid).MainWindowHandle
  if ($h -ne 0) { [void][W.F]::SetForegroundWindow($h) }
}

# ---------------------------------------------------------------- commands

if ($positional.Count -eq 0) { Fail 'usage: trilorah-inspect check|apps|see|find|press|type|menu|focus|key|watch …' @{} 2 }
$command = $positional[0]

switch ($command) {
  'check' {
    $elevated = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    Emit ([ordered]@{ ok = $true; trusted = $true; elevated = $elevated; note = 'UI Automation needs no permission on Windows; an app run "as administrator" is only visible if this is too' })
  }
  'apps' { Emit ([ordered]@{ ok = $true; apps = (RunningApps) }) }
  'see' {
    if ($positional.Count -lt 2) { Fail 'see which app?' @{} 2 }
    $app = FindApp $positional[1]
    $all = $switches.ContainsKey('all')
    $nodes = New-Object System.Collections.ArrayList
    $trunc = Walk $app.pid (IntFlag 'depth' 14) (IntFlag 'limit' 6000) (IntFlag 'children' 200) 25 (-not $all) { param($n) if ($all -or (Interesting $n)) { $null = $nodes.Add($n) } }
    if ($switches.ContainsKey('pretty')) {
      Write-Output "$($app.name) (pid $($app.pid)) — $($nodes.Count) elements$(if ($trunc) { ', truncated' })"
      foreach ($n in $nodes) {
        $line = ('  ' * $n.depth) + $n.role
        if ($n.title) { $line += "  `"$($n.title)`"" }
        if ($n.value -and $n.value -ne $n.title) { $line += "  = " + ([string]$n.value).Substring(0, [Math]::Min(60, ([string]$n.value).Length)) }
        if (-not $n.enabled) { $line += '  (disabled)' }
        if ($n.actions -contains 'press') { $line += '  [press]' }
        Write-Output ($line + "   ·" + $n.path)
      }
    } else {
      Emit ([ordered]@{ ok = $true; app = $app; truncated = $trunc; count = $nodes.Count; elements = @($nodes | ForEach-Object { Strip $_ }) })
    }
  }
  'find' {
    if ($positional.Count -lt 3) { Fail 'find <app> <selector…>' @{} 2 }
    $app = FindApp $positional[1]
    $m = Collect $app.pid (ParseSelector $positional[2..($positional.Count - 1)]) $switches.ContainsKey('all')
    Emit ([ordered]@{ ok = $true; count = $m.Count; matches = @($m | Select-Object -First 50 | ForEach-Object { Strip $_ }) })
  }
  'press' {
    if ($positional.Count -lt 3) { Fail 'press <app> <selector…>' @{} 2 }
    $app = FindApp $positional[1]
    $what = ($positional[2..($positional.Count - 1)] -join ' ')
    $target = Pick (Collect $app.pid (ParseSelector $positional[2..($positional.Count - 1)]) $switches.ContainsKey('all')) $switches.ContainsKey('first') $what
    if (-not $target.enabled) { Fail "`"$($target.title)`" is disabled right now" @{ element = (Strip $target) } }
    $how = PressElement $target._el
    if (-not $how) { Fail "could not press `"$($target.title)`" — no action and not on screen" @{ element = (Strip $target) } }
    Emit ([ordered]@{ ok = $true; action = $how; element = (Strip $target) })
  }
  'type' {
    if ($positional.Count -lt 3 -or -not $flags.ContainsKey('text')) { Fail 'type <app> <selector…> --text "…" [--submit]' @{} 2 }
    $app = FindApp $positional[1]
    $what = ($positional[2..($positional.Count - 1)] -join ' ')
    $target = Pick (Collect $app.pid (ParseSelector $positional[2..($positional.Count - 1)]) $switches.ContainsKey('all')) $switches.ContainsKey('first') $what
    $how = 'value'
    $vp = $null
    try { $target._el.SetFocus() } catch {}
    if ($target._el.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern, [ref]$vp) -and -not $vp.Current.IsReadOnly) {
      $vp.SetValue($flags['text'])
    } else {
      Activate $app.pid; Start-Sleep -Milliseconds 150
      try { $target._el.SetFocus() } catch {}
      [System.Windows.Forms.SendKeys]::SendWait(($flags['text'] -replace '([+^%~(){}\[\]])', '{$1}'))
      $how = 'keys'
    }
    if ($switches.ContainsKey('submit')) { Activate $app.pid; Start-Sleep -Milliseconds 50; [System.Windows.Forms.SendKeys]::SendWait('{ENTER}') }
    Emit ([ordered]@{ ok = $true; typed = $flags['text']; how = $how; element = (Strip $target) })
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
    Emit ([ordered]@{ ok = [bool]$how; pressed = $trail })
  }
  'focus' {
    if ($positional.Count -lt 2) { Fail 'focus <app>' @{} 2 }
    $app = FindApp $positional[1]; Activate $app.pid
    Emit ([ordered]@{ ok = $true; app = $app.name })
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
    Emit ([ordered]@{ ok = $true; keys = $positional[2]; app = $app.name })
  }
  'watch' {
    if ($positional.Count -lt 2) { Fail 'watch <app> [--count N] [--seconds N]' @{} 2 }
    $app = FindApp $positional[1]
    $want = IntFlag 'count' 1; $seconds = IntFlag 'seconds' 60
    Add-Type -MemberDefinition '[DllImport("user32.dll")] public static extern short GetAsyncKeyState(int k); [DllImport("user32.dll")] public static extern bool GetCursorPos(out System.Drawing.Point p);' -Name K -Namespace W -ErrorAction SilentlyContinue
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
  default { Fail "unknown command `"$command`" — check|apps|see|find|press|type|menu|focus|key|watch" @{} 2 }
}
