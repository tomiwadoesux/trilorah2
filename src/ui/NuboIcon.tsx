import {
  Archive as DuoArchive,
  ArrowClockwise as DuoArrowClockwise,
  ArrowCounterClockwise as DuoArrowCounterClockwise,
  ArrowDown as DuoArrowDown,
  ArrowLeft as DuoArrowLeft,
  ArrowRight as DuoArrowRight,
  ArrowUp as DuoArrowUp,
  ArrowUpRight as DuoArrowUpRight,
  ArrowUpRightFromSquare as DuoArrowUpRightFromSquare,
  ArrowsClockwise as DuoArrowsClockwise,
  ArrowsIn as DuoArrowsIn,
  ArrowsOut as DuoArrowsOut,
  ArrowsUpDown as DuoArrowsUpDown,
  Bell as DuoBell,
  BookOpen as DuoBookOpen,
  Bookmark as DuoBookmark,
  Building as DuoBuilding,
  Calendar as DuoCalendar,
  Camera as DuoCamera,
  Check as DuoCheck,
  ChevronDown as DuoChevronDown,
  ChevronLeft as DuoChevronLeft,
  ChevronRight as DuoChevronRight,
  ChevronUp as DuoChevronUp,
  Circle as DuoCircle,
  CircleCheck as DuoCircleCheck,
  CircleInfo as DuoCircleInfo,
  CircleQuestion as DuoCircleQuestion,
  CircleUser as DuoCircleUser,
  CircleX as DuoCircleX,
  Clipboard as DuoClipboard,
  Clock as DuoClock,
  Cloud as DuoCloud,
  Copy as DuoCopy,
  DeviceMobile as DuoDeviceMobile,
  Download as DuoDownload,
  Ellipsis as DuoEllipsis,
  Eye as DuoEye,
  EyeOff as DuoEyeOff,
  FileText as DuoFileText,
  Folder as DuoFolder,
  Funnel as DuoFunnel,
  Gear as DuoGear,
  Gift as DuoGift,
  Globe as DuoGlobe,
  GripVertical as DuoGripVertical,
  Headphones as DuoHeadphones,
  Heart as DuoHeart,
  HeartStraight as DuoHeartStraight,
  Image as DuoImage,
  Laptop as DuoLaptop,
  Link as DuoLink,
  Loader as DuoLoader,
  Lock as DuoLock,
  LockOpen as DuoLockOpen,
  MagnifyingGlass as DuoMagnifyingGlass,
  Mail as DuoMail,
  Microphone as DuoMicrophone,
  MicrophoneSlash as DuoMicrophoneSlash,
  Minus as DuoMinus,
  Monitor as DuoMonitor,
  MusicNote as DuoMusicNote,
  PanelLeft as DuoPanelLeft,
  Pause as DuoPause,
  Pencil as DuoPencil,
  Play as DuoPlay,
  Plus as DuoPlus,
  Scissors as DuoScissors,
  Shield as DuoShield,
  SlidersHorizontal as DuoSlidersHorizontal,
  Sparkle as DuoSparkle,
  SpeakerHigh as DuoSpeakerHigh,
  SpeakerSlash as DuoSpeakerSlash,
  SquaresFour as DuoSquaresFour,
  Stop as DuoStop,
  Trash as DuoTrash,
  TriangleAlert as DuoTriangleAlert,
  Upload as DuoUpload,
  Users as DuoUsers,
  VideoCamera as DuoVideoCamera,
  Wallet as DuoWallet,
  Wifi as DuoWifi,
  X as DuoX,
} from '@nubo-icons/react/duo';
import {
  Archive,
  ArrowClockwise,
  ArrowCounterClockwise,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  ArrowUpRightFromSquare,
  ArrowsClockwise,
  ArrowsIn,
  ArrowsOut,
  ArrowsUpDown,
  Bell,
  BookOpen,
  Bookmark,
  Building,
  Calendar,
  Camera,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Circle,
  CircleCheck,
  CircleInfo,
  CircleQuestion,
  CircleUser,
  CircleX,
  Clipboard,
  Clock,
  Cloud,
  Copy,
  DeviceMobile,
  Download,
  Ellipsis,
  Eye,
  EyeOff,
  FileText,
  Folder,
  Funnel,
  Gear,
  Gift,
  Globe,
  GripVertical,
  Headphones,
  Heart,
  HeartStraight,
  Image,
  Laptop,
  Link,
  Loader,
  Lock,
  LockOpen,
  MagnifyingGlass,
  Mail,
  Microphone,
  MicrophoneSlash,
  Minus,
  Monitor,
  MusicNote,
  PanelLeft,
  Pause,
  Pencil,
  Play,
  Plus,
  Scissors,
  Shield,
  SlidersHorizontal,
  Sparkle,
  SpeakerHigh,
  SpeakerSlash,
  SquaresFour,
  Stop,
  Trash,
  TriangleAlert,
  Upload,
  Users,
  VideoCamera,
  Wallet,
  Wifi,
  X,
  type NuboIcon as NuboComponent,
} from '@nubo-icons/react';
import { createContext, forwardRef, useContext, type ReactNode, type SVGProps } from 'react';
import { NUBO_ICON_MAP, type TrilorahIconName } from '../../shared/icons/nubo';

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'children' | 'dangerouslySetInnerHTML' | 'name'> {
  size?: number;
  /** Selected controls use the official Nubo Duo glyph. */
  selected?: boolean;
  label?: string;
  /** Compatibility with the previous API; Nubo glyphs stay still. */
  animated?: boolean;
  title?: string;
}

