/*
 * Theme presets for the stock background search.
 *
 * Preachers think in themes, not in stock-photo keywords: nobody wants to
 * type "wooden cross silhouette against sunset sky", they want the button
 * that says CROSS. Each preset carries the tuned query behind its name, and
 * the name is all the operator sees. The queries are also a filter — a bare
 * "jesus" on a stock library returns kitsch, and a query for the imagery
 * around the idea returns something you would put behind a verse.
 *
 * Grouped the way a sermon is planned: what God made, what scripture
 * pictures, where we are in the year, who is in the room, and the abstract
 * washes that are what most services actually run on.
 */

export type PresetGroup = 'creation' | 'scripture' | 'calendar' | 'people' | 'mood';

export interface StockPreset {
  id: string;
  label: string;
  group: PresetGroup;
  query: string;
}

export const PRESET_GROUPS: { id: PresetGroup; label: string }[] = [
  { id: 'creation', label: 'creation' },
  { id: 'scripture', label: 'scripture' },
  { id: 'calendar', label: 'calendar' },
  { id: 'people', label: 'people' },
  { id: 'mood', label: 'mood' },
];

const p = (group: PresetGroup, id: string, label: string, query: string): StockPreset => ({ id, label, group, query });

export const STOCK_PRESETS: StockPreset[] = [
  /* creation */
  p('creation', 'light', 'light', 'sun rays through trees'),
  p('creation', 'dawn', 'dawn', 'sunrise horizon sky'),
  p('creation', 'stars', 'night sky', 'milky way stars night'),
  p('creation', 'mountains', 'mountains', 'mountain range clouds'),
  p('creation', 'ocean', 'ocean', 'ocean waves horizon'),
  p('creation', 'river', 'river', 'river flowing valley'),
  p('creation', 'forest', 'forest', 'forest path mist'),
  p('creation', 'desert', 'wilderness', 'desert dunes sand'),
  p('creation', 'fields', 'fields', 'green field hills sky'),
  p('creation', 'harvest', 'harvest', 'wheat field golden'),
  p('creation', 'rain', 'rain', 'rain drops window dark'),
  p('creation', 'storm', 'storm', 'storm clouds lightning'),
  p('creation', 'fire', 'fire', 'fire embers dark'),
  p('creation', 'snow', 'snow', 'snow forest winter'),
  p('creation', 'rainbow', 'rainbow', 'rainbow sky landscape'),
  p('creation', 'rock', 'rock', 'rock cliff sea'),

  /* scripture imagery */
  p('scripture', 'cross', 'cross', 'wooden cross silhouette sky'),
  p('scripture', 'bible', 'open bible', 'open bible pages'),
  p('scripture', 'candle', 'candle', 'candle flame dark'),
  p('scripture', 'communion', 'bread & wine', 'bread wine communion'),
  p('scripture', 'crown', 'crown', 'crown thorns'),
  p('scripture', 'shepherd', 'shepherd', 'shepherd sheep hills'),
  p('scripture', 'dove', 'dove', 'white dove flying sky'),
  p('scripture', 'path', 'path', 'winding road landscape'),
  p('scripture', 'door', 'door', 'old door light'),
  p('scripture', 'anchor', 'anchor', 'anchor sea rope'),
  p('scripture', 'vine', 'vine', 'grape vine vineyard'),
  p('scripture', 'seed', 'seed & soil', 'seedling soil hands'),
  p('scripture', 'potter', 'potter', 'potter clay hands wheel'),
  p('scripture', 'water', 'living water', 'water surface ripples light'),
  p('scripture', 'boat', 'boat & nets', 'fishing boat lake dawn'),
  p('scripture', 'armor', 'armor', 'knight armor shield'),
  p('scripture', 'lion', 'lion', 'lion portrait'),
  p('scripture', 'eagle', 'eagle', 'eagle soaring sky'),
  p('scripture', 'olive', 'olive tree', 'olive tree grove'),
  p('scripture', 'tomb', 'empty tomb', 'cave entrance light sunrise'),

  /* church calendar */
  p('calendar', 'advent', 'advent', 'advent candles wreath'),
  p('calendar', 'christmas', 'christmas', 'nativity christmas lights'),
  p('calendar', 'epiphany', 'epiphany', 'star night sky bright'),
  p('calendar', 'lent', 'lent', 'ashes desert quiet'),
  p('calendar', 'palm', 'palm sunday', 'palm leaves branches'),
  p('calendar', 'goodfriday', 'good friday', 'cross dark sky dramatic'),
  p('calendar', 'easter', 'easter', 'sunrise cross hill'),
  p('calendar', 'pentecost', 'pentecost', 'flames fire wind'),
  p('calendar', 'thanksgiving', 'thanksgiving', 'harvest table autumn'),
  p('calendar', 'newyear', 'new year', 'fireworks night celebration'),

  /* worship & people */
  p('people', 'hands', 'raised hands', 'raised hands worship concert'),
  p('people', 'prayer', 'prayer', 'praying hands'),
  p('people', 'congregation', 'congregation', 'church congregation'),
  p('people', 'children', 'children', 'children playing sunlight'),
  p('people', 'unity', 'unity', 'hands together teamwork'),
  p('people', 'nations', 'nations', 'earth globe space'),
  p('people', 'city', 'city lights', 'city skyline night'),
  p('people', 'family', 'family', 'family walking sunset'),
  p('people', 'generations', 'generations', 'grandparent child hands'),

  /* mood — text-safe washes */
  p('mood', 'bokeh', 'gold bokeh', 'gold bokeh lights dark'),
  p('mood', 'texture', 'dark texture', 'dark concrete texture'),
  p('mood', 'marble', 'marble', 'dark marble texture'),
  p('mood', 'ink', 'ink & water', 'ink water abstract'),
  p('mood', 'gradient', 'soft gradient', 'gradient blur abstract'),
  p('mood', 'smoke', 'smoke', 'smoke dark background'),
  p('mood', 'glass', 'stained glass', 'stained glass window church'),
  p('mood', 'linen', 'linen', 'linen fabric texture'),
  p('mood', 'geometric', 'geometric', 'geometric pattern dark'),
];

export function presetsIn(group: PresetGroup): StockPreset[] {
  return STOCK_PRESETS.filter((x) => x.group === group);
}
