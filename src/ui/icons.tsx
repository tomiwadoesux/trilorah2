/*
 * Solar Bold is the app's icon family. Import icons through ../ui so every
 * screen uses the same solid filled artwork, currentColor, and sizing defaults.
 * Individual imports keep the other styles and unused icons out of the bundle.
 * The cue monitor is custom artwork using the same solid filled treatment.
 * Artwork: Solar by 480 Design, CC BY 4.0. See THIRD-PARTY-NOTICES.md.
 */
import type { Icon as SolarIcon } from '@solar-icons/react/lib/types';
import { SettingsIcon as SolarSettings } from '@solar-icons/react/bold/settings';
import { TrashBinTrashIcon as SolarTrash } from '@solar-icons/react/bold/trash-bin-trash';
import { RestartIcon as SolarReset } from '@solar-icons/react/bold/restart';
import { AltArrowDownIcon as SolarChevronDown } from '@solar-icons/react/bold/alt-arrow-down';
import { AltArrowLeftIcon as SolarChevronLeft } from '@solar-icons/react/bold/alt-arrow-left';
import { AltArrowRightIcon as SolarChevronRight } from '@solar-icons/react/bold/alt-arrow-right';
import { MagnifierIcon as SolarSearch } from '@solar-icons/react/bold/magnifier';
import { PenIcon as SolarPencil } from '@solar-icons/react/bold/pen';
import { AddIcon as SolarPlus } from '@solar-icons/react/bold/add';
import { ScannerIcon as SolarScan } from '@solar-icons/react/bold/scanner';
import { StarsMinimalisticIcon as SolarSparkle } from '@solar-icons/react/bold/stars-minimalistic';
import { ReelIcon as SolarMedia } from '@solar-icons/react/bold/reel';
import { DocumentTextIcon as SolarNote } from '@solar-icons/react/bold/document-text';
import { GripVerticalIcon as SolarGrip } from '@solar-icons/react/bold/grip-vertical';
import { CheckIcon as SolarCheck } from '@solar-icons/react/bold/check';
import { HistoryIcon as SolarHistory } from '@solar-icons/react/bold/history';
import { Book2Icon as SolarBook } from '@solar-icons/react/bold/book-2';
import { MusicNotesIcon as SolarMusic } from '@solar-icons/react/bold/music-notes';
import { PauseIcon as SolarPause } from '@solar-icons/react/bold/pause';
import { PlayIcon as SolarPlay } from '@solar-icons/react/bold/play';
import { Microphone2Icon as SolarMic } from '@solar-icons/react/bold/microphone-2';
import { ImportIcon as SolarImport } from '@solar-icons/react/bold/import';
import { PresentationGraphIcon as SolarPresentation } from '@solar-icons/react/bold/presentation-graph';
import { QrCodeIcon as SolarQr } from '@solar-icons/react/bold/qr-code';
import { Widget5Icon as SolarDashboard } from '@solar-icons/react/bold/widget-5';
import { UserSpeakRoundedIcon as SolarProfile } from '@solar-icons/react/bold/user-speak-rounded';
import { GlobalIcon as SolarGlobe } from '@solar-icons/react/bold/global';
import { LaptopIcon as SolarLaptop } from '@solar-icons/react/bold/laptop';
import { CloseIcon as SolarClose } from '@solar-icons/react/bold/close';
import { ScissorsIcon as SolarSplit } from '@solar-icons/react/bold/scissors';
import { LayersMinimalisticIcon as SolarMerge } from '@solar-icons/react/bold/layers-minimalistic';
import { CopyIcon as SolarCopy } from '@solar-icons/react/bold/copy';
import { ClipboardTextIcon as SolarClipboard } from '@solar-icons/react/bold/clipboard-text';
import { DocumentAddIcon as SolarAddSong } from '@solar-icons/react/bold/document-add';
import { VideoFramePlayHorizontalIcon as SolarVideoPlay } from '@solar-icons/react/bold/video-frame-play-horizontal';
import { ArrowRightIcon as SolarArrow } from '@solar-icons/react/bold/arrow-right';
import { ClockCircleIcon as SolarClock } from '@solar-icons/react/bold/clock-circle';
import { HandStarsIcon as SolarPrayer } from '@solar-icons/react/bold/hand-stars';
import { GiftIcon as SolarGift } from '@solar-icons/react/bold/gift';
import { WineglassIcon as SolarCup } from '@solar-icons/react/bold/wineglass';
import { PaletteIcon as SolarPalette } from '@solar-icons/react/bold/palette';
import { MaximizeIcon as SolarExpand } from '@solar-icons/react/bold/maximize';
import { MinimizeIcon as SolarMinimize } from '@solar-icons/react/bold/minimize';
import { Buildings2Icon as SolarBank } from '@solar-icons/react/bold/buildings-2';
import { LinkIcon as SolarLink } from '@solar-icons/react/bold/link';

