import type { ReactNode } from 'react';
import {
  ArrowIcon,
  BookIcon,
  CheckIcon,
  ClockIcon,
  CupIcon,
  GiftIcon,
  MicIcon,
  MusicIcon,
  PencilIcon,
  PrayerIcon,
  SparkleIcon,
  type SelectOption,
} from '../../../ui';

/*
 * D-72 — the segment types a service is built from, plus a way out for the
 * ones no list will ever have.
 *
 * Ordered by how often a church reaches for one, NOT by where it falls in a
 * service. The list is scanned, not read: every service has worship and a
 * sermon, most have a welcome and announcements, and communion is monthly
 * at best — so chronological order buried the two universal ones in the
 * middle of the column. Running order is what the picking order sets (see
 * ArrangeList), which leaves this list free to be ordered by reach.
 *
 * `prayer` and `pre-service` joined when the programme scanner arrived: the
 * engine has always had them and the matcher returns them, so without them
 * here a scanned "Intercession" landed as a type the rail could not name.
 *
 * The ids are SegmentTypeId in shared/serviceAliases.ts. Lives here rather
 * than in Live.tsx because the rail, the scan review and the right-click
 * menu all need it and none of them should import the whole screen.
 */
export const SEGMENT_TYPES: SelectOption[] = [
  { value: 'worship', label: 'worship' },
  { value: 'sermon', label: 'sermon' },
  { value: 'welcome', label: 'welcome' },
  { value: 'announcements', label: 'announcements' },
  { value: 'offering', label: 'offering' },
  { value: 'prayer', label: 'prayer' },
  { value: 'altar-call', label: 'altar call' },
  { value: 'closing', label: 'closing' },
  { value: 'communion', label: 'communion' },
  { value: 'pre-service', label: 'pre-service' },
  { value: 'custom', label: 'something else…' },
];

export function segmentTypeLabel(type: string): string {
  return SEGMENT_TYPES.find((t) => t.value === type)?.label ?? type;
}

/** A type's mark. Wayfinding, like the item marks in the rail — mint at the
    call site, never a colour of its own. */
export function segmentIcon(type: string, size = 13): ReactNode {
  switch (type) {
    case 'worship':
      return <MusicIcon size={size} />;
    case 'sermon':
      return <BookIcon size={size} />;
    case 'welcome':
      return <SparkleIcon size={size} />;
    case 'announcements':
      return <MicIcon size={size} />;
    case 'offering':
      return <GiftIcon size={size} />;
    case 'prayer':
      return <PrayerIcon size={size} />;
    case 'altar-call':
      return <ArrowIcon size={size} />;
    case 'closing':
      return <CheckIcon size={size} />;
    case 'communion':
      return <CupIcon size={size} />;
    case 'pre-service':
      return <ClockIcon size={size} />;
    default:
      return <PencilIcon size={size} />;
  }
}
