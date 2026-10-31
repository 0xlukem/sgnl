import type { AsciiRegion, BaseCanvasSettings, StudioState } from './types';
import { GLYPH_RAMPS } from './types';
import { getEngineCapabilities } from './engineCapabilities';

type StyleSource = BaseCanvasSettings | AsciiRegion;

interface AvailabilityContext {
  state: StudioState;
  baseCanvas: BaseCanvasSettings;
  source: StyleSource;
  target: 'base' | 'layer';
  selectedRegion: AsciiRegion | null;
  previewScale?: number;
}

const isGlyph = (source: StyleSource) => GLYPH_RAMPS[source.glyphFamily]?.group === 'Glyphs';
const usesSourceRgb = (source: StyleSource) =>
  source.color === 'sampled' || source.glyphFamily === 'cmyk' || source.glyphFamily === 'risograph-print';

/** Reasons follow the renderer's actual branches, including global passes and visible layers. */
export function getDisabledControls({
  state, baseCanvas, source, target, selectedRegion, previewScale,
}: AvailabilityContext): Readonly<Record<string, string>> {
  const reasons: Record<string, string> = {};
  const disable = (ids: string[], reason: string | undefined) => {
    if (reason) for (const id of ids) reasons[id] ??= reason;
  };
  const visibleSources: StyleSource[] = [];
  if (baseCanvas.mode !== 'blocks') visibleSources.push(baseCanvas);
  if (baseCanvas.mode !== 'full') {
    visibleSources.push(...state.regions.filter((region) => !region.hidden));
  }

  const targetReason = target === 'base' && baseCanvas.mode === 'blocks'
    ? 'Base Canvas is not visible in Layered. Use Full Frame or Hybrid.'
    : target === 'layer' && baseCanvas.mode === 'full'
    ? 'Layers are not visible in Full Frame. Use Layered or Hybrid.'
    : target === 'layer' && selectedRegion?.hidden
    ? 'Show the selected layer to use these controls.'
    : undefined;
  disable([
    'style-cell-size', 'style-local-contrast', 'print-angle', 'print-weight',
    'print-roughness', 'print-registration', 'tile-gap', 'tile-roundness',
    'canvas-knockout-opacity',
  ], targetReason);

  const engine = source.glyphFamily;
  const capabilities = getEngineCapabilities(engine, source.color);
  disable(['print-angle'], capabilities.printAngle ? undefined : 'This engine does not use a print angle.');
  disable(['print-weight', 'print-roughness'], capabilities.printWeight ? undefined : 'Use a Print engine.');
  disable(['print-registration'], capabilities.printRegistration ? undefined : 'Use Riso, or dual-ink Glyphs / Etch / Stipple / Woodblock.');
  disable(['tile-gap'], capabilities.tileGap ? undefined : 'Use a Tiles engine.');
  disable(['tile-roundness'], capabilities.tileRoundness ? undefined : 'Only Mosaic Tiles and Studded Bricks use corner radius.');

  disable(['canvas-knockout-opacity'], source.substrateMode === 'transparent'
    ? 'Transparent substrate does not use opacity.' : undefined);
  disable(['canvas-'], visibleSources.some((item) => item.substrateMode === 'glass')
    ? undefined : 'Use Frosted Glass on a visible canvas or layer.');
  disable(['layer-feather'], 'Edge feathering is not available yet.');
  disable(['txt-size', 'txt-x', 'txt-y'], state.crt.textOverlay?.enabled && (state.crt.textOverlay.text.trim() || state.crt.textOverlay.subtext?.trim())
    ? undefined : 'Enable Poster Text Overlay and enter text.');

  const noRenderedSource = visibleSources.length === 0
    ? 'Add or show a layer, or use Full Frame / Hybrid.' : undefined;
  disable([
    'grade-brightness', 'grade-contrast', 'grade-saturation', 'grade-black', 'grade-white',
    'grade-gamma', 'grade-shadows', 'grade-highlights', 'grade-edge', 'grade-sharpen',
    'grade-denoise', 'warp-intensity', 'warp-radius', 'warp-frequency', 'warp-angle',
    'motion-speed', 'motion-amount', 'crt-glow',
  ], noRenderedSource);
  disable(['grade-saturation'], visibleSources.some(usesSourceRgb)
    ? undefined : 'Use Photo RGB ink, CMYK Rosette or Risograph 2-Drum on a visible layer or canvas.');

  const warp = state.grading.warpMode ?? 'off';
  disable(['warp-intensity', 'warp-radius', 'warp-frequency', 'warp-angle'], warp === 'off'
    ? 'Choose a Field Distortion mode.' : undefined);
  disable(['warp-radius'], ['swirl', 'pinch', 'sphere', 'polar'].includes(warp)
    ? undefined : 'Field Radius is used by Swirl, Pinch, Sphere and Polar.');
  disable(['warp-frequency'], ['ripple', 'wave', 'zigzag', 'fragment'].includes(warp)
    ? undefined : 'Frequency is used by Ripple, Wave, Zigzag and Fragment.');
  disable(['warp-angle'], ['wave', 'zigzag', 'shear', 'polar'].includes(warp)
    ? undefined : 'Angle is used by Wave, Zigzag, Shear and Polar.');
  disable(['warp-radius', 'warp-frequency', 'warp-angle'], Math.abs(state.grading.warpIntensity ?? 0) > 0.1
    ? undefined : 'Increase Warp Intensity to use this control.');

  disable(['trk-intensity', 'trk-band-height', 'trk-pos', 'trk-bleed', 'trk-jitter', 'trk-dropouts'],
    state.tracking.enabled ? undefined : 'Enable VHS Tracking.');
  disable(['trk-band-height', 'trk-pos'], state.tracking.intensity > 0
    ? undefined : 'Increase Tracking Intensity to use the band.');
  disable(['gl-freq', 'gl-disp', 'gl-rgb', 'gl-databend', 'ps-strength', 'ps-min', 'ps-max'],
    state.glitch.enabled ? undefined : 'Enable Digital Glitch.');
  disable(['gl-disp'], Math.round((state.glitch.sliceFrequency / 100) * 18) > 0
    ? undefined : 'Increase Row Shift Frequency first.');
  disable(['ps-strength', 'ps-min', 'ps-max'], state.glitch.pixelSortEnabled
    ? undefined : 'Enable Luminance Pixel Sorting.');

  for (let idx = 0; idx < 3; idx++) {
    const light = state.crt.lights?.[idx];
    disable([`light-${idx}-intensity`, `light-${idx}-radius`, `light-${idx}-x`, `light-${idx}-y`],
      light?.enabled ? undefined : `Enable Radial Light ${idx + 1}.`);
    disable([`light-${idx}-radius`, `light-${idx}-x`, `light-${idx}-y`], (light?.intensity ?? 0) > 0
      ? undefined : 'Increase Light Intensity to use this control.');
  }
  const motionMode = state.crt.motionMode ?? 'off';
  // These warps use the same time multiplier even with Photo Animation off.
  const animatedWarp = ['ripple', 'wave', 'swirl'].includes(warp)
    && Math.abs(state.grading.warpIntensity ?? 0) > 0.1;
  disable(['motion-amount'], motionMode === 'off'
    ? 'Choose a Photo Animation mode.' : undefined);
  disable(['motion-speed'], animatedWarp || (motionMode !== 'off' && (state.crt.motionAmount ?? 50) > 0)
    ? undefined : motionMode === 'off'
    ? 'Choose Photo Animation or an active Ripple, Wave or Swirl distortion.'
    : 'Increase Amplitude / Intensity first.');
  disable(['crt-glow'], visibleSources.some(isGlyph)
    ? undefined : 'Char Bloom is available with Glyphs. Use Global Bloom for other engines.');

  const cursor = state.crt.cursorEffect;
  disable(['hover-radius', 'hover-strength'], cursor === 'off'
    ? 'Choose an Interactive Canvas Cursor mode.' : undefined);
  disable(['hover-radius', 'hover-strength'],
    ['repel', 'dissolve', 'water', 'vortex', 'magnetic', 'scatter'].includes(cursor)
      ? noRenderedSource : undefined);
  disable(['hover-radius', 'hover-strength'], cursor === 'loupe' && !visibleSources.some(isGlyph)
    ? 'Loupe magnifies Glyphs. Choose a Glyphs engine.' : undefined);
  return reasons;
}