export interface IconProps {
  size?: number;
  className?: string;
}

function icon(Component: SolarIcon, defaultSize = 14) {
  return function Icon({ size = defaultSize, className }: IconProps) {
    return (
      <Component
        aria-hidden="true"
        focusable="false"
        color="currentColor"
        className={className}
        /* 1em SVG dimensions let density classes override the box size. */
        style={{ fontSize: size }}
      />
    );
  };
}

export const SettingsIcon = icon(SolarSettings);
export const TrashIcon = icon(SolarTrash);
export const ResetIcon = icon(SolarReset);
export const ChevronDownIcon = icon(SolarChevronDown, 10);
export const ChevronLeftIcon = icon(SolarChevronLeft);
export const ChevronRightIcon = icon(SolarChevronRight);
export const SearchIcon = icon(SolarSearch);
export const PencilIcon = icon(SolarPencil, 12);
export const PlusIcon = icon(SolarPlus);
export const ScanIcon = icon(SolarScan);
export const SparkleIcon = icon(SolarSparkle);
export const MediaIcon = icon(SolarMedia);
export const NoteIcon = icon(SolarNote);
export const GripIcon = icon(SolarGrip, 16);
export const CheckIcon = icon(SolarCheck, 12);
export const HistoryIcon = icon(SolarHistory);
export const BookIcon = icon(SolarBook);
export const MusicIcon = icon(SolarMusic);
export const PauseIcon = icon(SolarPause, 12);
export const PlayIcon = icon(SolarPlay, 12);
export const MicIcon = icon(SolarMic);
export const ImportIcon = icon(SolarImport);
export const PresentationIcon = icon(SolarPresentation);
export const QrIcon = icon(SolarQr);
export function OperatorIcon({ size = 14, className }: IconProps) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="1em" height="1em" className={className} style={{ fontSize: size }} fill="currentColor">
      <path fillRule="evenodd" clipRule="evenodd" d="M5 3h14a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3ZM11.47 5.47a.75.75 0 0 1 1.06 0l3 3a.75.75 0 0 1-1.06 1.06L12.75 7.81v5.44a.75.75 0 0 1-1.5 0V7.81L9.53 9.53a.75.75 0 0 1-1.06-1.06l3-3Z" />
      <path d="M10 17h4v3h3.25a.75.75 0 0 1 0 1.5H6.75a.75.75 0 0 1 0-1.5H10v-3Z" />
    </svg>
  );
}
export const DashboardIcon = icon(SolarDashboard);
export const ProfileIcon = icon(SolarProfile);
export const GlobeIcon = icon(SolarGlobe);
export const LaptopIcon = icon(SolarLaptop);
export const CloseIcon = icon(SolarClose);
export const SplitIcon = icon(SolarSplit);
export const MergeIcon = icon(SolarMerge);
export const CopyIcon = icon(SolarCopy);
export const ClipboardIcon = icon(SolarClipboard);
export const AddSongIcon = icon(SolarAddSong);
export const VideoPlayIcon = icon(SolarVideoPlay);
export const ArrowIcon = icon(SolarArrow);
export const ClockIcon = icon(SolarClock);
export const PrayerIcon = icon(SolarPrayer);
export const GiftIcon = icon(SolarGift);
export const CupIcon = icon(SolarCup);
export const PaletteIcon = icon(SolarPalette);
export const ExpandIcon = icon(SolarExpand);
export const MinimizeIcon = icon(SolarMinimize);
export const BankIcon = icon(SolarBank);
export const LinkIcon = icon(SolarLink);
