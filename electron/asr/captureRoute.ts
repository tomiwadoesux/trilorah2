/**
 * Where an engine's sound comes from when it is not SoX: the app window's
 * microphone (on-mic-request, answered by src/lib/micCapture.ts), or another
 * computer sending over the network (electron/ndi/networkSound.ts), which
 * main receives itself. Both land on the same audio bus, so the engines
 * cannot tell them apart.
 */

import { isNetworkSound, networkSoundComputer, networkSoundSource } from '../../shared/audioInput'
import { emitAudioLevel, emitMicRequest, emitMicStop } from '../emitters'
import { publishServiceNotice } from '../serviceNotices'
import { startReceiving, stopReceiving } from '../ndi/networkSound'
import { feedAudioChunk } from './audioBus'

const NOTICE_ID = 'audio-network'

export function requestCapture(request: { sampleRate: number; deviceLabel?: string }): void {
  const label = request.deviceLabel
  if (!label || !isNetworkSound(label)) {
    emitMicRequest(request)
    return
  }
  const source = networkSoundSource(label)
  const computer = networkSoundComputer(source)
  startReceiving(source, request.sampleRate, {
    onChunk: feedAudioChunk,
    onLevel: emitAudioLevel,
    onQuiet: (quiet) => publishServiceNotice(quiet
      ? {
          id: NOTICE_ID,
          title: `No sound from ${computer}`,
          detail: `Trilorah has stopped hearing ${computer}. Check that its sender window is still open, that the right sound is chosen there, and that both computers are on the same network.`,
          severity: 'warning',
          target: 'audio',
          actions: [{ kind: 'navigate', target: 'audio', label: 'Choose audio input' }],
        }
      : { id: NOTICE_ID, title: `Hearing ${computer} again`, detail: 'Sound is arriving over the network.', severity: 'info', target: 'audio', status: 'resolved' }),
    onError: (message) => publishServiceNotice({
      id: NOTICE_ID,
      title: `Could not listen to ${computer}`,
      detail: `${message}. Choose another input, or restart listening to try again.`,
      severity: 'error',
      target: 'audio',
      actions: [{ kind: 'command', command: 'restart-listening', label: 'Restart listening' }, { kind: 'navigate', target: 'audio', label: 'Choose audio input' }],
    }),
  })
}

export function stopCapture(): void {
  stopReceiving()
  emitMicStop()
  publishServiceNotice({ id: NOTICE_ID, title: 'Network sound closed', detail: 'Listening stopped.', severity: 'info', target: 'audio', status: 'resolved' })
}
