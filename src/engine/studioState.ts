import { BUILTIN_RECIPES } from './recipes';
import { DEFAULT_BASE_CANVAS, PHOSPHOR_PALETTES } from './types';
import type { AsciiRegion, BaseCanvasSettings, StudioState } from './types';
import { normalizePixelSortRange, RENDER_DEFAULTS } from './renderContext';

/** Version 2 makes defaults and legacy palette overrides explicit without discarding recipe fields. */
export function normalizeStudioState(raw: StudioState): StudioState & { baseCanvas: BaseCanvasSettings } {
  const fallback = BUILTIN_RECIPES[0].state;
  const sourceDefaults = (source: BaseCanvasSettings | AsciiRegion) => {
    const palette = PHOSPHOR_PALETTES[source.color];
    const legacyOverride = raw.schemaVersion !== 2 && source.color !== 'custom'
      && Boolean(source.secondaryColorHex)
      && source.secondaryColorHex?.toLowerCase() !== palette?.secondaryHex?.toLowerCase();
    return {
      ...source,
      paletteModified: source.paletteModified ?? legacyOverride,
      fontFamily: source.fontFamily ?? 'JetBrains Mono',
      tileGap: source.tileGap ?? 0.15,
      tileRoundness: source.tileRoundness ?? 0.25,
      printAngle: source.printAngle ?? -35,
      printWeight: source.printWeight ?? 1,
      printRoughness: source.printRoughness ?? 0.3,
      printRegistration: source.printRegistration ?? 0.25,
    };
  };
  const glitch = { ...fallback.glitch, ...(raw.glitch ?? {}) };
  const interval = normalizePixelSortRange(glitch.pixelSortMin, glitch.pixelSortMax);
  const speed = raw.animation?.playbackSpeed ?? RENDER_DEFAULTS.playbackSpeed;
  return {
    ...fallback,
    ...raw,
    schemaVersion: 2,
    animation: {
      enabled: raw.animation?.enabled ?? true,
      playbackSpeed: Number.isFinite(speed) ? Math.max(0.1, Math.min(3, speed)) : 1,
      channels: {
        distortion: true, tracking: true, glitch: true, textures: true,
        ...raw.animation?.channels,
      },
    },
    baseCanvas: sourceDefaults({
      ...DEFAULT_BASE_CANVAS,
      ...(fallback.baseCanvas ?? {}),
      ...(raw.baseCanvas ?? {}),
    }) as BaseCanvasSettings,
    regions: (raw.regions ?? fallback.regions).map((region) => sourceDefaults(region) as AsciiRegion),
    grading: { ...fallback.grading, ...(raw.grading ?? {}) },
    tracking: { ...fallback.tracking, ...(raw.tracking ?? {}) },
    glitch: { ...glitch, pixelSortMin: interval.min, pixelSortMax: interval.max },
    crt: {
      ...fallback.crt,
      motionMode: 'off',
      motionSpeed: 100,
      motionAmount: RENDER_DEFAULTS.motionAmount,
      hoverRadius: RENDER_DEFAULTS.hoverRadius,
      hoverStrength: RENDER_DEFAULTS.hoverStrength,
      ...(raw.crt ?? {}),
      hudOverlay: 'off',
    },
  };
}
