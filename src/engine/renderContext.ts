import type { StudioState, StudioWorkspace } from './types';

export const RENDER_DEFAULTS = {
  motionAmount: 50,
  hoverRadius: 18,
  hoverStrength: 65,
  playbackSpeed: 1,
} as const;

interface RenderContextOptions {
  time: number;
  intent?: StudioWorkspace;
  animationEnabled?: boolean;
  playbackSpeed?: number;
}

/** A render context never changes the document or its stored animation settings. */
export function resolveRenderContext(state: StudioState, options: RenderContextOptions) {
  // Old fixtures/callers remain temporal unless they opt into the explicit task contract.
  const legacy = options.intent === undefined;
  const animationEnabled = options.animationEnabled ?? (legacy ? true : state.animation?.enabled ?? true);
  const temporal = options.intent !== 'image' && animationEnabled;
  const rawSpeed = options.playbackSpeed ?? (legacy ? 1 : state.animation?.playbackSpeed ?? 1);
  const speed = Number.isFinite(rawSpeed) ? Math.max(0.1, Math.min(3, rawSpeed)) : 1;
  const time = Number.isFinite(options.time) ? Math.max(0, options.time) : 0;
  const clock = temporal ? time * speed : 0;
  const channels = state.animation?.channels;
  return {
    time: clock,
    motionEnabled: temporal,
    distortionTime: channels?.distortion === false ? 0 : clock,
    trackingTime: channels?.tracking === false ? 0 : clock,
    glitchTime: channels?.glitch === false ? 0 : clock,
    texturesTime: channels?.textures === false ? 0 : clock,
  };
}

/** Materialize the actual interval, including the interval formerly used for crossed legacy values. */
export function normalizePixelSortRange(minimum: number, maximum: number) {
  const low = Number.isFinite(minimum) ? Math.max(0, Math.min(95, minimum)) : 25;
  const high = Number.isFinite(maximum) ? Math.max(5, Math.min(100, maximum)) : 80;
  return {
    min: Math.max(0, Math.min(low, high - 5)),
    max: Math.min(100, Math.max(high, low + 5)),
  };
}

export function getPaletteColors(source: {
  color: string;
  customColorHex?: string;
  secondaryColorHex?: string;
  paletteModified?: boolean;
}, palette: { hex: string; secondaryHex?: string }) {
  return {
    primary: source.color === 'custom' ? source.customColorHex || '#00FF66' : palette.hex,
    secondary: source.color === 'custom' || source.paletteModified
      ? source.secondaryColorHex || palette.secondaryHex || '#FF3B7F'
      : palette.secondaryHex,
  };
}
