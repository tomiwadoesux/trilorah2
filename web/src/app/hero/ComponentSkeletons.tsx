import type { ReactNode } from 'react';

export const componentSkeletons = [
  { id: 'transcript', name: 'Preacher transcript', detail: 'Speech, a detected reference, and the two search controls.', width: 280, height: 300 },
  { id: 'catch', name: 'Caught scripture', detail: 'Recognition badge, version, passage, and send-live action.', width: 300, height: 210 },
  { id: 'song', name: 'Song card', detail: 'Song identity, lyric preview, arrows, and Go live.', width: 270, height: 270 },
  { id: 'run', name: 'Run of show', detail: 'Square section cards and the dashed add-section tile.', width: 300, height: 252 },
  { id: 'verses', name: 'Scripture library', detail: 'Version and search above the reference-and-text rows.', width: 420, height: 260 },
  { id: 'live', name: 'Live output', detail: 'Live status, Show QR and Display above the screen.', width: 420, height: 270 },
  { id: 'slides', name: 'Slide deck', detail: 'Slide preview, page arrows and count, with edit and delete below.', width: 320, height: 240 },
  { id: 'media', name: 'Media card', detail: 'Picture thumbnail, live and video badges, and file details.', width: 320, height: 240 },
  { id: 'timer', name: 'Service timer', detail: 'The stage clock, standby status, and Start timer control.', width: 320, height: 270 },
  { id: 'notes', name: 'Sermon notes', detail: 'Outline title, numbered points, and generation and export controls.', width: 320, height: 260 },
  { id: 'connections', name: 'Connections', detail: 'Integration names and statuses, with an add-connection row.', width: 320, height: 250 },
  { id: 'outputs', name: 'Output displays', detail: 'Display silhouette, assigned role, and arrows to browse screens.', width: 360, height: 290 },
] as const;

export type SkeletonKind = typeof componentSkeletons[number]['id'];

function Bar({ x, y, width, height = 6, opacity = .18 }: { x: number; y: number; width: number; height?: number; opacity?: number }) {
  return <rect x={x} y={y} width={width} height={height} rx={height / 2} fill="currentColor" fillOpacity={opacity} stroke="none" />;
}

function Lines({ x, y, widths, gap = 17 }: { x: number; y: number; widths: number[]; gap?: number }) {
  return <>{widths.map((width, i) => <Bar key={i} x={x} y={y + i * gap} width={width} />)}</>;
}

function Label({ x, y, children, small = false, muted = false }: { x: number; y: number; children: ReactNode; small?: boolean; muted?: boolean }) {
  return <text x={x} y={y} fill="currentColor" stroke="none" fontSize={small ? 9 : 11} opacity={muted ? .5 : .8} letterSpacing={small ? '.6' : undefined}>{children}</text>;
}

function Box({ x = 1, y = 1, width, height, radius = 8, dashed = false }: { x?: number; y?: number; width: number; height: number; radius?: number; dashed?: boolean }) {
  return <rect x={x} y={y} width={width} height={height} rx={radius} strokeOpacity=".32" strokeDasharray={dashed ? '3 4' : undefined} />;
}

function Icon({ kind, x, y, size = 16 }: { kind: 'mic' | 'book' | 'music' | 'screen' | 'search' | 'plus' | 'play' | 'close' | 'left' | 'right' | 'qr' | 'external' | 'edit' | 'trash'; x: number; y: number; size?: number }) {
  const paths = {
    mic: <><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8" /></>,
    book: <><path d="M12 5C9 3 5 3 2 4v15c4-1 7-1 10 1 3-2 6-2 10-1V4c-3-1-7-1-10 1Zm0 0v15" /></>,
    music: <><path d="M9 18V4l11-2v14M9 8l11-2" /><ellipse cx="6" cy="18" rx="3" ry="2.5" /><ellipse cx="17" cy="16" rx="3" ry="2.5" /></>,
    screen: <><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M12 17v4m-4 0h8" /></>,
    search: <><circle cx="10" cy="10" r="6" /><path d="m15 15 6 6" /></>,
    plus: <path d="M12 4v16M4 12h16" />,
    play: <path d="m7 3 14 9-14 9Z" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    left: <path d="m15 5-7 7 7 7" />,
    right: <path d="m9 5 7 7-7 7" />,
    qr: <><rect x="3" y="3" width="6" height="6" rx="1" /><rect x="15" y="3" width="6" height="6" rx="1" /><rect x="3" y="15" width="6" height="6" rx="1" /><path d="M15 15h6v6h-6z" /></>,
    external: <><path d="M14 3h7v7m0-7-11 11M10 4H4v16h16v-6" /></>,
    edit: <path d="m4 16 12-12 4 4-12 12-5 1Zm10-10 4 4" />,
    trash: <><path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7" /></>,
  };
  return <g transform={`translate(${x} ${y}) scale(${size / 24})`} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity=".7">{paths[kind]}</g>;
}

