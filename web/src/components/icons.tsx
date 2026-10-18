'use client';

import {
  MagnifyingGlass as DuoMagnifyingGlass,
  Pencil as DuoPencil,
  Pause as DuoPause,
  Play as DuoPlay,
  Clock as DuoClock,
  Upload as DuoUpload,
  Archive as DuoArchive,
  ArrowDown as DuoArrowDown,
  ArrowLeft as DuoArrowLeft,
  ArrowRight as DuoArrowRight,
  ArrowUpRight as DuoArrowUpRight,
  ArrowsClockwise as DuoArrowsClockwise,
  BookOpen as DuoBookOpen,
  Check as DuoCheck,
  ChevronDown as DuoChevronDown,
  ChevronLeft as DuoChevronLeft,
  ChevronRight as DuoChevronRight,
  Copy as DuoCopy,
  Download as DuoDownload,
  FileText as DuoFileText,
  Headphones as DuoHeadphones,
  Link as DuoLink,
  Microphone as DuoMicrophone,
  MicrophoneSlash as DuoMicrophoneSlash,
  Minus as DuoMinus,
  Plus as DuoPlus,
  SlidersHorizontal as DuoSlidersHorizontal,
  SquaresFour as DuoSquaresFour,
  Wallet as DuoWallet,
  X as DuoX,
} from '@nubo-icons/react/duo';
import {
  MagnifyingGlass as NuboMagnifyingGlass,
  Pencil as NuboPencil,
  Pause as NuboPause,
  Play as NuboPlay,
  Clock as NuboClock,
  Upload as NuboUpload,
  Archive as NuboArchive,
  ArrowDown as NuboArrowDown,
  ArrowLeft as NuboArrowLeft,
  ArrowRight as NuboArrowRight,
  ArrowUpRight as NuboArrowUpRight,
  ArrowsClockwise as NuboArrowsClockwise,
  BookOpen as NuboBookOpen,
  Check as NuboCheck,
  ChevronDown as NuboChevronDown,
  ChevronLeft as NuboChevronLeft,
  ChevronRight as NuboChevronRight,
  Copy as NuboCopy,
  Download as NuboDownload,
  FileText as NuboFileText,
  Headphones as NuboHeadphones,
  Link as NuboLink,
  Microphone as NuboMicrophone,
  MicrophoneSlash as NuboMicrophoneSlash,
  Minus as NuboMinus,
  Plus as NuboPlus,
  SlidersHorizontal as NuboSlidersHorizontal,
  SquaresFour as NuboSquaresFour,
  Wallet as NuboWallet,
  X as NuboX,
  type NuboIcon as NuboComponent,
} from '@nubo-icons/react';
import { forwardRef, type SVGProps } from 'react';
import { NUBO_ICON_MAP } from '../../../shared/icons/nubo';

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'children' | 'dangerouslySetInnerHTML' | 'name'> {
  size?: number;
  /** Selected controls use the official Nubo Duo glyph. */
  selected?: boolean;
  label?: string;
  /** Compatibility with the previous API; Nubo glyphs stay still. */
  animated?: boolean;
  title?: string;
}

type WebIconName = 'save' | 'export' | 'history' | 'play' | 'pause' | 'pencil' | 'search' | 'soundwave' | 'bible' | 'note' | 'hand-coins' | 'copy' | 'link' | 'plus' | 'chevron-down' | 'headphones' | 'arrow-down' | 'arrow-left' | 'arrow-right' | 'tuning' | 'minus' | 'reset' | 'check' | 'download' | 'qr' | 'microphone' | 'microphone-off' | 'close' | 'arrow-up-right' | 'chevron-left' | 'chevron-right';
const glyphs = {
  MagnifyingGlass: NuboMagnifyingGlass,
  Pencil: NuboPencil,
  Pause: NuboPause,
  Play: NuboPlay,
  Clock: NuboClock,
  Upload: NuboUpload,
  Archive: NuboArchive,
  ArrowDown: NuboArrowDown,
  ArrowLeft: NuboArrowLeft,
  ArrowRight: NuboArrowRight,
  ArrowUpRight: NuboArrowUpRight,
  ArrowsClockwise: NuboArrowsClockwise,
  BookOpen: NuboBookOpen,
  Check: NuboCheck,
  ChevronDown: NuboChevronDown,
  ChevronLeft: NuboChevronLeft,
  ChevronRight: NuboChevronRight,
  Copy: NuboCopy,
  Download: NuboDownload,
  FileText: NuboFileText,
  Headphones: NuboHeadphones,
  Link: NuboLink,
  Microphone: NuboMicrophone,
  MicrophoneSlash: NuboMicrophoneSlash,
  Minus: NuboMinus,
  Plus: NuboPlus,
  SlidersHorizontal: NuboSlidersHorizontal,
  SquaresFour: NuboSquaresFour,
  Wallet: NuboWallet,
  X: NuboX,
};

