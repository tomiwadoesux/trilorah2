# yui540 CSS animations, organised

42 pure CSS and SVG animations from yui540's public repo [github.com/yui540/css-animations](https://github.com/yui540/css-animations), catalogued in English.

**License:** MIT, © 2026 yui540. Keep the `LICENSE` file with any copy of this code. This repo is the part of yui540's work she allows people to reuse. The motions on yui540.com that aren't on GitHub are marked do-not-copy, so they are not included here.

## How to use

- Open `gallery.html` to see every animation with a replay button.
- Each demo is one self-contained file in `source/`. No JavaScript, no libraries: just HTML, CSS and inline SVG.
- Most files use native CSS nesting (`&:nth-child`), which needs Chrome 120+, Safari 17.2+ or Firefox 117+.
- A few files load the M PLUS 1 font from Google Fonts; they fall back to a system font offline.
- The five loaders are standalone `.svg` files with their CSS inside. Drop them in with `<img src>` and they animate on their own.

## Catalogue

### Transitions and loaders

| # | Name | Original title | File | Plays | Length | What happens | Techniques |
|---|---|---|---|---|---|---|---|
| 1 | Signature transitions | 自分がよく使うCSSアニメーション | `source/2025-02-25/index.html` | Once | 9.6s | Four full-screen scene wipes (slide, mask, arrow, staggered blocks) playing over a title reveal. | clip-path, mask, nth-child stagger, cubic-bezier |
| 2 | Loader: bouncing LOADING text | loading-1 | `source/2025-03-11/loading-1.svg` | Loop |  | Letters of LOADING hop one after another above three dots. | standalone SVG, transform-box: fill-box, nth-child delays |
| 3 | Loader: pulsing dots | loading-2 | `source/2025-03-11/loading-2.svg` | Loop |  | Circles fade and scale in turn. | standalone SVG, transform-box, staggered delay |
| 4 | Loader: equalizer bars | loading-3 | `source/2025-03-11/loading-3.svg` | Loop |  | Bars rise and fall in an outer and inner wave. | standalone SVG, custom properties for per-bar delay |
| 5 | Loader: hourglass | loading-4 | `source/2025-03-11/loading-4.svg` | Loop |  | Hourglass flips while the sand drains and refills. | SVG mask, stroke drawing, cubic-bezier |
| 6 | Loader: sliding pill | loading-5 | `source/2025-03-11/loading-5.svg` | Loop |  | A pill toggle slides and squashes back and forth. | standalone SVG, transform-box, scale |

### Physics basics

| # | Name | Original title | File | Plays | Length | What happens | Techniques |
|---|---|---|---|---|---|---|---|
| 7 | Pop out | 飛び出す | `source/2026-04-17/tips-1.html` | Once | 0.6s | Ball scales up from nothing, overshoots, then settles. | squash-and-stretch overshoot keyframes |
| 8 | Page peel | めくる | `source/2026-04-17/tips-2.html` | Once | 1.5s | White tile peels away to reveal the finished icon. | border-radius + translate + scale, cubic-bezier |
| 9 | Roll | 転がる | `source/2026-04-17/tips-3.html` | Once | 0.7s | Rounded square rolls across and stops. | translate + rotate in one keyframe |
| 10 | Sudden brake | 急ブレーキ | `source/2026-04-17/tips-4.html` | Once | 1.7s | Square slides in, tips forward as it brakes, and settles. | separate rotate keyframes, cubic-bezier |
| 11 | Balancing blocks | 積み木 | `source/2026-04-18/tips-1.html` | Once | 1.9s | Ball, bar and ball wobble like a seesaw until balanced. | six coordinated keyframes |
| 12 | Dominoes | ドミノ | `source/2026-04-18/tips-2.html` | Once | 1.1s | Four tiles topple one into the next. | per-tile keyframes, nth-child |
| 13 | Swinging tag | カランカラン | `source/2026-04-18/tips-3.html` | Once | 0.8s | Tag drops on its string and swings to rest. | separate translate-x / translate-y + shake |
| 14 | Pop-up stack | 飛び出す | `source/2026-04-18/tips-4.html` | Once | 1.0s | A block springs up off its base and lands stacked. | jump + push keyframes |