const glyphs = { Archive, ArrowClockwise, ArrowCounterClockwise, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ArrowUpRight, ArrowUpRightFromSquare, ArrowsClockwise, ArrowsIn, ArrowsOut, ArrowsUpDown, Bell, BookOpen, Bookmark, Building, Calendar, Camera, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Circle, CircleCheck, CircleInfo, CircleQuestion, CircleUser, CircleX, Clipboard, Clock, Cloud, Copy, DeviceMobile, Download, Ellipsis, Eye, EyeOff, FileText, Folder, Funnel, Gear, Gift, Globe, GripVertical, Headphones, Heart, HeartStraight, Image, Laptop, Link, Loader, Lock, LockOpen, MagnifyingGlass, Mail, Microphone, MicrophoneSlash, Minus, Monitor, MusicNote, PanelLeft, Pause, Pencil, Play, Plus, Scissors, Shield, SlidersHorizontal, Sparkle, SpeakerHigh, SpeakerSlash, SquaresFour, Stop, Trash, TriangleAlert, Upload, Users, VideoCamera, Wallet, Wifi, X };

const duoGlyphs = { Archive: DuoArchive, ArrowClockwise: DuoArrowClockwise, ArrowCounterClockwise: DuoArrowCounterClockwise, ArrowDown: DuoArrowDown, ArrowLeft: DuoArrowLeft, ArrowRight: DuoArrowRight, ArrowUp: DuoArrowUp, ArrowUpRight: DuoArrowUpRight, ArrowUpRightFromSquare: DuoArrowUpRightFromSquare, ArrowsClockwise: DuoArrowsClockwise, ArrowsIn: DuoArrowsIn, ArrowsOut: DuoArrowsOut, ArrowsUpDown: DuoArrowsUpDown, Bell: DuoBell, BookOpen: DuoBookOpen, Bookmark: DuoBookmark, Building: DuoBuilding, Calendar: DuoCalendar, Camera: DuoCamera, Check: DuoCheck, ChevronDown: DuoChevronDown, ChevronLeft: DuoChevronLeft, ChevronRight: DuoChevronRight, ChevronUp: DuoChevronUp, Circle: DuoCircle, CircleCheck: DuoCircleCheck, CircleInfo: DuoCircleInfo, CircleQuestion: DuoCircleQuestion, CircleUser: DuoCircleUser, CircleX: DuoCircleX, Clipboard: DuoClipboard, Clock: DuoClock, Cloud: DuoCloud, Copy: DuoCopy, DeviceMobile: DuoDeviceMobile, Download: DuoDownload, Ellipsis: DuoEllipsis, Eye: DuoEye, EyeOff: DuoEyeOff, FileText: DuoFileText, Folder: DuoFolder, Funnel: DuoFunnel, Gear: DuoGear, Gift: DuoGift, Globe: DuoGlobe, GripVertical: DuoGripVertical, Headphones: DuoHeadphones, Heart: DuoHeart, HeartStraight: DuoHeartStraight, Image: DuoImage, Laptop: DuoLaptop, Link: DuoLink, Loader: DuoLoader, Lock: DuoLock, LockOpen: DuoLockOpen, MagnifyingGlass: DuoMagnifyingGlass, Mail: DuoMail, Microphone: DuoMicrophone, MicrophoneSlash: DuoMicrophoneSlash, Minus: DuoMinus, Monitor: DuoMonitor, MusicNote: DuoMusicNote, PanelLeft: DuoPanelLeft, Pause: DuoPause, Pencil: DuoPencil, Play: DuoPlay, Plus: DuoPlus, Scissors: DuoScissors, Shield: DuoShield, SlidersHorizontal: DuoSlidersHorizontal, Sparkle: DuoSparkle, SpeakerHigh: DuoSpeakerHigh, SpeakerSlash: DuoSpeakerSlash, SquaresFour: DuoSquaresFour, Stop: DuoStop, Trash: DuoTrash, TriangleAlert: DuoTriangleAlert, Upload: DuoUpload, Users: DuoUsers, VideoCamera: DuoVideoCamera, Wallet: DuoWallet, Wifi: DuoWifi, X: DuoX };

