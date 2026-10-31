import { GLYPH_RAMPS } from './types';
import type { GlyphFamily, PhosphorColor } from './types';

export function getEngineCapabilities(engine: GlyphFamily, color: PhosphorColor = 'green') {
  const group = GLYPH_RAMPS[engine].group;
  const glyphs = group === 'Glyphs';
  const print = group === 'Print & Etch';
  const dual = color === 'custom' || color === 'risograph';
  return {
    group, typography: glyphs,
    primaryInk: engine !== 'cmyk',
    secondaryInk: glyphs || ['dither-bayer', 'halftone', 'engraving', 'stipple', 'woodblock', 'risograph-print', 'pointillism'].includes(engine),
    printAngle: ['engraving', 'crosshatch', 'risograph-print', 'pointillism'].includes(engine),
    printWeight: print, printRoughness: print,
    printRegistration: engine === 'risograph-print' || (dual && (glyphs || ['engraving', 'stipple', 'woodblock'].includes(engine))),
    tileGap: group === 'Tiles & Halftone',
    tileRoundness: ['mosaic', 'lego'].includes(engine),
  };
}
