import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { SlideCanvas, type SlideTheme } from '../design/screens/slide';

vi.mock('../design/screens/mediaLibrary', () => ({
  useMediaLibrary: () => [],
  mediaSrc: () => '',
}));

const theme: SlideTheme = {
  backgroundId: 'none', dimness: 0, blur: 0, shadow: 0,
  font: 'default', textCase: 'lowercase', size: 4, verseSize: 2,
  refGap: 1, layout: 'center', safeMargin: 7,
};

describe('scripture and song previews', () => {
  it('renders divine capitals in both translations without a CSS lowercase override', () => {
    const html = renderToStaticMarkup(createElement(SlideCanvas, {
      theme,
      slide: {
        reference: 'John 3:16 · KJV', verseStart: 16, verseEnd: 16, index: 1, total: 1,
        lines: [
          { version: 'KJV', text: 'PRAISE GOD, JESUS, THE HOLY SPIRIT AND ELOHIM' },
          { version: 'RVR', text: 'DIOS, JESÚS Y EL ESPÍRITU SANTO' },
        ],
      },
    }));
    expect(html).toContain('praise God, Jesus, the Holy Spirit and Elohim');
    expect(html).toContain('Dios, Jesús y el Espíritu Santo');
    expect(html).toContain('text-transform:none');
    expect(html).not.toContain('text-transform:lowercase');
  });
});
