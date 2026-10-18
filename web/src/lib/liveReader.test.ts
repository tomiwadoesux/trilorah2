import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import TranscriptStream from '../app/live/[slug]/components/TranscriptStream';

vi.mock('../app/live/[slug]/components/StreamPlayer', () => ({ default: () => null }));
vi.mock('./usePlayhead', () => ({ usePlayhead: (compute: () => number) => compute() }));
const started = Date.parse('2026-10-17T10:00:00Z');
const words = ['Let', 'the', 'message', 'stay', 'with', 'you.'].map((w, i) => ({ w, s: i, e: i + .8 }));
const props = {
  chunks: [{ id: 'chunk', text: words.map(w => w.w).join(' '), words, offset_ms: 0,
    timestamp: new Date(started + 6000).toISOString(), is_final: true, segment_type: 'sermon' }],
  verses: [], segment: 'sermon', isLive: true, publishTranscript: true,
  serviceStartedAt: new Date(started).toISOString(), streamUrl: null,
};
afterEach(() => vi.restoreAllMocks());
describe('live transcript presentation', () => {
  it('highlights one delayed word and marks following words in the same sentence as upcoming', () => {
    vi.spyOn(Date, 'now').mockReturnValue(started + 8000);
    const html = renderToStaticMarkup(createElement(TranscriptStream, props));
    expect(html.match(/data-current="true"/g)).toHaveLength(1);
    expect(html).toContain('data-word="chunk:3" data-phase="current"');
    expect(html).toContain('data-word="chunk:4" data-phase="upcoming"');
    expect(html).toContain('Hold reading');
    expect(html).toContain('About 5 seconds behind');
    expect(html).not.toMatch(/type="range"|Text replay|No audio|Playback speed|Back 15 seconds|Forward 15 seconds/);
  });
  it('does not apply an extra stream delay just because a church configured a stream', () => {
    vi.spyOn(Date, 'now').mockReturnValue(started + 8000);
    const html = renderToStaticMarkup(createElement(TranscriptStream, { ...props, streamUrl: 'https://www.youtube.com/watch?v=sample' }));
    expect(html).toContain('data-word="chunk:3" data-phase="current"');
  });
  it('shows a reading document for an ended service without an artificial playback clock', () => {
    const html = renderToStaticMarkup(createElement(TranscriptStream, { ...props, isLive: false }));
    expect(html).toContain('PUBLISHED TRANSCRIPT');
    expect(html).toContain('Read at your own pace');
    expect(html).not.toContain('data-current="true"');
    expect(html).not.toContain('Hold reading');
    expect(html).not.toContain('type="range"');
  });
  it('waits when the delivered transcript runs out instead of highlighting nonexistent future text', () => {
    vi.spyOn(Date, 'now').mockReturnValue(started + 30000);
    const html = renderToStaticMarkup(createElement(TranscriptStream, props));
    expect(html).toContain('Waiting for more words');
    expect(html).not.toContain('data-current="true"');
  });
});
