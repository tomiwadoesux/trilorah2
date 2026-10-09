/** Already drawable image URLs do not need a native filesystem read. */
export async function mediaImageSource(path: string, readFile: (path: string) => Promise<string | null>): Promise<string | null> {
  if (/^(?:https?:\/\/|data:image\/|blob:)/i.test(path)) return path;
  return readFile(path);
}
