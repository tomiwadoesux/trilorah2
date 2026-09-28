/* Solar Bold is shared with the desktop app. See THIRD-PARTY-NOTICES.md. */
import type { Icon as SolarIcon } from '@solar-icons/react/lib/types';
import { SoundwaveIcon } from '@solar-icons/react/bold/soundwave';
import { Book2Icon } from '@solar-icons/react/bold/book-2';
import { DocumentTextIcon } from '@solar-icons/react/bold/document-text';
import { HandMoneyIcon } from '@solar-icons/react/bold/hand-money';
import { CopyIcon } from '@solar-icons/react/bold/copy';
import { LinkIcon } from '@solar-icons/react/bold/link';
import { AddIcon } from '@solar-icons/react/bold/add';
import { AltArrowDownIcon } from '@solar-icons/react/bold/alt-arrow-down';
import { HeadphonesRoundIcon } from '@solar-icons/react/bold/headphones-round';
import { ArrowDownIcon } from '@solar-icons/react/bold/arrow-down';
import { Tuning2Icon } from '@solar-icons/react/bold/tuning-2';
import { MinusIcon } from '@solar-icons/react/bold/minus';
import { RestartIcon } from '@solar-icons/react/bold/restart';
import { CheckIcon } from '@solar-icons/react/bold/check';
import { DownloadIcon } from '@solar-icons/react/bold/download';
import { QrCodeIcon } from '@solar-icons/react/bold/qr-code';

interface IconProps {
  size?: number;
  className?: string;
}

function icon(Component: SolarIcon) {
  return function Icon({ size = 24, className }: IconProps) {
    return <Component aria-hidden="true" focusable="false" color="currentColor" className={className} style={{ fontSize: size }} />;
  };
}

export const Radio = icon(SoundwaveIcon);
export const BookOpen = icon(Book2Icon);
export const StickyNote = icon(DocumentTextIcon);
export const HandCoins = icon(HandMoneyIcon);
export const Copy = icon(CopyIcon);
export const Link = icon(LinkIcon);
export const Plus = icon(AddIcon);
export const ChevronDown = icon(AltArrowDownIcon);
export const Headphones = icon(HeadphonesRoundIcon);
export const ArrowDown = icon(ArrowDownIcon);
export const Settings2 = icon(Tuning2Icon);
export const Minus = icon(MinusIcon);
export const RotateCcw = icon(RestartIcon);
export const Check = icon(CheckIcon);
export const Download = icon(DownloadIcon);
export const QrCode = icon(QrCodeIcon);