/** Component proportions and control positions follow the current operator UI.
 * Long content becomes placeholders; these are decorative, not loading states.
 */
export function ComponentSkeleton({ kind }: { kind: SkeletonKind }) {
  let drawing: ReactNode;
  switch (kind) {
    case 'transcript': drawing = <>
      <Box width={278} height={298} />
      <Label x={16} y={25} small>PREACHER TRANSCRIPT</Label>
      <g opacity=".65"><Lines x={16} y={49} widths={[238, 222, 141]} /><Lines x={16} y={112} widths={[232, 201]} /></g>
      <g color="var(--hero-accent, currentColor)"><Box x={16} y={169} width={102} height={24} radius={4} /><Icon kind="book" x={23} y={175} size={12} /><Label x={42} y={185}>Psalms 46:1</Label></g>
      <Lines x={16} y={207} widths={[232, 191]} />
      <Box x={12} y={258} width={124} height={30} radius={4} /><Icon kind="mic" x={21} y={267} size={12} /><Label x={42} y={278}>search song</Label>
      <Box x={142} y={258} width={126} height={30} radius={4} /><Icon kind="mic" x={151} y={267} size={12} /><Label x={171} y={278}>find reference</Label>
    </>; break;
    case 'catch': drawing = <>
      <Box width={298} height={208} />
      <g color="var(--hero-accent, currentColor)"><Box x={16} y={15} width={35} height={18} radius={3} /><Label x={23} y={28} small>said</Label><Bar x={16} y={51} width={158} height={12} opacity={.4} /></g>
      <Label x={258} y={28} small muted>KJV</Label>
      <Lines x={16} y={83} widths={[266, 248, 187]} gap={19} />
      <Bar x={16} y={166} width={94} height={5} />
      <Box x={145} y={151} width={32} height={31} radius={4} /><Icon kind="close" x={155} y={161} size={12} />
      <g color="var(--hero-accent, currentColor)"><Box x={184} y={151} width={99} height={31} radius={4} /><Label x={224} y={171}>live</Label></g>
      <path d="M4 207h216" strokeWidth="2" opacity=".55" />
    </>; break;
    case 'song': drawing = <>
      <Box width={268} height={268} radius={11} />
      <Icon kind="music" x={16} y={15} size={13} /><Bar x={36} y={20} width={65} height={4} /><Icon kind="external" x={241} y={15} size={12} />
      <Bar x={16} y={49} width={152} height={10} opacity={.35} /><Bar x={16} y={70} width={92} height={5} />
      <Lines x={16} y={105} widths={[235, 212, 225, 154]} gap={18} />
      <path d="M1 184h268" opacity=".16" />
      <Label x={16} y={204} small muted>VERSE 1</Label><Bar x={16} y={215} width={34} height={4} />
      <Box x={195} y={195} width={25} height={25} radius={4} /><Icon kind="left" x={203} y={202} size={11} />
      <Box x={228} y={195} width={25} height={25} radius={4} /><Icon kind="right" x={235} y={202} size={11} />
      <g color="var(--hero-accent, currentColor)"><Box x={175} y={232} width={78} height={25} radius={4} /><Icon kind="play" x={185} y={239} size={11} /><Label x={202} y={249}>go live</Label></g>
    </>; break;
    case 'run': drawing = <>
      <Label x={4} y={16} small>RUN OF SHOW</Label><Bar x={4} y={32} width={182} height={4} />
      {(['music', 'mic', 'book', 'screen', 'mic'] as const).map((kind, i) => {
        const x = 3 + i % 3 * 101, y = 54 + Math.floor(i / 3) * 101;
        return <g key={i}><Box x={x} y={y} width={92} height={92} radius={10} /><Icon kind={kind} x={x + 36} y={y + 20} size={20} /><Bar x={x + 19} y={y + 54} width={54} height={5} /><Bar x={x + 30} y={y + 69} width={32} height={4} opacity={.11} /></g>;
      })}
      <Box x={205} y={155} width={92} height={92} radius={10} dashed /><Icon kind="plus" x={240} y={190} size={22} />
    </>; break;
    case 'verses': drawing = <>
      <Box width={418} height={258} />
      <Box x={12} y={12} width={62} height={30} radius={4} /><Label x={23} y={31}>KJV</Label><path d="m59 26 4 4 4-4" opacity=".5" />
      <Box x={82} y={12} width={326} height={30} radius={4} /><Icon kind="search" x={93} y={21} size={12} /><Bar x={117} y={25} width={128} height={4} />
      <Label x={16} y={67} small muted>REFERENCE</Label><Label x={116} y={67} small muted>SCRIPTURE TEXT</Label>
      {[0, 1, 2, 3].map(row => <g key={row} opacity={1 - row * .13}>
        <path d={`M1 ${80 + row * 43}h418`} opacity=".16" />
        <g color="var(--hero-accent, currentColor)"><Bar x={16} y={97 + row * 43} width={76} height={5} opacity={.4} /></g>
        <Lines x={116} y={92 + row * 43} widths={[278, [238, 201, 254, 173][row]]} gap={13} />
      </g>)}
    </>; break;
    case 'live': drawing = <>
      <Box width={418} height={268} />
      <circle cx={20} cy={24} r={4} fill="currentColor" fillOpacity=".65" stroke="none" /><circle cx={20} cy={24} r={8} opacity=".2" /><Label x={36} y={28}>live</Label>
      <Box x={230} y={11} width={84} height={27} radius={4} /><Icon kind="qr" x={239} y={19} size={11} /><Label x={257} y={29}>show qr</Label>
      <Box x={322} y={11} width={84} height={27} radius={4} /><Icon kind="screen" x={331} y={19} size={12} /><Label x={349} y={29}>display</Label>
      <Box x={12} y={50} width={396} height={206} radius={4} />
      <path d="m13 226 74-40 62 23 90-51 57 24 46-22 65 40" opacity=".11" />
      <Bar x={96} y={111} width={228} height={7} /><Bar x={82} y={131} width={256} height={7} /><Bar x={114} y={151} width={192} height={7} /><Bar x={176} y={195} width={68} height={4} />
    </>; break;
    case 'slides': drawing = <>
      <Box width={318} height={179} radius={6} />
      <Bar x={75} y={59} width={170} height={11} opacity={.3} />
      <Bar x={99} y={82} width={122} height={5} /><Lines x={88} y={111} widths={[144, 112]} gap={13} />
      <circle cx={21} cy={90} r={12} opacity=".25" /><Icon kind="left" x={15} y={84} size={12} />
      <circle cx={299} cy={90} r={12} opacity=".25" /><Icon kind="right" x={293} y={84} size={12} />
      <Label x={275} y={165} small muted>1 / 8</Label><Icon kind="external" x={295} y={12} size={12} />
      <Bar x={3} y={200} width={167} height={8} opacity={.3} />
      <Box x={256} y={192} width={26} height={26} radius={4} /><Icon kind="edit" x={263} y={199} size={12} />
      <Box x={290} y={192} width={26} height={26} radius={4} /><Icon kind="trash" x={297} y={199} size={12} />
      <path d="M1 237h318" opacity=".14" />
    </>; break;
    case 'media': drawing = <>
      <Box width={318} height={179} radius={6} />
      <circle cx={226} cy={49} r={18} opacity=".2" />
      <path d="m2 143 63-56 49 38 62-71 64 64 35-24 44 39M2 159l106-29 87 30 70-29 54 18" opacity=".2" />
      <g color="var(--hero-accent, currentColor)"><circle cx={15} cy={19} r={3} fill="currentColor" fillOpacity=".5" stroke="none" /><Label x={25} y={23}>live</Label></g>
      <Box x={286} y={9} width={25} height={25} radius={4} /><Icon kind="trash" x={293} y={16} size={11} />
      <Label x={279} y={166} small>video</Label>
      <Bar x={3} y={198} width={183} height={8} opacity={.3} /><Bar x={3} y={218} width={120} height={5} />
    </>; break;
    case 'timer': drawing = <>
      <Box width={318} height={268} /><Label x={108} y={24} small>SERVICE TIMER</Label>
      <Box x={13} y={43} width={294} height={212} radius={4} />
      <Label x={27} y={66} small muted>SERMON</Label><Bar x={249} y={60} width={43} height={5} />
      <text x={160} y={156} textAnchor="middle" fontFamily="monospace" fontSize={54} letterSpacing={2} stroke="none" fill="var(--hero-accent, currentColor)" fillOpacity=".55">45:00</text>
      <Bar x={92} y={174} width={136} height={4} />
      <Label x={27} y={237} small muted>STAGE TIMER</Label>
      <Box x={202} y={216} width={91} height={27} radius={4} /><Label x={214} y={233} small>START TIMER</Label>
    </>; break;
    case 'notes': drawing = <>
      <Box width={318} height={258} /><Label x={16} y={25} small>SERMON NOTES</Label><Label x={252} y={25} small muted>3 points</Label><Icon kind="right" x={298} y={17} size={10} />
      <Bar x={16} y={52} width={209} height={11} opacity={.35} />
      {[0, 1, 2].map(row => <g key={row}><Label x={18} y={97 + row * 34} muted>{row + 1}.</Label><Bar x={39} y={90 + row * 34} width={[238, 209, 221][row]} height={6} /></g>)}
      <path d="M16 199h288" opacity=".14" />
      <g color="var(--hero-accent, currentColor)"><Box x={13} y={216} width={94} height={29} radius={4} /><Label x={35} y={235}>generate</Label></g>
      <Box x={113} y={216} width={94} height={29} radius={4} /><Label x={149} y={235}>pdf</Label>
      <Box x={213} y={216} width={94} height={29} radius={4} /><Label x={233} y={235}>markdown</Label>
    </>; break;
    case 'connections': drawing = <>
      <Box width={318} height={248} /><Label x={118} y={25} small>CONNECTED</Label>
      {(['OBS Studio', 'vMix', 'Stream Deck', 'Trilorah Cloud'] as const).map((name, row) => <g key={name}>
        <Label x={16} y={63 + row * 38}>{name}</Label>
        <Bar x={238} y={56 + row * 38} width={[48, 25, 48, 38][row]} height={5} />
        <circle cx={299} cy={59 + row * 38} r={3} fill={row % 2 ? 'currentColor' : 'var(--hero-accent, currentColor)'} fillOpacity=".45" stroke="none" />
        <path d={`M16 ${77 + row * 38}h288`} opacity=".14" />
      </g>)}
      <Icon kind="plus" x={17} y={216} size={12} /><Label x={39} y={226} muted>connect something else</Label>
    </>; break;
    case 'outputs': drawing = <>
      <Box width={358} height={288} /><Label x={16} y={25} small>OUTPUTS</Label><Label x={289} y={25} small muted>4 screens</Label>
      <Box x={47} y={46} width={266} height={162} radius={10} /><Box x={56} y={55} width={248} height={138} radius={4} />
      <Lines x={113} y={108} widths={[134, 108, 78]} gap={15} />
      <circle cx={180} cy={201} r={2} fill="currentColor" stroke="none" opacity=".3" /><path d="M168 208v16h24v-16M148 228h64" opacity=".35" />
      <Label x={16} y={252}>projector</Label><Bar x={16} y={265} width={172} height={5} />
      <Icon kind="left" x={275} y={250} size={12} /><Label x={296} y={260} small muted>1/4</Label><Icon kind="right" x={327} y={250} size={12} />
    </>; break;
  }
  return <g fill="none" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" fontFamily="inherit">{drawing}</g>;
}

export function SkeletonCollection({ id, kinds }: { id: string; kinds: readonly SkeletonKind[] }) {
  return <>{kinds.map((kind, index) => {
    const component = componentSkeletons.find(component => component.id === kind)!;
    // Six generous slots let every randomly selected component keep its proportions.
    const scale = Math.min(280 / component.width, 246 / component.height);
    const x = index % 3 * 320 + (320 - component.width * scale) / 2;
    const y = Math.floor(index / 3) * 300 + (300 - component.height * scale) / 2 + [0, 10, -8, 8, -10, 0][index];
    return <g id={`${id}-${kind}`} key={kind} transform={`translate(${x} ${y}) scale(${scale})`}><ComponentSkeleton kind={kind} /></g>;
  })}</>;
}