const duoGlyphs = { MagnifyingGlass: DuoMagnifyingGlass, Pencil: DuoPencil, Pause: DuoPause, Play: DuoPlay, Clock: DuoClock, Upload: DuoUpload, Archive: DuoArchive, ArrowDown: DuoArrowDown, ArrowLeft: DuoArrowLeft, ArrowRight: DuoArrowRight, ArrowUpRight: DuoArrowUpRight, ArrowsClockwise: DuoArrowsClockwise, BookOpen: DuoBookOpen, Check: DuoCheck, ChevronDown: DuoChevronDown, ChevronLeft: DuoChevronLeft, ChevronRight: DuoChevronRight, Copy: DuoCopy, Download: DuoDownload, FileText: DuoFileText, Headphones: DuoHeadphones, Link: DuoLink, Microphone: DuoMicrophone, MicrophoneSlash: DuoMicrophoneSlash, Minus: DuoMinus, Plus: DuoPlus, SlidersHorizontal: DuoSlidersHorizontal, SquaresFour: DuoSquaresFour, Wallet: DuoWallet, X: DuoX };

/** Keep Nubo and React local to the web app; only semantic names are shared. */
export function createNuboIcon(name: WebIconName, defaultSize = 24) {
  const Component = forwardRef<SVGSVGElement, IconProps>(function TrilorahWebIcon(
    { size = defaultSize, selected = false, label, animated: _animated, className = '', style, ...props }, ref,
  ) {
    const Icon: NuboComponent = (selected ? duoGlyphs : glyphs)[NUBO_ICON_MAP[name]];
    void _animated;
    const accessibleLabel = label ?? props['aria-label'];
    const announced = accessibleLabel !== undefined || props['aria-labelledby'] !== undefined || props.title !== undefined;
    return <Icon {...props} ref={ref} size="1em"
      aria-hidden={props['aria-hidden'] ?? (announced ? undefined : true)}
      aria-label={accessibleLabel} role={props.role ?? (announced ? 'img' : undefined)}
      focusable="false" data-icon={name} data-icon-pack="nubo" data-icon-variant={selected ? 'duo' : 'line'}
      className={`tri-icon ${className}`.trim()}
      style={{ display: 'inline-block', flexShrink: 0, verticalAlign: 'middle', fontSize: size, ...style }} />;

  });
  Component.displayName = `TrilorahNubo(${name})`;
  return Component;
}

export const Radio = createNuboIcon('soundwave');
export const BookOpen = createNuboIcon('bible');
export const StickyNote = createNuboIcon('note');
export const HandCoins = createNuboIcon('hand-coins');
export const Copy = createNuboIcon('copy');
export const Link = createNuboIcon('link');
export const Plus = createNuboIcon('plus');
export const ChevronDown = createNuboIcon('chevron-down');
export const Headphones = createNuboIcon('headphones');
export const ArrowDown = createNuboIcon('arrow-down');
export const ArrowLeft = createNuboIcon('arrow-left');
export const ArrowRight = createNuboIcon('arrow-right');
export const Settings2 = createNuboIcon('tuning');
export const Minus = createNuboIcon('minus');
export const RotateCcw = createNuboIcon('reset');
export const Check = createNuboIcon('check');
export const Download = createNuboIcon('download');
export const QrCode = createNuboIcon('qr');
export const Mic = createNuboIcon('microphone');
export const MicOff = createNuboIcon('microphone-off');
export const X = createNuboIcon('close');
export const ArrowUpRight = createNuboIcon('arrow-up-right');
export const ChevronLeft = createNuboIcon('chevron-left');
export const ChevronRight = createNuboIcon('chevron-right');

export const Archive = createNuboIcon('save');
export const Upload = createNuboIcon('export');
export const Clock = createNuboIcon('history');
export const Play = createNuboIcon('play');
export const Pause = createNuboIcon('pause');
export const Pencil = createNuboIcon('pencil');
export const Search = createNuboIcon('search');
