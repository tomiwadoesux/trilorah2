export function videoSpeed(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(.25, Math.min(2, value)) : 1;
}

export function videoBass(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(12, value)) : 0;
}

let context: AudioContext | undefined;
type Graph = { source: MediaElementAudioSourceNode; bass: BiquadFilterNode; limiter: DynamicsCompressorNode };
const graphs = new WeakMap<HTMLMediaElement, Graph>();

/** One source per element, including React strict-effect remounts. */
export function connectBackgroundAudio(element: HTMLMediaElement, gain: number): () => void {
  context ??= new AudioContext();
  let graph = graphs.get(element);
  if (!graph) {
    const bass = context.createBiquadFilter();
    bass.type = 'lowshelf';
    bass.frequency.value = 200;
    const limiter = context.createDynamicsCompressor();
    limiter.threshold.value = -3;
    limiter.knee.value = 0;
    limiter.ratio.value = 12;
    graph = { source: context.createMediaElementSource(element), bass, limiter };
    graphs.set(element, graph);
  }
  const { source, bass, limiter } = graph;
  source.disconnect(); bass.disconnect(); limiter.disconnect();
  bass.gain.value = videoBass(gain);
  if (gain > 0) {
    source.connect(bass); bass.connect(limiter); limiter.connect(context.destination);
  } else source.connect(context.destination);
  void context.resume().catch(() => undefined);
  return () => { source.disconnect(); bass.disconnect(); limiter.disconnect(); };
}