### Screen transitions

| # | Name | Original title | File | Plays | Length | What happens | Techniques |
|---|---|---|---|---|---|---|---|
| 15 | Shutter | シャッター | `source/2026-04-22/tips-1.html` | Once | 2.0s | Slats roll down to cover the screen, then roll back up. | --delay stagger via calc, nth-child |
| 16 | Stage curtain | 幕 | `source/2026-04-22/tips-2.html` | Once | 1.9s | Curtains swing closed from both sides and reopen. | custom properties, paired close/open keyframes |
| 17 | Paint wipe | 塗り | `source/2026-04-22/tips-3.html` | Once | 1.9s | Rounded brush strokes paint the screen, then clear. | calc stagger, rounded ends |
| 18 | Threads | 糸 | `source/2026-04-22/tips-4.html` | Once | 3.0s | Lines weave into a grid that fills the screen, then unravels. | 20 staggered scale animations, cubic-bezier |
| 19 | Scroll unroll | 巻き物 | `source/2026-04-25/tips-1.html` | Once | 2.7s | A roll unrolls to reveal a title, then rolls away. | line draw + rotate + text slide |
| 20 | Tumbling bricks | ガタンガタン | `source/2026-04-25/tips-2.html` | Once | 2.3s | Bricks fall and stack into a wall, then tumble out. | bounce + fall, calc stagger |
| 21 | Swap | 交代 | `source/2026-04-25/tips-3.html` | Once | 2.0s | The + button flips away as the − slides in, then they swap back. | single change keyframe |
| 22 | Ripple | 波紋 | `source/2026-04-25/tips-4.html` | Loop |  | Concentric ripple expanding and fading on a loop. | infinite, staggered fade |

### Shapes and lines

| # | Name | Original title | File | Plays | Length | What happens | Techniques |
|---|---|---|---|---|---|---|---|
| 23 | Scribble | カキカキ | `source/2026-04-29/tips-1.html` | Once | 2.5s | SVG line scribbles itself in, then erases from the start. | stroke-dasharray draw, stroke-dashoffset erase |
| 24 | Pull-cord flip | ひっくり返す | `source/2026-04-29/tips-2.html` | Once | 3.5s | Card on a cord is tugged, flips over, and flips back. | pull + sway + turn keyframes |
| 25 | Fold | 折りたたみ | `source/2026-04-29/tips-3.html` | Once | 2.6s | Square of four segments unfolds into a line and folds back. | chained rotate with transform-origin |
| 26 | Hop | ぴょんぴょん | `source/2026-04-29/tips-4.html` | Once | 1.3s | Three dots squash and hop in a wave. | scale + jump, calc stagger |

### Icon micro-interactions

| # | Name | Original title | File | Plays | Length | What happens | Techniques |
|---|---|---|---|---|---|---|---|
| 27 | Expand / shrink | 拡大・縮小 | `source/2026-05-02/tips-1.html` | Once | 1.0s | Arrows push outward and inward. | arrow-up / arrow-down keyframes |
| 28 | Dive | 潜る | `source/2026-05-02/tips-2.html` | Once | 3.6s | Bar tips over, ball squashes flat, pops up on the other side. | rotate chain + squash |
| 29 | Download and bar chart | ダウンロード・棒グラフ | `source/2026-05-02/tips-3.html` | Once | 1.8s | Arrow drops into the tray; chart bars dip and regrow. | nth-child stagger |
| 30 | Orbit | 回転 | `source/2026-05-02/tips-4.html` | Loop |  | Circles orbit a centre on a loop. | infinite spin, nested rotation |

### Looping objects

| # | Name | Original title | File | Plays | Length | What happens | Techniques |
|---|---|---|---|---|---|---|---|
| 31 | Tissue box | ティッシュ | `source/2026-05-14/tips-1.html` | Loop |  | Tissue is pulled up and pushed back on a loop. | clip-path |
| 32 | Zip curtain | カーテン | `source/2026-05-14/tips-2.html` | Loop |  | Zip slides down, curtain parts, zip returns. | infinite, calc |
| 33 | Rolling blocks | ひっくり返す | `source/2026-05-14/tips-3.html` | Loop |  | One block rolls over another on a loop. | rolling with inner counter-rotation |
| 34 | Headphones | ヘッドフォン | `source/2026-05-14/tips-4.html` | Loop |  | Headphones drop onto a head and squeeze to fit. | move + width keyframes |

