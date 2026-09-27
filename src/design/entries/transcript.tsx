import { useState } from 'react';
import { Button } from '../../ui';
import { Sheet, Group, Note, Stage } from '../Sheet';
import { useDemoSpeech } from '../screens/transcript/demoSermon';
import { TRANSCRIPT_STYLES, SHIPPED_TRANSCRIPT } from '../screens/transcript/styles';

/*
 * D-27 — the live transcript strip, every design on one page, all fed by
 * the SAME pretend sermon at the same moment, so the only difference
 * between two rows is the design.
 *
 * The strip is drawn at the width it has on the Live screen (the right-hand
 * column at 1400) rather than the page's, because a line's length is half
 * of whether it can be read.
 */

const SPEEDS = [1, 1.5, 2];

export function TriTranscript() {
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const { spoken, restart } = useDemoSpeech({ playing, speed });
  const noop = () => {};

  return (
    <Sheet
      id="D-27"
      title="Live transcript"
      status="draft"
      summary="The strip along the foot of the Live screen that shows what the preacher is saying as it is said. Three designs and the one that shipped, on one pretend sermon — words arriving at preaching pace, the engine mishearing and correcting, references formatted, pauses."
    >
      <Group title="Demo sermon" hint="one feed drives every row below">
        <Stage>
          <div className="flex flex-wrap items-center gap-2">
            <Button label={playing ? 'pause' : 'play'} onClick={() => setPlaying((p) => !p)} />
            <Button label="restart" onClick={restart} />
            <Button
              label={`${speed}× speed`}
              onClick={() => setSpeed((s) => SPEEDS[(SPEEDS.indexOf(s) + 1) % SPEEDS.length])}
            />
            <span className="ml-2 font-mono text-[10px] text-neutral-500">
              {spoken.lines.length} lines · hearing: {spoken.partial ? `“${spoken.partial}”` : '—'}
            </span>
          </div>
        </Stage>
      </Group>

      {TRANSCRIPT_STYLES.map((s) => (
        <Group
          key={s.id}
          title={s.id === SHIPPED_TRANSCRIPT ? `${s.name} · in the app now` : s.name}
          hint={s.blurb}
        >
          <Stage>
            <div className="flex" style={{ width: 'min(100%, 1110px)' }}>
              <s.Component spoken={spoken} asr="listening" onOpenDashboard={noop} />
            </div>
          </Stage>
        </Group>
      ))}

      <Note>
        <strong>Try one in place.</strong> On the Live screen (S-02) a small dashed “d-27 demo” bar
        sits over the transcript strip on the design page only: pick a design there and the same
        sermon plays through it where it will actually live. It stops the moment the engine hears
        real speech, and the app’s own window never shows it.
      </Note>
    </Sheet>
  );
}
