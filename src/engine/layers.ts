import type { AsciiRegion, BaseCanvasSettings, StudioState } from './types';
import { DEFAULT_BASE_CANVAS } from './types';

type Geometry = Pick<AsciiRegion, 'x' | 'y' | 'w' | 'h'>;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function nextLayerName(regions: AsciiRegion[], stem = 'Layer'): string {
  const names = new Set(regions.map((region) => region.label));
  let index = 1;
  while (names.has(`${stem} ${String(index).padStart(2, '0')}`)) index++;
  return `${stem} ${String(index).padStart(2, '0')}`;
}

function newId() {
  return `layer-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
}

/** One constructor for Add, drawn layers and duplicate. Geometry never inherits a source ID. */
export function createStudioLayer(
  state: StudioState,
  selectedRegionId: string | null,
  geometry: Partial<Geometry> = {},
): AsciiRegion {
  const selected = state.regions.find((region) => region.id === selectedRegionId && !region.hidden);
  const source: BaseCanvasSettings | AsciiRegion = selected ?? state.baseCanvas ?? DEFAULT_BASE_CANVAS;
  const {
    cellSize, glyphFamily, color, customColorHex, secondaryColorHex, paletteModified,
    knockoutOpacity, contrast, substrateMode, invert, customChars, wordmarkText,
    fontFamily, tileGap, tileRoundness, printAngle, printWeight, printRoughness,
    printRegistration,
  } = source;
  return {
    id: newId(), label: nextLayerName(state.regions),
    ...clampLayerGeometry({ x: 0.2, y: 0.22, w: 0.6, h: 0.42, ...geometry }),
    cellSize, glyphFamily, color, customColorHex, secondaryColorHex, paletteModified,
    knockoutOpacity, contrast, substrateMode, invert, customChars, wordmarkText,
    fontFamily, tileGap, tileRoundness, printAngle, printWeight, printRoughness,
    printRegistration, shape: selected?.shape ?? 'rect',
    hudFrame: selected?.hudFrame ?? false, blendMode: selected?.blendMode,
  };
}

export function duplicateStudioLayer(
  region: AsciiRegion,
  regions: AsciiRegion[],
  imageWidth = 1000,
  imageHeight = 1000,
): AsciiRegion {
  const stem = `${region.label.replace(/ copy \d+$/, '')} copy`;
  return {
    ...region, id: newId(), label: nextLayerName(regions, stem), hidden: false, locked: false,
    ...clampLayerGeometry({
      x: region.x + 12 / imageWidth, y: region.y + 12 / imageHeight,
      w: region.w, h: region.h,
    }, imageWidth, imageHeight),
  };
}

export function clampLayerGeometry(
  geometry: Geometry,
  imageWidth = 1000,
  imageHeight = 1000,
): Geometry {
  const minW = Math.min(1, 8 / Math.max(1, imageWidth));
  const minH = Math.min(1, 8 / Math.max(1, imageHeight));
  const w = clamp(Number.isFinite(geometry.w) ? geometry.w : minW, minW, 1);
  const h = clamp(Number.isFinite(geometry.h) ? geometry.h : minH, minH, 1);
  return {
    x: clamp(Number.isFinite(geometry.x) ? geometry.x : 0, 0, 1 - w),
    y: clamp(Number.isFinite(geometry.y) ? geometry.y : 0, 0, 1 - h),
    w, h,
  };
}

export function nudgeStudioLayer(
  region: AsciiRegion,
  key: string,
  imageWidth: number,
  imageHeight: number,
  coarse = false,
): AsciiRegion {
  if (region.locked || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(key)) return region;
  const pixels = coarse ? 10 : 1;
  return {
    ...region,
    ...clampLayerGeometry({
      x: region.x + (key === 'ArrowRight' ? pixels : key === 'ArrowLeft' ? -pixels : 0) / imageWidth,
      y: region.y + (key === 'ArrowDown' ? pixels : key === 'ArrowUp' ? -pixels : 0) / imageHeight,
      w: region.w, h: region.h,
    }, imageWidth, imageHeight),
  };
}

/** Solo is derived preview state: it never changes saved layer visibility or the base. */
export function getSoloPreviewState(state: StudioState, soloRegionId: string | null): StudioState {
  if (!soloRegionId || !state.regions.some((region) => region.id === soloRegionId)) return state;
  return {
    ...state,
    baseCanvas: { ...(state.baseCanvas ?? DEFAULT_BASE_CANVAS), mode: 'blocks' },
    regions: state.regions.map((region) => ({ ...region, hidden: region.id !== soloRegionId })),
  };
}
