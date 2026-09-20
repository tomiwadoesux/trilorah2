"use client";

import SermonNotesSections, {
  notesAreEmpty,
  type SermonNotesData,
} from "@/components/SermonNotesSections";

export default function NotesTab({
  notes,
  isLive,
}: {
  notes: SermonNotesData | null;
  isLive: boolean;
}) {
  if (!notes || notesAreEmpty(notes)) {
    return (
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-center px-8">
        <p className="text-base font-medium text-gray-300 mb-1">
          {isLive ? "Notes building…" : "Notes will be ready after the sermon."}
        </p>
        <p className="text-sm text-gray-500 max-w-xs">
          {isLive
            ? "Points will appear here as the pastor lays them out."
            : "Check back at the end of the service."}
        </p>
      </div>
    );
  }

  return (
    <div className="px-5 py-6 pb-32 overflow-y-auto flex-1 min-h-0 space-y-6">
      <SermonNotesSections notes={notes} />
    </div>
  );
}
