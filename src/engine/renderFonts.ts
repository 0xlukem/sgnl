import { GLYPH_RAMPS } from './types';
import type { StudioState } from './types';

/** Wait only for fonts used by this render, never every pending font on the page. */
export async function waitForRenderFonts(state: StudioState): Promise<void> {
  const fonts = new Set<string>();
  if (state.baseCanvas?.mode !== 'blocks' && state.baseCanvas && GLYPH_RAMPS[state.baseCanvas.glyphFamily].group === 'Glyphs') fonts.add(state.baseCanvas.fontFamily ?? 'JetBrains Mono');
  if (state.baseCanvas?.mode !== 'full') for (const region of state.regions) {
    if (!region.hidden && GLYPH_RAMPS[region.glyphFamily].group === 'Glyphs') fonts.add(region.fontFamily ?? 'JetBrains Mono');
  }
  const text = state.crt.textOverlay;
  if (text?.enabled && (text.text?.trim() || text.subtext?.trim())) {
    fonts.add(text.fontStyle === 'minimal-sans' ? 'Space Grotesk' : text.fontStyle === 'ascii-banner' ? 'Space Mono' : 'JetBrains Mono');
    fonts.add('JetBrains Mono');
  }
  if (!fonts.size) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      (async () => {
        if ([...fonts].some(font => font === 'Space Mono' || font === 'Fira Code')) {
          const link = document.getElementById('studio-glyph-fonts') as HTMLLinkElement | null;
          if (link && !link.sheet) await new Promise<void>((resolve,reject) => {
            link.addEventListener('load',()=>resolve(),{once:true});
            link.addEventListener('error',()=>reject(new Error('A selected font could not load. Choose another font and retry.')),{once:true});
          });
        }
        await Promise.all([...fonts].map(font => document.fonts.load(`600 16px "${font}"`)));
      })(),
      new Promise<never>((_,reject) => {timer=setTimeout(()=>reject(new Error('A selected font is still loading. Wait a moment or choose another font, then retry.')),5000);}),
    ]);
  } finally {if (timer) clearTimeout(timer);}
}