### Like buttons

| # | Name | Original title | File | Plays | Length | What happens | Techniques |
|---|---|---|---|---|---|---|---|
| 35 | Like 1: confetti | いいねアニメーション1 | `source/2026-06-07/tips-1.html` | Once | 1.1s | Heart fills with a confetti burst and a ring. | 32 particles, custom-property positions |
| 36 | Like 2: floating hearts | いいねアニメーション2 | `source/2026-06-07/tips-2.html` | Once | 1.9s | Heart fills and small hearts float away. | SVG hearts, transform-box |
| 37 | Like 3: sparkle rays | いいねアニメーション3 | `source/2026-06-07/tips-3.html` | Once | 1.4s | Heart pops with sparkle rays. | line + segment slide |

### Bookmark buttons

| # | Name | Original title | File | Plays | Length | What happens | Techniques |
|---|---|---|---|---|---|---|---|
| 38 | Bookmark 1: flip | ブックマーク1 | `source/2026-06-08/tips-1.html` | Once | 3.6s | Icon flips in 3D to pink with sparkles. | 3D rotate, clip-path, SVG sparkle |
| 39 | Bookmark 2: panel sweep | ブックマーク2 | `source/2026-06-08/tips-2.html` | Once | 3.2s | Pink panel sweeps in and the ribbon swings. | clip-path, border-radius morph |
| 40 | Bookmark 3: slide | ブックマーク3 | `source/2026-06-08/tips-3.html` | Once | 3.7s | Panel slides across and the ribbon jumps. | clip-path, slide in/out |

### Character

| # | Name | Original title | File | Plays | Length | What happens | Techniques |
|---|---|---|---|---|---|---|---|
| 41 | Walking cat | 動く猫ちゃん1 | `source/2026-06-09/tips-1.html` | Loop | 4.2s | SVG cat walks in with a speed trail, bobs and breathes. | SVG, blur filter, transform-box, loop |
| 42 | Cat and flower | 動く猫ちゃん2 | `source/2026-06-09/tips-2.html` | Loop | 4.1s | A stem grows, leaves pop, a flower blooms beside the cat. | 24 keyframes, PNG + SVG, loop |

## Patterns worth reusing

1. **Squash-and-stretch overshoot.** `scale(0)` → `scale(1.2, 1.25)` → `scale(0.9, 0.95)` → `scale(1)`. Unequal x and y values make it feel elastic. See *Pop out*.
2. **Two timelines in one `@keyframes` block.** Opacity and transform get separate keyframe lists inside the same block (for example opacity finished by 20%, transform running to 100%). Browsers merge them, so each property gets its own pacing.
3. **Stagger with a custom property.** Each element sets `--delay` (or `--d`), usually through `:nth-child`, and the animation reads `var(--delay)`. See *Shutter*, *Paint wipe*, *Hop*.
4. **Chained animations on one element.** `animation: draw 1.2s ease-in-out 0s both, clear 1.2s ease-in-out 1.3s forwards;` plays the second after the first with no JavaScript. See *Scribble*.
5. **Line drawing.** Animate `stroke-dasharray` from `0 L` to `L L`, where `L` is the path length (get it once with `path.getTotalLength()` and hardcode it as `--stroke-length`). Erase by sliding `stroke-dashoffset` to `-L`.
6. **Local pivots in SVG.** `transform-box: fill-box; transform-origin: center;` makes each shape rotate or scale around itself.
7. **Snappy easing.** Transitions lean on strong ease-in-out curves such as `cubic-bezier(0.87, 0.05, 0.02, 0.97)`; motion that should land softly uses ease-out curves such as `cubic-bezier(0, 0.31, 0.18, 0.99)`.
8. **Reveals with `clip-path`.** The tissue, bookmark and transition demos reveal shapes by animating `clip-path` rather than resizing elements.
9. **One 320×320 stage per demo.** Every piece lives in a centred square `.container`, which makes them easy to drop into a card or button.
