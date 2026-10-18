import { BookOpen, StickyNote, Radio } from '@/components/icons';

/** Same quiet cover treatment as a service without published artwork. */
export default function CompanionEmpty({ kind = 'transcript', title, children }: {
  kind?: 'transcript' | 'verses' | 'notes'; title: string; children: React.ReactNode;
}) {
  const Icon = kind === 'verses' ? BookOpen : kind === 'notes' ? StickyNote : Radio;
  return <div className="companion-empty" role="status">
    <div className="companion-empty-art" aria-hidden="true"><span /><span /><Icon size={36} /></div>
    <h2>{title}</h2><p>{children}</p>
  </div>;
}
