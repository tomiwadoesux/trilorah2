/** whisper-node ships no type declarations; the surface we use is tiny. */
declare module 'whisper-node' {
  export interface WhisperOptions {
    modelName?: string
    modelPath?: string
    whisperOptions?: Record<string, unknown>
  }
  export function whisper(
    filePath: string,
    options?: WhisperOptions
  ): Promise<Array<{ start: string; end: string; speech: string }> | string>
  const _default: { whisper: typeof whisper }
  export default _default
}
