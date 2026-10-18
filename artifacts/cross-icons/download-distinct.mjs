import { mkdir, writeFile } from 'node:fs/promises';
const dir = new URL('./distinct/', import.meta.url);
await mkdir(dir, { recursive: true });
const choices = [
  ['Cross with thorn crown', 'cross-with-crown-of-thorns', 77246],
  ['Thorned silhouette', 'thorns-cross', 63047],
  ['Heart cross', 'cross-and-heart', 77245],
  ['Interlocking cross', 'interlocking-geometric-cross', 60302],
  ['Sculpted cross', 'stylized-cross-silhouette', 170724],
  ['Ornate Catholic cross', 'decorative-catholic-cross', null],
  ['Geometric cross', 'abstract-geometric-cross', null],
  ['Flourish cross', 'flourish-cross', null],
];
const results = await Promise.allSettled(choices.map(async ([title, id, knownNumber]) => {
  const source = `https://freesvg.org/${id}`;
  const pageResponse = await fetch(source, { signal: AbortSignal.timeout(20000) });
  if (!pageResponse.ok) throw new Error(`${id} page ${pageResponse.status}`);
  const html = await pageResponse.text();
  const imageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)/) ?? html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/);
  const imageUrl = imageMatch?.[1] ?? html.match(/src=["']([^"']*\/img\/[^"']+\.png)/)?.[1];
  if (!imageUrl) throw new Error(`${id} image absent`);
  const url = new URL(imageUrl, source).href;
  const response = await fetch(url, { signal: AbortSignal.timeout(25000) });
  if (!response.ok) throw new Error(`${id} SVG ${response.status}`);
  const content = Buffer.from(await response.arrayBuffer());
  if (content.length < 100) throw new Error(`${id} image empty`);
  await writeFile(new URL(`${id}.png`, dir), content);
  console.log(`OK ${id} ${content.length} bytes ${url}`);
  return { title, id, source, url, file: `${id}.png`, license: 'Public Domain / CC0', author: 'OpenClipart / FreeSVG' };
}));
for (const result of results) if (result.status === 'rejected') console.log(`FAILED ${result.reason}`);
await writeFile(new URL('sources.json', dir), JSON.stringify(results.filter(result => result.status === 'fulfilled').map(result => result.value), null, 2));