const IconSelectionContext = createContext(false);

/** A control can supply selection to an icon passed as a React node. */
export function IconSelection({ selected = false, children }: { selected?: boolean; children: ReactNode }) {
  return <IconSelectionContext.Provider value={selected}>{children}</IconSelectionContext.Provider>;
}

/** Resolve through this app's React runtime; web has its own React 18 adapter. */
export const TrilorahIcon = forwardRef<SVGSVGElement, IconProps & { name: TrilorahIconName }>(function TrilorahIcon(
  { name, size = 14, selected, label, animated: _animated, className = '', style, ...props }, ref,
) {
  const inheritedSelection = useContext(IconSelectionContext);
  const isSelected = selected ?? inheritedSelection;
  const Icon: NuboComponent = (isSelected ? duoGlyphs : glyphs)[NUBO_ICON_MAP[name]];
  void _animated;
  const accessibleLabel = label ?? props['aria-label'];
  const announced = accessibleLabel !== undefined || props['aria-labelledby'] !== undefined || props.title !== undefined;
  return <Icon {...props} ref={ref} size="1em"
    aria-hidden={props['aria-hidden'] ?? (announced ? undefined : true)}
    aria-label={accessibleLabel} role={props.role ?? (announced ? 'img' : undefined)}
    focusable="false" data-icon={name} data-icon-pack="nubo" data-icon-variant={isSelected ? 'duo' : 'line'}
    className={`tri-icon ${className}`.trim()}
    style={{ display: 'inline-block', flexShrink: 0, verticalAlign: 'middle', fontSize: size, ...style }} />;
});

export function createNuboIcon(name: TrilorahIconName, defaultSize = 14) {
  const Icon = forwardRef<SVGSVGElement, IconProps>(function NamedNubo({ size = defaultSize, ...props }, ref) {
    return <TrilorahIcon {...props} ref={ref} name={name} size={size} />;
  });
  Icon.displayName = `TrilorahNubo(${name})`;
  return Icon;
}
