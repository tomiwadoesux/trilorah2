import { useEffect, useState, type CSSProperties } from 'react';

// One tiny image read per source, shared by both panels. Motion is CSS only.
const palettes = new Map<string, Promise<string[]>>();
function paletteFor(src: string): Promise<string[]> {
  const cached = palettes.get(src);
  if (cached) return cached;
  const result = new Promise<string[]>(resolve => {
    const picture = new Image();
    picture.crossOrigin = 'anonymous';
    picture.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 16;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) { resolve([]); return; }
        context.drawImage(picture, 0, 0, 16, 16);
        const pixels = context.getImageData(0, 0, 16, 16).data;
        const colors = Array.from({ length: 4 }, () => [0, 0, 0, 0]);
        for (let i = 0; i < pixels.length; i += 4) {
          const cell = ((i / 4) % 16 >= 8 ? 1 : 0) + (i / 4 >= 128 ? 2 : 0);
          const color = colors[cell];
          for (let c = 0; c < 3; c++) color[c] += pixels[i + c];
          color[3]++;
        }
        resolve(colors.map(c => `rgb(${c.slice(0, 3).map(value => Math.round(value / c[3])).join(' ')})`));
      } catch { resolve([]); } // A remote image may prohibit pixel reads.
    };
    picture.onerror = () => resolve([]);
    picture.src = src;
  });
  palettes.set(src, result);
  if (palettes.size > 32) palettes.delete(palettes.keys().next().value!);
  return result;
}

export function StageGradient({ src }: { src: string }) {
  const [colors, setColors] = useState<string[]>([]);
  const [seed] = useState(() => Math.random());
  useEffect(() => {
    let current = true;
    void paletteFor(src).then(palette => { if (current) setColors(palette); });
    return () => { current = false; };
  }, [src]);
  if (!colors.length) return <img className="stage-backdrop-image" src={src} alt="" />;
  return <div className="stage-gradient" style={{
    '--gradient-a': colors[0], '--gradient-b': colors[1], '--gradient-c': colors[2], '--gradient-d': colors[3],
    '--gradient-turn': `${Math.round(seed * 180)}deg`, '--gradient-delay': `${-seed * 40}s`,
  } as CSSProperties}><span className="stage-gradient__field" /><span className="stage-gradient__veil" /></div>;
}
