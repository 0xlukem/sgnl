import type {
  AsciiRegion,
  BaseCanvasSettings,
  StudioState,
  TextOverlaySettings,
  StudioWorkspace,
} from './types';
import {
  DEFAULT_BASE_CANVAS,
  GLYPH_RAMPS,
  PHOSPHOR_PALETTES,
} from './types';
import { createPRNG, randomInt, randomRange } from './prng';
import { getPaletteColors, normalizePixelSortRange, resolveRenderContext } from './renderContext';
import { wrapPosterLines } from './posterLayout';

export interface CursorPosition {
  /** Normalized 0..1 coordinates on the canvas */
  x: number;
  y: number;
  active: boolean;
}

export interface RenderOptions {
  /** Explicit task: Image freezes temporal passes; Animate uses the governed clock. */
  intent?: StudioWorkspace;
  animationEnabled?: boolean;
  playbackSpeed?: number;
  /** Time in seconds for animated tracking/glitch/motion */
  time: number;
  /** Scale multiplier (1 for preview/native, >1 for 4K upscale export) */
  scale?: number;
  /** If true, renders only the original photo (for instant compare) */
  showOriginalOnly?: boolean;
  /** Optional split-wipe X position (0..1) where left=Original, right=Processed */
  splitWipeX?: number | null;
  /** Optional interactive cursor position for hover effects */
  cursor?: CursorPosition;
}

const BAYER_4X4 = [
  [0 / 16, 8 / 16, 2 / 16, 10 / 16],
  [12 / 16, 4 / 16, 14 / 16, 6 / 16],
  [3 / 16, 11 / 16, 1 / 16, 9 / 16],
  [15 / 16, 7 / 16, 13 / 16, 5 / 16],
];

const BAYER_8X8 = [
  [0 / 64, 32 / 64, 8 / 64, 40 / 64, 2 / 64, 34 / 64, 10 / 64, 42 / 64],
  [48 / 64, 16 / 64, 56 / 64, 24 / 64, 50 / 64, 18 / 64, 58 / 64, 26 / 64],
  [12 / 64, 44 / 64, 4 / 64, 36 / 64, 14 / 64, 46 / 64, 6 / 64, 38 / 64],
  [60 / 64, 28 / 64, 52 / 64, 20 / 64, 62 / 64, 30 / 64, 54 / 64, 22 / 64],
  [3 / 64, 35 / 64, 11 / 64, 43 / 64, 1 / 64, 33 / 64, 9 / 64, 41 / 64],
  [51 / 64, 19 / 64, 59 / 64, 27 / 64, 49 / 64, 17 / 64, 57 / 64, 25 / 64],
  [15 / 64, 47 / 64, 7 / 64, 39 / 64, 13 / 64, 45 / 64, 5 / 64, 37 / 64],
  [63 / 64, 31 / 64, 55 / 64, 23 / 64, 61 / 64, 29 / 64, 53 / 64, 21 / 64],
];

let offscreenSourceCanvas: HTMLCanvasElement | null = null;
let offscreenBlurCanvas: HTMLCanvasElement | null = null;
let offscreenWorkCanvas: HTMLCanvasElement | null = null;

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16) || 0;
    const g = parseInt(clean[1] + clean[1], 16) || 0;
    const b = parseInt(clean[2] + clean[2], 16) || 0;
    return [r, g, b];
  }
  const num = parseInt(clean.slice(0, 6), 16);
  if (Number.isNaN(num)) return [0, 255, 102];
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function drawFramedImage(
  targetCtx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  width: number,
  height: number,
  baseCanvas: BaseCanvasSettings
): void {
  const zoom = Math.max(1, Math.min(3, baseCanvas.zoom ?? 1));
  const panX = Math.max(-0.5, Math.min(0.5, baseCanvas.panX ?? 0));
  const panY = Math.max(-0.5, Math.min(0.5, baseCanvas.panY ?? 0));
  const flipX = Boolean(baseCanvas.flipX);
  const flipY = Boolean(baseCanvas.flipY);

  if (zoom === 1 && panX === 0 && panY === 0 && !flipX && !flipY) {
    targetCtx.drawImage(img, 0, 0, width, height);
    return;
  }

  targetCtx.save();
  targetCtx.translate(width * 0.5 + panX * width, height * 0.5 + panY * height);
  targetCtx.scale((flipX ? -1 : 1) * zoom, (flipY ? -1 : 1) * zoom);
  targetCtx.drawImage(img, -width * 0.5, -height * 0.5, width, height);
  targetCtx.restore();
}

function getSourceImageData(
  img: HTMLImageElement,
  width: number,
  height: number,
  baseCanvas: BaseCanvasSettings
): ImageData {
  if (!offscreenSourceCanvas) {
    offscreenSourceCanvas = document.createElement('canvas');
  }
  if (
    offscreenSourceCanvas.width !== width ||
    offscreenSourceCanvas.height !== height
  ) {
    offscreenSourceCanvas.width = width;
    offscreenSourceCanvas.height = height;
  }
  const sctx = offscreenSourceCanvas.getContext('2d', {
    willReadFrequently: true,
  })!;
  sctx.clearRect(0, 0, width, height);
  drawFramedImage(sctx, img, width, height, baseCanvas);
  return sctx.getImageData(0, 0, width, height);
}

function getBlurredCanvas(
  img: HTMLImageElement,
  width: number,
  height: number,
  baseCanvas: BaseCanvasSettings,
  blurPx = 12
): HTMLCanvasElement {
  if (!offscreenBlurCanvas) {
    offscreenBlurCanvas = document.createElement('canvas');
  }
  // Zero blur must not introduce blur through downsampling either.
  const resolution = blurPx > 0 ? 0.25 : 1;
  const bw = Math.max(1, Math.round(width * resolution));
  const bh = Math.max(1, Math.round(height * resolution));
  if (offscreenBlurCanvas.width !== bw || offscreenBlurCanvas.height !== bh) {
    offscreenBlurCanvas.width = bw;
    offscreenBlurCanvas.height = bh;
  }
  const bctx = offscreenBlurCanvas.getContext('2d')!;
  bctx.clearRect(0, 0, bw, bh);
  const scaledBlur = Math.max(0, blurPx * 0.5);
  bctx.filter = `blur(${scaledBlur}px) saturate(1.25) brightness(0.45)`;
  drawFramedImage(bctx, img, bw, bh, baseCanvas);
  bctx.filter = 'none';
  return offscreenBlurCanvas;
}

function getWorkCanvas(width: number, height: number): HTMLCanvasElement {
  if (!offscreenWorkCanvas) {
    offscreenWorkCanvas = document.createElement('canvas');
  }
  if (
    offscreenWorkCanvas.width !== width ||
    offscreenWorkCanvas.height !== height
  ) {
    offscreenWorkCanvas.width = width;
    offscreenWorkCanvas.height = height;
  }
  return offscreenWorkCanvas;
}

function applyCurvePreset(
  v: number,
  preset: StudioState['grading']['curvePreset']
): number {
  switch (preset) {
    case 's-curve':
      return v * v * (3 - 2 * v);
    case 'high-contrast': {
      const c = Math.max(0, Math.min(1, (v - 0.5) * 1.45 + 0.5));
      return c * c * (3 - 2 * c);
    }
    case 'faded-film':
      return 0.08 + v * 0.82;
    case 'crushed-blacks': {
      const cb = Math.max(0, (v - 0.14) / 0.86);
      return Math.pow(cb, 1.15);
    }
    case 'solarize':
      return v > 0.5 ? Math.max(0, 1 - (v - 0.5) * 1.75) : Math.min(1, v * 1.4);
    case 'inverse':
      return 1 - v;
    case 'linear':
    default:
      return v;
  }
}

function gradeLuminance(
  rawLuma01: number,
  brightness01: number,
  blackPt01: number,
  whitePt01: number,
  invGamma: number,
  contrastFactor: number,
  regionContrast: number,
  shadows01: number,
  highlights01: number,
  curvePreset: StudioState['grading']['curvePreset'],
  invert?: boolean
): number {
  const span = Math.max(0.05, whitePt01 - blackPt01);
  let v = (rawLuma01 + brightness01 - blackPt01) / span;
  v = Math.max(0, Math.min(1, v));
  if (invGamma !== 1) {
    v = Math.pow(v, invGamma);
  }
  if (shadows01 !== 0) {
    const sw = (1 - v) * (1 - v);
    v += shadows01 * 0.36 * sw;
  }
  if (highlights01 !== 0) {
    const hw = v * v;
    v += highlights01 * 0.36 * hw;
  }
  v = Math.max(0, Math.min(1, v));
  const totalContrast = contrastFactor * regionContrast;
  v = (v - 0.5) * totalContrast + 0.5;
  v = Math.max(0, Math.min(1, v));
  if (curvePreset && curvePreset !== 'linear') {
    v = Math.max(0, Math.min(1, applyCurvePreset(v, curvePreset)));
  }
  return invert ? 1 - v : v;
}

function clipRegionShape(
  ctx: CanvasRenderingContext2D,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
  shape: 'rect' | 'ellipse' = 'rect'
) {
  ctx.beginPath();
  if (shape === 'ellipse') {
    ctx.ellipse(
      rx + rw * 0.5,
      ry + rh * 0.5,
      rw * 0.5,
      rh * 0.5,
      0,
      0,
      Math.PI * 2
    );
  } else {
    ctx.rect(rx, ry, rw, rh);
  }
  ctx.clip();
}

interface SampledCell {
  r: number;
  g: number;
  b: number;
  luma: number;
  edgeMag: number;
  gradX: number;
  gradY: number;
  sheen: number;
}

/**
 * Main deterministic studio render pipeline:
 * Full-Frame / Hybrid / Block Layers + 29 Render Styles + 9 Warps + Pre-Grading + Lights + Text Overlay + Signal/CRT.
 */
export function renderStudioFrame(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  state: StudioState,
  options: RenderOptions
): void {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  const scale = options.scale ?? 1;
  const context = resolveRenderContext(state, options);
  const renderTime = context.time;
  const baseCanvas = state.baseCanvas ?? DEFAULT_BASE_CANVAS;

  ctx.save();
  ctx.clearRect(0, 0, width, height);

  // 1. Base Layer: Framed sharp photograph
  drawFramedImage(ctx, img, width, height, baseCanvas);

  if (options.showOriginalOnly) {
    ctx.restore();
    return;
  }

  const sourceData = getSourceImageData(img, width, height, baseCanvas);
  const pixels = sourceData.data;

  const grading = state.grading ?? {
    brightness: 0,
    blackPoint: 5,
    whitePoint: 95,
    gamma: 1.0,
    contrast: 110,
    shadows: 0,
    highlights: 0,
    edgeBoost: 25,
    denoise: 0,
    sharpen: 0,
    saturation: 100,
    curvePreset: 'linear',
    warpMode: 'off',
    warpIntensity: 0,
  };

  const brightness01 = (grading.brightness ?? 0) / 100;
  const blackPt01 = grading.blackPoint / 100;
  const whitePt01 = Math.max(blackPt01 + 0.05, grading.whitePoint / 100);
  const invGamma = 1 / Math.max(0.25, grading.gamma);
  const globalContrast = grading.contrast / 100;
  const shadows01 = (grading.shadows ?? 0) / 100;
  const highlights01 = (grading.highlights ?? 0) / 100;
  const edgeBoost01 = grading.edgeBoost / 100;
  const denoise01 = (grading.denoise ?? 0) / 100;
  const sharpen01 = (grading.sharpen ?? 0) / 100;
  const satFactor = (grading.saturation ?? 100) / 100;
  const curvePreset = grading.curvePreset ?? 'linear';

  const warpMode = grading.warpMode ?? 'off';
  const warpStrength = (grading.warpIntensity ?? 0) / 100;
  const warpCenterX = (grading.warpCenterX ?? 0.5) * width;
  const warpCenterY = (grading.warpCenterY ?? 0.5) * height;
  const maxDim = Math.max(width, height);
  const warpRadiusPx = Math.max(
    24,
    (grading.warpRadius ?? 0.75) * Math.hypot(width, height) * 0.5
  );
  const warpAngleRad = ((grading.warpAngle ?? 0) * Math.PI) / 180;
  const warpFreq = Math.max(1, grading.warpFrequency ?? 6);

  // Still Motion settings (8 modes)
  const motionMode = context.motionEnabled ? state.crt.motionMode ?? 'off' : 'off';
  const motionSpeed = (state.crt.motionSpeed ?? 100) / 100;
  const motionAmount = (state.crt.motionAmount ?? 50) / 100;
  const mTime = renderTime * motionSpeed;
  const warpTime = context.distortionTime * motionSpeed;

  const lightX = (0.5 + 0.34 * Math.cos(mTime * 1.4)) * width;
  const lightY = (0.5 + 0.34 * Math.sin(mTime * 1.1)) * height;
  const lightRadius = Math.hypot(width, height) * 0.48;
  const sheenSweepCenter = ((mTime * 0.36) % 1.4) - 0.2;

  // Active 2D Radial Lights (up to 3)
  const activeLights = (state.crt.lights ?? [])
    .filter((l) => l.enabled && l.intensity > 0)
    .slice(0, 3)
    .map((l) => ({
      px: l.x * width,
      py: l.y * height,
      radiusPx: Math.max(20, l.radius * Math.hypot(width, height) * 0.5),
      strength: l.intensity / 100,
      rgb: hexToRgb(l.color || '#00FF66'),
      hex: l.color || '#00FF66',
    }));

  // Helper to sample graded luma + edge gradient + lights + motion at pixel (rawCx, rawCy)
  const sampleCell = (
    rawCx: number,
    rawCy: number,
    step: number,
    regionContrast: number,
    invert?: boolean
  ): SampledCell => {
    let cx = rawCx;
    let cy = rawCy;

    // Still Motion coordinate transforms ('parallax', 'push')
    if (motionMode === 'parallax' && motionAmount > 0) {
      cx += Math.cos(mTime * 1.4) * 22 * motionAmount * scale;
      cy += Math.sin(mTime * 2.8) * 12 * motionAmount * scale;
    } else if (motionMode === 'push' && motionAmount > 0) {
      const pushZoom = 1 + (0.09 + 0.09 * Math.sin(mTime * 0.85)) * motionAmount;
      cx = width * 0.5 + (cx - width * 0.5) / pushZoom;
      cy = height * 0.5 + (cy - height * 0.5) / pushZoom;
    }

    // 9 Pre-Quantization Source Warps
    if (warpMode !== 'off' && Math.abs(warpStrength) > 0.001) {
      const dx = cx - warpCenterX;
      const dy = cy - warpCenterY;
      const dist = Math.hypot(dx, dy);

      if (warpMode === 'ripple') {
        const angle = Math.atan2(dy, dx);
        const waveOffset =
          Math.sin((dist / (maxDim * 0.25)) * warpFreq * Math.PI - warpTime * 2.8) *
          warpStrength *
          26 *
          scale;
        cx += Math.cos(angle) * waveOffset;
        cy += Math.sin(angle) * waveOffset;
      } else if (warpMode === 'wave') {
        const amp = warpStrength * 28 * scale;
        const rotX = dx * Math.cos(warpAngleRad) + dy * Math.sin(warpAngleRad);
        const rotY = -dx * Math.sin(warpAngleRad) + dy * Math.cos(warpAngleRad);
        const dRotX =
          Math.sin((rotY / height) * warpFreq * Math.PI * 2 + warpTime * 2.2) * amp;
        const dRotY =
          Math.cos((rotX / width) * warpFreq * Math.PI * 2 + warpTime * 1.8) *
          amp *
          0.65;
        cx +=
          dRotX * Math.cos(-warpAngleRad) + dRotY * Math.sin(-warpAngleRad);
        cy +=
          -dRotX * Math.sin(-warpAngleRad) + dRotY * Math.cos(-warpAngleRad);
      } else if (warpMode === 'swirl') {
        if (dist < warpRadiusPx) {
          const falloff = 1 - dist / warpRadiusPx;
          const twist =
            falloff *
            falloff *
            warpStrength *
            2.8 *
            (1 + 0.1 * Math.sin(warpTime * 1.6));
          const cosT = Math.cos(twist);
          const sinT = Math.sin(twist);
          cx = warpCenterX + dx * cosT - dy * sinT;
          cy = warpCenterY + dx * sinT + dy * cosT;
        }
      } else if (warpMode === 'pinch') {
        if (dist > 0.001 && dist < warpRadiusPx) {
          const normD = dist / warpRadiusPx;
          const power =
            warpStrength >= 0
              ? 1 + warpStrength * 1.35
              : 1 / (1 - warpStrength * 1.1);
          const factor = Math.pow(normD, power) / normD;
          cx = warpCenterX + dx * factor;
          cy = warpCenterY + dy * factor;
        }
      } else if (warpMode === 'sphere') {
        if (dist < warpRadiusPx) {
          const normD = dist / warpRadiusPx;
          const z = Math.sqrt(Math.max(0, 1 - normD * normD));
          const refract = 1 - warpStrength * 0.58 * z;
          cx = warpCenterX + dx * refract;
          cy = warpCenterY + dy * refract;
        }
      } else if (warpMode === 'zigzag') {
        const rotY = -dx * Math.sin(warpAngleRad) + dy * Math.cos(warpAngleRad);
        const phase = ((rotY / height) * warpFreq * 2) % 1;
        const normPhase = phase < 0 ? phase + 1 : phase;
        const tri = normPhase < 0.5 ? normPhase * 4 - 1 : 3 - normPhase * 4;
        const shift = tri * warpStrength * 30 * scale;
        cx += Math.cos(warpAngleRad) * shift;
        cy += Math.sin(warpAngleRad) * shift;
      } else if (warpMode === 'shear') {
        const perp = -dx * Math.sin(warpAngleRad) + dy * Math.cos(warpAngleRad);
        const shift = (perp / (height * 0.5)) * warpStrength * width * 0.28;
        cx += Math.cos(warpAngleRad) * shift;
        cy += Math.sin(warpAngleRad) * shift;
      } else if (warpMode === 'polar') {
        const angle = (Math.atan2(dy, dx) + warpAngleRad + Math.PI) / (Math.PI * 2);
        const normAngle = ((angle % 1) + 1) % 1;
        const polarX = normAngle * width;
        const polarY = Math.min(1, dist / warpRadiusPx) * height;
        const mix = Math.min(1, Math.abs(warpStrength));
        cx = cx * (1 - mix) + polarX * mix;
        cy = cy * (1 - mix) + polarY * mix;
      } else if (warpMode === 'fragment') {
        const blockSz = Math.max(18 * scale, width / Math.max(3, warpFreq * 2));
        const bx = Math.floor(cx / blockSz);
        const by = Math.floor(cy / blockSz);
        const h1 = Math.sin(bx * 12.9898 + by * 78.233) * 43758.5453;
        const h2 = Math.sin(bx * 93.989 + by * 47.345) * 28461.317;
        const ox = (h1 - Math.floor(h1) - 0.5) * 2;
        const oy = (h2 - Math.floor(h2) - 0.5) * 2;
        cx += ox * warpStrength * blockSz * 0.85;
        cy += oy * warpStrength * blockSz * 0.85;
      }
    }

    const x = Math.min(width - 1, Math.max(0, Math.floor(cx)));
    const y = Math.min(height - 1, Math.max(0, Math.floor(cy)));
    const idx = (y * width + x) * 4;
    let r = pixels[idx];
    let g = pixels[idx + 1];
    let b = pixels[idx + 2];

    const xR = Math.min(width - 1, x + step);
    const xL = Math.max(0, x - step);
    const yD = Math.min(height - 1, y + step);
    const yU = Math.max(0, y - step);

    const idxR = (y * width + xR) * 4;
    const idxL = (y * width + xL) * 4;
    const idxD = (yD * width + x) * 4;
    const idxU = (yU * width + x) * 4;

    // Optional edge-preserving 5-tap Denoise
    if (denoise01 > 0.01) {
      const wMix = denoise01 * 0.6;
      r = Math.round(
        r * (1 - wMix) +
          ((pixels[idxR] + pixels[idxL] + pixels[idxD] + pixels[idxU]) * 0.25) *
            wMix
      );
      g = Math.round(
        g * (1 - wMix) +
          ((pixels[idxR + 1] +
            pixels[idxL + 1] +
            pixels[idxD + 1] +
            pixels[idxU + 1]) *
            0.25) *
            wMix
      );
      b = Math.round(
        b * (1 - wMix) +
          ((pixels[idxR + 2] +
            pixels[idxL + 2] +
            pixels[idxD + 2] +
            pixels[idxU + 2]) *
            0.25) *
            wMix
      );
    }

    const rawLuma255 = 0.299 * r + 0.587 * g + 0.114 * b;
    let rawLuma = rawLuma255 / 255;

    if (satFactor !== 1) {
      r = Math.min(
        255,
        Math.max(0, Math.round(rawLuma255 + (r - rawLuma255) * satFactor))
      );
      g = Math.min(
        255,
        Math.max(0, Math.round(rawLuma255 + (g - rawLuma255) * satFactor))
      );
      b = Math.min(
        255,
        Math.max(0, Math.round(rawLuma255 + (b - rawLuma255) * satFactor))
      );
    }

    const lumaR =
      (0.299 * pixels[idxR] +
        0.587 * pixels[idxR + 1] +
        0.114 * pixels[idxR + 2]) /
      255;
    const lumaL =
      (0.299 * pixels[idxL] +
        0.587 * pixels[idxL + 1] +
        0.114 * pixels[idxL + 2]) /
      255;
    const lumaD =
      (0.299 * pixels[idxD] +
        0.587 * pixels[idxD + 1] +
        0.114 * pixels[idxD + 2]) /
      255;
    const lumaU =
      (0.299 * pixels[idxU] +
        0.587 * pixels[idxU + 1] +
        0.114 * pixels[idxU + 2]) /
      255;

    // Optional Laplacian Unsharp Mask
    if (sharpen01 > 0.01) {
      const lap = rawLuma * 4 - (lumaR + lumaL + lumaD + lumaU);
      rawLuma = Math.max(0, Math.min(1, rawLuma + lap * sharpen01 * 0.85));
    }

    const gradX = lumaR - lumaL;
    const gradY = lumaD - lumaU;
    const edgeMag = Math.min(1, Math.hypot(gradX, gradY) * 1.9);

    const boostedRaw = Math.min(1, rawLuma + edgeMag * edgeBoost01 * 0.45);
    let luma = gradeLuminance(
      boostedRaw,
      brightness01,
      blackPt01,
      whitePt01,
      invGamma,
      globalContrast,
      regionContrast,
      shadows01,
      highlights01,
      curvePreset,
      invert
    );

    let sheen = 0;

    // 2D Radial Lights contribution on cell luminance & tint
    for (let li = 0; li < activeLights.length; li++) {
      const light = activeLights[li];
      const dLight = Math.hypot(rawCx - light.px, rawCy - light.py);
      if (dLight < light.radiusPx) {
        const fall = 1 - dLight / light.radiusPx;
        const boost = fall * fall * light.strength;
        luma = Math.min(1, luma + boost * 0.42);
        sheen = Math.min(1, sheen + boost * 0.45);
        r = Math.min(255, Math.round(r + (light.rgb[0] - r) * boost * 0.55));
        g = Math.min(255, Math.round(g + (light.rgb[1] - g) * boost * 0.55));
        b = Math.min(255, Math.round(b + (light.rgb[2] - b) * boost * 0.55));
      }
    }

    // 8 Still Motion Modes cell modulation
    if (motionMode !== 'off' && motionAmount > 0) {
      if (motionMode === 'relight') {
        const distToLight = Math.hypot(rawCx - lightX, rawCy - lightY);
        const relightFalloff = Math.max(0, 1 - distToLight / lightRadius);
        const boost = relightFalloff * relightFalloff * 0.38 * motionAmount;
        luma = Math.min(1, luma + boost);
        sheen = Math.min(1, sheen + boost * 0.7);
      } else if (motionMode === 'sheen') {
        const diagPos = (rawCx / width) * 0.65 + (rawCy / height) * 0.35;
        const bandDist = Math.abs(diagPos - sheenSweepCenter);
        if (bandDist < 0.14) {
          sheen = Math.min(
            1,
            sheen + Math.pow(1 - bandDist / 0.14, 2) * motionAmount
          );
          luma = Math.min(1, luma + sheen * 0.34);
        }
      } else if (motionMode === 'glow') {
        const pulse = (0.5 + 0.5 * Math.sin(mTime * 2.2)) * motionAmount;
        if (luma > 0.35) {
          luma = Math.min(1, luma + (luma - 0.35) * 0.45 * pulse);
          sheen = Math.min(1, sheen + (luma - 0.5) * 0.5 * pulse);
        }
      } else if (motionMode === 'shimmer') {
        const tw = Math.sin(mTime * 5.5 + rawCx * 0.17 + rawCy * 0.23);
        if (tw > 0.3 && luma > 0.12) {
          const spark = ((tw - 0.3) / 0.7) * motionAmount;
          luma = Math.min(1, luma + spark * 0.32);
          sheen = Math.min(1, sheen + spark * 0.65);
        }
      } else if (motionMode === 'focus') {
        const focusDist = Math.hypot(rawCx - lightX, rawCy - lightY);
        const ring = Math.abs(focusDist - lightRadius * 0.45);
        if (ring < lightRadius * 0.22) {
          const fBoost =
            (1 - ring / (lightRadius * 0.22)) * 0.32 * motionAmount;
          luma = Math.min(1, luma + edgeMag * fBoost * 1.4);
          sheen = Math.min(1, sheen + fBoost * 0.6);
        } else {
          luma = luma * (1 - 0.22 * motionAmount) + 0.5 * (0.22 * motionAmount);
        }
      } else if (motionMode === 'mist') {
        const fog =
          0.5 +
          0.5 *
            Math.sin(rawCx * 0.007 + mTime * 0.9) *
            Math.cos(rawCy * 0.006 - mTime * 0.65);
        luma = Math.min(1, luma + fog * 0.26 * motionAmount);
      }
    }

    return { r, g, b, luma, edgeMag, gradX, gradY, sheen };
  };

  // Pre-build blurred canvas if baseCanvas or any visible region uses 'glass'
  const baseNeedsGlass =
    (baseCanvas.mode === 'full' || baseCanvas.mode === 'hybrid') &&
    baseCanvas.substrateMode === 'glass';
  const regionNeedsGlass =
    (baseCanvas.mode === 'blocks' || baseCanvas.mode === 'hybrid') &&
    state.regions.some((r) => !r.hidden && r.substrateMode === 'glass');
  const blurredCanvas =
    baseNeedsGlass || regionNeedsGlass
      ? getBlurredCanvas(
          img,
          width,
          height,
          baseCanvas,
          baseCanvas.backdropBlur ?? 12
        )
      : null;

  const textOverlay = state.crt.textOverlay;
  const hasBehindText = Boolean(
    textOverlay?.enabled &&
      (textOverlay.text.trim().length > 0 || Boolean(textOverlay.subtext?.trim())) &&
      textOverlay.layerOrder === 'behind-glyphs'
  );
  const hasFrontText = Boolean(
    textOverlay?.enabled &&
      (textOverlay.text.trim().length > 0 || Boolean(textOverlay.subtext?.trim())) &&
      textOverlay.layerOrder !== 'behind-glyphs'
  );

  // If in 'blocks' mode and text is 'behind-glyphs', render it on the photo before block layers
  if (hasBehindText && textOverlay && baseCanvas.mode === 'blocks') {
    renderTextOverlay(ctx, width, height, textOverlay, scale);
  }

  // 2A. Full-Frame Base Canvas Render ('full' or 'hybrid')
  if (baseCanvas.mode === 'full' || baseCanvas.mode === 'hybrid') {
    const fullRegion: AsciiRegion = {
      id: '__base_canvas__',
      label: 'FULL_CANVAS',
      x: 0,
      y: 0,
      w: 1,
      h: 1,
      cellSize: baseCanvas.cellSize,
      glyphFamily: baseCanvas.glyphFamily,
      color: baseCanvas.color,
      customColorHex: baseCanvas.customColorHex,
      secondaryColorHex: baseCanvas.secondaryColorHex,
      paletteModified: baseCanvas.paletteModified,
      knockoutOpacity: baseCanvas.knockoutOpacity,
      contrast: baseCanvas.contrast,
      substrateMode: baseCanvas.substrateMode,
      invert: baseCanvas.invert,
      customChars: baseCanvas.customChars,
      wordmarkText: baseCanvas.wordmarkText,
      fontFamily: baseCanvas.fontFamily,
      tileGap: baseCanvas.tileGap,
      tileRoundness: baseCanvas.tileRoundness,
      printAngle: baseCanvas.printAngle,
      printWeight: baseCanvas.printWeight,
      printRoughness: baseCanvas.printRoughness,
      printRegistration: baseCanvas.printRegistration,
    };

    renderAsciiRegion(
      ctx,
      fullRegion,
      sampleCell,
      blurredCanvas,
      width,
      height,
      scale,
      state.crt.phosphorGlow,
      state.crt.scanlines,
      options.cursor,
      state.crt.cursorEffect,
      state.crt.hoverRadius ?? 18,
      state.crt.hoverStrength ?? 65,
      renderTime,
      baseCanvas.backdropColor,
      baseCanvas.backdropColor2,
      hasBehindText && textOverlay ? textOverlay : undefined
    );
  }

  // 2B. Render Each Active Block Layer ('blocks' or 'hybrid')
  if (baseCanvas.mode === 'blocks' || baseCanvas.mode === 'hybrid') {
    for (const region of state.regions) {
      if (region.hidden) continue;
      ctx.save();
      ctx.globalCompositeOperation = region.blendMode ?? 'source-over';
      renderAsciiRegion(
        ctx,
        region,
        sampleCell,
        blurredCanvas,
        width,
        height,
        scale,
        state.crt.phosphorGlow,
        state.crt.scanlines,
        options.cursor,
        state.crt.cursorEffect,
        state.crt.hoverRadius ?? 18,
        state.crt.hoverStrength ?? 65,
        renderTime,
        baseCanvas.backdropColor,
        baseCanvas.backdropColor2
      );
      ctx.restore();
    }
  }

  // 2C. Foreground Text Overlay ('front')
  if (hasFrontText && textOverlay) {
    renderTextOverlay(ctx, width, height, textOverlay, scale);
  }

  // 2D. 2D Radial Lights Atmospheric Pass
  if (activeLights.length > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (const light of activeLights) {
      const grad = ctx.createRadialGradient(
        light.px,
        light.py,
        0,
        light.px,
        light.py,
        light.radiusPx
      );
      const [lr, lg, lb] = light.rgb;
      grad.addColorStop(0, `rgba(${lr}, ${lg}, ${lb}, ${light.strength * 0.35})`);
      grad.addColorStop(
        0.5,
        `rgba(${lr}, ${lg}, ${lb}, ${light.strength * 0.14})`
      );
      grad.addColorStop(1, `rgba(${lr}, ${lg}, ${lb}, 0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
    }
    ctx.restore();
  }

  // 3. Pixel Sorting Pass (Luminance Streaks)
  if (
    state.glitch.enabled &&
    state.glitch.pixelSortEnabled &&
    state.glitch.pixelSortStrength > 0
  ) {
    applyPixelSortPass(ctx, width, height, state.glitch);
  }

  // 4. VHS Analog Tape Pass (Chroma Bleed, Line Jitter, Tracking Band, Dropouts)
  if (state.tracking.enabled) {
    applyVhsAndTrackingPass(
      ctx,
      width,
      height,
      state.tracking,
      context.trackingTime,
      scale
    );
  }

  // 5. Glitch & Databend Pass (Row Slices, RGB Split, Databent Chunks)
  if (state.glitch.enabled) {
    applyGlitchAndDatabendPass(
      ctx,
      width,
      height,
      state.glitch,
      context.glitchTime,
      scale
    );
  }

  // 6. Global CRT Optical Finish, Halation, Dust & Hologram Ghost
  applyGlobalCrtOptics(ctx, width, height, state.crt, context.texturesTime, scale);

  // 7. Interactive Cursor Hover Post-Effects
  if (
    options.cursor?.active &&
    state.crt.cursorEffect !== 'off' &&
    (state.crt.hoverStrength ?? 65) > 0
  ) {
    applyCursorHoverEffect(
      ctx,
      img,
      width,
      height,
      options.cursor,
      state.crt.cursorEffect,
      state.crt.hoverRadius ?? 18,
      state.crt.hoverStrength ?? 65,
      baseCanvas
    );
  }

  // 8. Optional Split-Wipe Before/After Comparison
  if (
    typeof options.splitWipeX === 'number' &&
    options.splitWipeX > 0 &&
    options.splitWipeX < 1
  ) {
    const splitPx = Math.round(width * options.splitWipeX);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, splitPx, height);
    ctx.clip();
    drawFramedImage(ctx, img, width, height, baseCanvas);
    ctx.restore();

    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillRect(splitPx - 1, 0, 2, height);
    ctx.restore();
  }

  ctx.restore();
}

function renderTextOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  overlay: TextOverlaySettings,
  scale: number
): void {
  const text = overlay.text.trim();
  const subtext = overlay.subtext?.trim() ?? '';
  if (!text && !subtext) return;

  const padding = Math.min(width * 0.05, Math.max(4, 16 * scale));
  const maxWidth = Math.max(1, width - padding * 2);
  const maxHeight = Math.max(1, height - padding * 2);
  let fontSize = Math.max(4, Math.round((overlay.size || 64) * scale));
  const color = overlay.color || '#F4F4EC';
  const fontFamily = overlay.fontStyle === 'minimal-sans'
    ? '"Space Grotesk", "SF Pro Display", system-ui, sans-serif'
    : overlay.fontStyle === 'ascii-banner'
    ? '"Space Mono", "JetBrains Mono", monospace'
    : '"JetBrains Mono", "Fira Code", monospace';
  const setTitleFont = () => { ctx.font = `700 ${fontSize}px ${fontFamily}`; };
  let titleLines: string[] = [];
  let subtitleLines: string[] = [];
  let subSize = 0;
  let blockHeight = 0;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Fit the full text block instead of silently clipping at an edge position.
  for (let attempt = 0; attempt < 40; attempt++) {
    setTitleFont();
    titleLines = wrapPosterLines(text, maxWidth, (value) => ctx.measureText(value).width);
    subSize = text ? fontSize * 0.28 : fontSize * 0.6;
    ctx.font = `600 ${subSize}px "JetBrains Mono", monospace`;
    subtitleLines = wrapPosterLines(subtext, maxWidth, (value) => ctx.measureText(value).width);
    blockHeight = titleLines.length * fontSize * 1.15
      + (titleLines.length && subtitleLines.length ? fontSize * 0.2 : 0)
      + subtitleLines.length * subSize * 1.3;
    if (blockHeight <= maxHeight || fontSize <= 0.5) break;
    fontSize *= 0.85;
  }
  setTitleFont();
  const titleWidth = Math.max(0, ...titleLines.map((line) => ctx.measureText(line).width));
  ctx.font = `600 ${subSize}px "JetBrains Mono", monospace`;
  const subtitleWidth = Math.max(0, ...subtitleLines.map((line) => ctx.measureText(line).width));
  const blockWidth = Math.min(maxWidth, Math.max(titleWidth, subtitleWidth));
  const tx = Math.max(padding + blockWidth / 2, Math.min(width - padding - blockWidth / 2, overlay.x * width));
  const centerY = Math.max(padding + blockHeight / 2, Math.min(height - padding - blockHeight / 2, overlay.y * height));
  let y = centerY - blockHeight / 2 + fontSize * 0.575;
  setTitleFont();
  for (const line of titleLines) {
    if (overlay.fontStyle === 'ascii-banner') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.fillText(line, tx + 2 * scale, y + 2 * scale, maxWidth);
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(0.5, 1.5 * scale);
      ctx.globalAlpha = 0.45;
      ctx.strokeText(line, tx - scale, y - scale, maxWidth);
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = color;
    ctx.fillText(line, tx, y, maxWidth);
    y += fontSize * 1.15;
  }
  if (titleLines.length) y += fontSize * 0.2 - fontSize * 0.575;
  else y = centerY - blockHeight / 2;
  ctx.font = `600 ${subSize}px "JetBrains Mono", monospace`;
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.82;
  for (const line of subtitleLines) {
    ctx.fillText(line, tx, y + subSize * 0.65, maxWidth);
    y += subSize * 1.3;
  }

  ctx.restore();
}

function renderAsciiRegion(
  ctx: CanvasRenderingContext2D,
  region: AsciiRegion,
  sampleCell: (
    cx: number,
    cy: number,
    step: number,
    regionContrast: number,
    invert?: boolean
  ) => SampledCell,
  blurredCanvas: HTMLCanvasElement | null,
  width: number,
  height: number,
  scale: number,
  globalGlow: number,
  globalScanlines: number,
  cursor?: CursorPosition,
  cursorEffect?: StudioState['crt']['cursorEffect'],
  hoverRadiusPct = 18,
  hoverStrengthPct = 65,
  time = 0,
  backdropColor?: string,
  backdropColor2?: string,
  behindTextOverlay?: TextOverlaySettings
): void {
  const rx = Math.round(region.x * width);
  const ry = Math.round(region.y * height);
  const rw = Math.round(region.w * width);
  const rh = Math.round(region.h * height);

  if (rw <= 2 || rh <= 2) return;

  const baseCellPx = Math.max(4, Math.round(region.cellSize * scale));
  const palette = PHOSPHOR_PALETTES[region.color] ?? PHOSPHOR_PALETTES.green;
  const { primary: primaryHex, secondary: secondaryHex } = getPaletteColors(region, palette);
  const primaryRgb = hexToRgb(primaryHex);

  const ramp = GLYPH_RAMPS[region.glyphFamily] ?? GLYPH_RAMPS.density;
  const chars =
    region.customChars && region.customChars.trim().length > 0
      ? [' ', ...region.customChars.split('')]
      : ramp.chars;
  const wordmark = region.wordmarkText?.trim() ?? '';
  const fontFamily = region.fontFamily ?? 'JetBrains Mono';
  const substrateMode = region.substrateMode ?? 'knockout';
  const shape = region.shape ?? 'rect';

  const tileGap = Math.max(0, Math.min(0.5, region.tileGap ?? 0.15));
  const tileRoundness = Math.max(0, Math.min(1, region.tileRoundness ?? 0.25));
  const printAngleRad = ((region.printAngle ?? -35) * Math.PI) / 180;
  const printWeight = Math.max(0.25, Math.min(2, region.printWeight ?? 1.0));
  const printRoughness = Math.max(0, Math.min(1, region.printRoughness ?? 0.3));
  const printRegistration = Math.max(
    0,
    Math.min(1, region.printRegistration ?? 0.25)
  );

  const cursorActive = Boolean(
    cursor?.active && cursorEffect && cursorEffect !== 'off' && hoverStrengthPct > 0
  );
  const cursorPxX = cursorActive && cursor ? cursor.x * width : -9999;
  const cursorPxY = cursorActive && cursor ? cursor.y * height : -9999;
  const hoverRadiusPx = Math.max(
    16,
    Math.hypot(width, height) * (hoverRadiusPct / 100)
  );
  const hoverStrength01 = hoverStrengthPct / 100;

  // Interactive Cursor Cell Transform (handles repel, magnetic, water, vortex, scatter, dissolve)
  const transformCell = (
    px: number,
    py: number
  ): { x: number; y: number; skip: boolean; boost: number } => {
    if (!cursorActive || !['repel', 'dissolve', 'water', 'vortex', 'magnetic', 'scatter'].includes(cursorEffect ?? 'off')) {
      return { x: px, y: py, skip: false, boost: 0 };
    }
    const dx = px - cursorPxX;
    const dy = py - cursorPxY;
    const dist = Math.hypot(dx, dy);
    if (dist >= hoverRadiusPx) return { x: px, y: py, skip: false, boost: 0 };

    const falloff = 1 - dist / hoverRadiusPx;
    const smoothFall = falloff * falloff;

    if (cursorEffect === 'dissolve') {
      const h =
        Math.sin(px * 12.9898 + py * 78.233) * 43758.5453;
      const cellHash = h - Math.floor(h);
      if (cellHash < falloff * hoverStrength01 * 1.15) {
        return { x: px, y: py, skip: true, boost: 0 };
      }
      return { x: px, y: py, skip: false, boost: 0 };
    }

    if (dist < 0.001) return { x: px, y: py, skip: false, boost: smoothFall * hoverStrength01 };

    if (cursorEffect === 'repel') {
      const push =
        smoothFall *
        hoverStrength01 *
        Math.max(baseCellPx * 2.1, 28 * scale);
      return {
        x: px + (dx / dist) * push,
        y: py + (dy / dist) * push,
        skip: false,
        boost: smoothFall * hoverStrength01 * 0.25,
      };
    }

    if (cursorEffect === 'magnetic') {
      const pull = smoothFall * hoverStrength01 * dist * 0.65;
      return {
        x: px - (dx / dist) * pull,
        y: py - (dy / dist) * pull,
        skip: false,
        boost: smoothFall * hoverStrength01 * 0.55,
      };
    }

    if (cursorEffect === 'water') {
      const wave =
        Math.sin(dist / (8 * scale) - time * 8.5) *
        falloff *
        hoverStrength01 *
        16 *
        scale;
      return {
        x: px + (dx / dist) * wave,
        y: py + (dy / dist) * wave,
        skip: false,
        boost: Math.max(0, wave / (16 * scale)) * 0.45,
      };
    }

    if (cursorEffect === 'vortex') {
      const twist = smoothFall * hoverStrength01 * 2.6;
      const cosT = Math.cos(twist);
      const sinT = Math.sin(twist);
      return {
        x: cursorPxX + dx * cosT - dy * sinT,
        y: cursorPxY + dx * sinT + dy * cosT,
        skip: false,
        boost: smoothFall * hoverStrength01 * 0.35,
      };
    }

    if (cursorEffect === 'scatter') {
      const h1 = Math.sin(px * 12.9898 + py * 78.233) * 43758.5453;
      const h2 = Math.sin(px * 93.989 + py * 47.345) * 28461.317;
      const angle = (h1 - Math.floor(h1)) * Math.PI * 2;
      const mag =
        (0.35 + (h2 - Math.floor(h2)) * 0.65) *
        smoothFall *
        hoverStrength01 *
        Math.max(baseCellPx * 2.8, 36 * scale);
      return {
        x: px + Math.cos(angle) * mag,
        y: py + Math.sin(angle) * mag,
        skip: false,
        boost: smoothFall * hoverStrength01 * 0.3,
      };
    }

    return { x: px, y: py, skip: false, boost: 0 };
  };

  ctx.save();
  clipRegionShape(ctx, rx, ry, rw, rh, shape);

  // Step A: Render Region/Canvas Substrate (all 7 modes)
  if (substrateMode === 'transparent') {
    ctx.clearRect(rx, ry, rw, rh);
  } else if (substrateMode === 'solid') {
    ctx.fillStyle = backdropColor || palette.substrateHex;
    ctx.globalAlpha = region.knockoutOpacity;
    ctx.fillRect(rx, ry, rw, rh);
  } else if (substrateMode === 'gradient') {
    const grad = ctx.createLinearGradient(rx, ry, rx + rw, ry + rh);
    grad.addColorStop(0, backdropColor || palette.substrateHex);
    grad.addColorStop(1, backdropColor2 || '#131824');
    ctx.fillStyle = grad;
    ctx.globalAlpha = region.knockoutOpacity;
    ctx.fillRect(rx, ry, rw, rh);
  } else if (substrateMode === 'glass' && blurredCanvas) {
    ctx.save();
    ctx.globalAlpha = region.knockoutOpacity;
    ctx.drawImage(blurredCanvas, 0, 0, width, height);
    ctx.fillStyle = backdropColor || palette.substrateHex;
    ctx.globalAlpha = region.knockoutOpacity * 0.45;
    ctx.fillRect(rx, ry, rw, rh);
    ctx.restore();
  } else if (substrateMode === 'duotone') {
    ctx.fillStyle = backdropColor || palette.substrateHex;
    ctx.globalAlpha = Math.max(0, Math.min(1, region.knockoutOpacity));
    ctx.fillRect(rx, ry, rw, rh);
  } else if (substrateMode === 'knockout') {
    ctx.fillStyle = palette.substrateHex;
    ctx.globalAlpha = region.knockoutOpacity;
    ctx.fillRect(rx, ry, rw, rh);
  } else {
    // 'source': subtle darkening based on knockoutOpacity * 0.32 so glyphs pop over sharp photo
    ctx.fillStyle = '#040608';
    ctx.globalAlpha = region.knockoutOpacity * 0.32;
    ctx.fillRect(rx, ry, rw, rh);
  }
  ctx.globalAlpha = 1;

  // Render 'behind-glyphs' text overlay right on top of the backdrop substrate before glyphs
  if (behindTextOverlay) {
    renderTextOverlay(ctx, width, height, behindTextOverlay, scale);
  }

  // Step B: Render All 29 Style Engines inside the Region
  const style = region.glyphFamily;
  const stepSample = Math.max(2, Math.floor(baseCellPx * 0.5));

  const getPrimaryColor = (
    r: number,
    g: number,
    b: number,
    luma: number,
    sheen = 0
  ): string => {
    if (sheen > 0.65) {
      return sheen > 0.84 ? '#FFFFFF' : '#B8FAFF';
    }
    if (region.color === 'sampled') {
      const boost = 1.25 + sheen * 0.35;
      return `rgb(${Math.min(255, Math.round(r * boost))}, ${Math.min(
        255,
        Math.round(g * boost)
      )}, ${Math.min(255, Math.round(b * boost))})`;
    }
    if (region.color === 'grayscale') {
      const v = Math.min(255, Math.max(0, Math.round(luma * 255)));
      return `rgb(${v}, ${v}, ${v})`;
    }
    if (
      (region.color === 'gameboy' ||
        region.color === 'blueprint' ||
        region.color === 'newsprint') &&
      secondaryHex &&
      luma < 0.48
    ) {
      return secondaryHex;
    }
    return primaryHex;
  };

  const getPrimaryRgbTuple = (
    r: number,
    g: number,
    b: number,
    luma: number
  ): [number, number, number] => {
    if (region.color === 'sampled') {
      return [r, g, b];
    }
    if (region.color === 'grayscale') {
      const v = Math.min(255, Math.max(0, Math.round(luma * 255)));
      return [v, v, v];
    }
    return primaryRgb;
  };

  if (style === 'dither-bayer') {
    const subSize = Math.max(2, Math.round(baseCellPx / 3));
    let rowIdx = 0;
    for (let cy = ry; cy < ry + rh; cy += subSize, rowIdx++) {
      let colIdx = 0;
      const bayerRow = BAYER_4X4[rowIdx & 3];
      for (let cx = rx; cx < rx + rw; cx += subSize, colIdx++) {
        const { r, g, b, luma, sheen } = sampleCell(
          cx + subSize * 0.5,
          cy + subSize * 0.5,
          subSize,
          region.contrast,
          region.invert
        );
        const threshold = bayerRow[colIdx & 3];
        if (luma > threshold) {
          const tf = transformCell(cx, cy);
          if (tf.skip) continue;
          ctx.fillStyle = getPrimaryColor(r, g, b, luma, sheen + tf.boost);
          ctx.fillRect(tf.x, tf.y, subSize, subSize);
          if (
            (region.color === 'risograph' || region.color === 'custom') &&
            secondaryHex &&
            luma < 0.65
          ) {
            ctx.fillStyle = secondaryHex;
            ctx.globalAlpha = 0.65;
            ctx.fillRect(
              tf.x + Math.round(2 * scale),
              tf.y + Math.round(1 * scale),
              subSize,
              subSize
            );
            ctx.globalAlpha = 1;
          }
        }
      }
    }
  } else if (style === 'dither-bayer8') {
    const subSize = Math.max(2, Math.round(baseCellPx / 3.4));
    let rowIdx = 0;
    for (let cy = ry; cy < ry + rh; cy += subSize, rowIdx++) {
      let colIdx = 0;
      const bayerRow = BAYER_8X8[rowIdx & 7];
      for (let cx = rx; cx < rx + rw; cx += subSize, colIdx++) {
        const { r, g, b, luma, sheen } = sampleCell(
          cx + subSize * 0.5,
          cy + subSize * 0.5,
          subSize,
          region.contrast,
          region.invert
        );
        const threshold = bayerRow[colIdx & 7];
        if (luma > threshold) {
          const tf = transformCell(cx, cy);
          if (tf.skip) continue;
          ctx.fillStyle = getPrimaryColor(r, g, b, luma, sheen + tf.boost);
          ctx.fillRect(tf.x, tf.y, subSize, subSize);
          if (region.color === 'risograph' && secondaryHex && luma < 0.65) {
            ctx.fillStyle = secondaryHex;
            ctx.globalAlpha = 0.6;
            ctx.fillRect(
              tf.x + Math.round(1.5 * scale),
              tf.y + Math.round(1 * scale),
              subSize,
              subSize
            );
            ctx.globalAlpha = 1;
          }
        }
      }
    }
  } else if (style === 'dither-floyd') {
    const subSize = Math.max(3, Math.round(baseCellPx / 2.5));
    const cols = Math.max(1, Math.ceil(rw / subSize));
    const rows = Math.max(1, Math.ceil(rh / subSize));
    const lumaBuf = new Float32Array(cols * rows);
    const sheenBuf = new Float32Array(cols * rows);
    const rgbBuf = new Uint8Array(cols * rows * 3);

    for (let rIdx = 0; rIdx < rows; rIdx++) {
      for (let cIdx = 0; cIdx < cols; cIdx++) {
        const i = rIdx * cols + cIdx;
        const s = sampleCell(
          rx + (cIdx + 0.5) * subSize,
          ry + (rIdx + 0.5) * subSize,
          subSize,
          region.contrast,
          region.invert
        );
        lumaBuf[i] = s.luma * 255;
        sheenBuf[i] = s.sheen;
        rgbBuf[i * 3] = s.r;
        rgbBuf[i * 3 + 1] = s.g;
        rgbBuf[i * 3 + 2] = s.b;
      }
    }

    for (let rIdx = 0; rIdx < rows; rIdx++) {
      for (let cIdx = 0; cIdx < cols; cIdx++) {
        const i = rIdx * cols + cIdx;
        const oldVal = lumaBuf[i];
        const newVal = oldVal >= 127 ? 255 : 0;
        const err = oldVal - newVal;
        lumaBuf[i] = newVal;

        if (cIdx + 1 < cols) lumaBuf[i + 1] += err * (7 / 16);
        if (rIdx + 1 < rows) {
          if (cIdx > 0) lumaBuf[i + cols - 1] += err * (3 / 16);
          lumaBuf[i + cols] += err * (5 / 16);
          if (cIdx + 1 < cols) lumaBuf[i + cols + 1] += err * (1 / 16);
        }

        if (newVal === 255) {
          const tf = transformCell(rx + cIdx * subSize, ry + rIdx * subSize);
          if (tf.skip) continue;
          ctx.fillStyle = getPrimaryColor(
            rgbBuf[i * 3],
            rgbBuf[i * 3 + 1],
            rgbBuf[i * 3 + 2],
            1,
            sheenBuf[i] + tf.boost
          );
          ctx.fillRect(tf.x, tf.y, subSize - 0.35, subSize - 0.35);
        }
      }
    }
  } else if (style === 'dither-atkinson') {
    const subSize = Math.max(3, Math.round(baseCellPx / 2.5));
    const cols = Math.max(1, Math.ceil(rw / subSize));
    const rows = Math.max(1, Math.ceil(rh / subSize));
    const lumaBuf = new Float32Array(cols * rows);
    const sheenBuf = new Float32Array(cols * rows);
    const rgbBuf = new Uint8Array(cols * rows * 3);

    for (let rIdx = 0; rIdx < rows; rIdx++) {
      for (let cIdx = 0; cIdx < cols; cIdx++) {
        const i = rIdx * cols + cIdx;
        const s = sampleCell(
          rx + (cIdx + 0.5) * subSize,
          ry + (rIdx + 0.5) * subSize,
          subSize,
          region.contrast,
          region.invert
        );
        lumaBuf[i] = s.luma * 255;
        sheenBuf[i] = s.sheen;
        rgbBuf[i * 3] = s.r;
        rgbBuf[i * 3 + 1] = s.g;
        rgbBuf[i * 3 + 2] = s.b;
      }
    }

    for (let rIdx = 0; rIdx < rows; rIdx++) {
      for (let cIdx = 0; cIdx < cols; cIdx++) {
        const i = rIdx * cols + cIdx;
        const oldVal = lumaBuf[i];
        const newVal = oldVal >= 124 ? 255 : 0;
        const err = (oldVal - newVal) / 8;
        lumaBuf[i] = newVal;

        if (cIdx + 1 < cols) lumaBuf[i + 1] += err;
        if (cIdx + 2 < cols) lumaBuf[i + 2] += err;
        if (rIdx + 1 < rows) {
          if (cIdx > 0) lumaBuf[i + cols - 1] += err;
          lumaBuf[i + cols] += err;
          if (cIdx + 1 < cols) lumaBuf[i + cols + 1] += err;
        }
        if (rIdx + 2 < rows) {
          lumaBuf[i + cols * 2] += err;
        }

        if (newVal === 255) {
          const tf = transformCell(rx + cIdx * subSize, ry + rIdx * subSize);
          if (tf.skip) continue;
          ctx.fillStyle = getPrimaryColor(
            rgbBuf[i * 3],
            rgbBuf[i * 3 + 1],
            rgbBuf[i * 3 + 2],
            1,
            sheenBuf[i] + tf.boost
          );
          ctx.fillRect(tf.x, tf.y, subSize - 0.5, subSize - 0.5);
        }
      }
    }
  } else if (style === 'dither-bluenoise') {
    // R2 Low-Discrepancy Blue-Noise Threshold Dither
    const subSize = Math.max(2, Math.round(baseCellPx / 3));
    for (let cy = ry; cy < ry + rh; cy += subSize) {
      for (let cx = rx; cx < rx + rw; cx += subSize) {
        const { r, g, b, luma, sheen } = sampleCell(
          cx + subSize * 0.5,
          cy + subSize * 0.5,
          subSize,
          region.contrast,
          region.invert
        );
        const rawHash = (cx * 0.754877666 + cy * 0.56984029) % 1;
        const threshold = rawHash < 0 ? rawHash + 1 : rawHash;
        if (luma > threshold) {
          const tf = transformCell(cx, cy);
          if (tf.skip) continue;
          ctx.fillStyle = getPrimaryColor(r, g, b, luma, sheen + tf.boost);
          ctx.fillRect(tf.x, tf.y, subSize, subSize);
        }
      }
    }
  } else if (style === 'dither-noise') {
    // Film Stipple Noise Dither
    const subSize = Math.max(2, Math.round(baseCellPx / 3));
    for (let cy = ry; cy < ry + rh; cy += subSize) {
      for (let cx = rx; cx < rx + rw; cx += subSize) {
        const { r, g, b, luma, sheen } = sampleCell(
          cx + subSize * 0.5,
          cy + subSize * 0.5,
          subSize,
          region.contrast,
          region.invert
        );
        const h = Math.sin(cx * 12.9898 + cy * 78.233) * 43758.5453;
        const threshold = h - Math.floor(h);
        if (luma > threshold) {
          const tf = transformCell(cx, cy);
          if (tf.skip) continue;
          ctx.fillStyle = getPrimaryColor(r, g, b, luma, sheen + tf.boost);
          ctx.fillRect(tf.x, tf.y, subSize, subSize);
        }
      }
    }
  } else if (style === 'dither-lines') {
    // Linear Scan Pulse-Width Modulation Dither
    const rowStep = Math.max(3, Math.round(baseCellPx * 0.55));
    const colStep = Math.max(2, Math.round(baseCellPx * 0.35));
    for (let cy = ry; cy < ry + rh; cy += rowStep) {
      for (let cx = rx; cx < rx + rw; cx += colStep) {
        const { r, g, b, luma, sheen } = sampleCell(
          cx + colStep * 0.5,
          cy + rowStep * 0.5,
          colStep,
          region.contrast,
          region.invert
        );
        if (luma <= 0.06) continue;
        const tf = transformCell(cx, cy + rowStep * 0.5);
        if (tf.skip) continue;
        const barH = Math.max(1, rowStep * 0.88 * Math.pow(luma, 0.9));
        ctx.fillStyle = getPrimaryColor(r, g, b, luma, sheen + tf.boost);
        ctx.fillRect(tf.x, tf.y - barH * 0.5, colStep + 0.4, barH);
      }
    }
  } else if (style === 'dither-radial') {
    // Concentric Ring Threshold Dither
    const subSize = Math.max(2, Math.round(baseCellPx / 2.8));
    const regCenterX = rx + rw * 0.5;
    const regCenterY = ry + rh * 0.5;
    const ringPitch = Math.max(6, baseCellPx * 0.95);
    for (let cy = ry; cy < ry + rh; cy += subSize) {
      for (let cx = rx; cx < rx + rw; cx += subSize) {
        const { r, g, b, luma, sheen } = sampleCell(
          cx + subSize * 0.5,
          cy + subSize * 0.5,
          subSize,
          region.contrast,
          region.invert
        );
        const dist = Math.hypot(
          cx + subSize * 0.5 - regCenterX,
          cy + subSize * 0.5 - regCenterY
        );
        const ringWave = 0.5 + 0.5 * Math.sin((dist / ringPitch) * Math.PI * 2);
        const threshold = 0.08 + ringWave * 0.84;
        if (luma > threshold) {
          const tf = transformCell(cx, cy);
          if (tf.skip) continue;
          ctx.fillStyle = getPrimaryColor(r, g, b, luma, sheen + tf.boost);
          ctx.fillRect(tf.x, tf.y, subSize, subSize);
        }
      }
    }
  } else if (style === 'halftone') {
    const maxScale = 1 - tileGap * 0.6;
    for (let cy = ry; cy < ry + rh; cy += baseCellPx) {
      for (let cx = rx; cx < rx + rw; cx += baseCellPx) {
        const { r, g, b, luma, sheen } = sampleCell(
          cx + baseCellPx * 0.5,
          cy + baseCellPx * 0.5,
          stepSample,
          region.contrast,
          region.invert
        );
        if (luma <= 0.05) continue;
        const tf = transformCell(cx + baseCellPx * 0.5, cy + baseCellPx * 0.5);
        if (tf.skip) continue;
        const radius = baseCellPx * 0.5 * maxScale * Math.sqrt(luma);
        if (
          (region.color === 'risograph' || region.color === 'custom') &&
          secondaryHex
        ) {
          ctx.fillStyle = secondaryHex;
          ctx.globalAlpha = 0.55;
          ctx.beginPath();
          ctx.arc(
            tf.x + 2 * scale,
            tf.y + 1.5 * scale,
            radius * 0.9,
            0,
            Math.PI * 2
          );
          ctx.fill();
          ctx.globalAlpha = 1;
        }
        ctx.fillStyle = getPrimaryColor(r, g, b, luma, sheen + tf.boost);
        ctx.beginPath();
        ctx.arc(tf.x, tf.y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (style === 'dots') {
    // Orthogonal Precision Dots
    const maxR = baseCellPx * (1 - tileGap) * 0.5;
    for (let cy = ry; cy < ry + rh; cy += baseCellPx) {
      for (let cx = rx; cx < rx + rw; cx += baseCellPx) {
        const { r, g, b, luma, sheen } = sampleCell(
          cx + baseCellPx * 0.5,
          cy + baseCellPx * 0.5,
          stepSample,
          region.contrast,
          region.invert
        );
        if (luma <= 0.05) continue;
        const tf = transformCell(cx + baseCellPx * 0.5, cy + baseCellPx * 0.5);
        if (tf.skip) continue;
        const radius = Math.max(1, maxR * (0.3 + luma * 0.7));
        ctx.fillStyle = getPrimaryColor(r, g, b, luma, sheen + tf.boost);
        ctx.globalAlpha = Math.min(1, 0.3 + luma * 0.7 + tf.boost);
        ctx.beginPath();
        ctx.arc(tf.x, tf.y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  } else if (style === 'cmyk') {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const offset = baseCellPx * 0.16;
    const scaleDot = 1 - tileGap * 0.5;
    for (let cy = ry; cy < ry + rh; cy += baseCellPx) {
      for (let cx = rx; cx < rx + rw; cx += baseCellPx) {
        const { r, g, b, luma, sheen } = sampleCell(
          cx + baseCellPx * 0.5,
          cy + baseCellPx * 0.5,
          stepSample,
          region.contrast,
          region.invert
        );
        if (luma <= 0.04) continue;
        const tf = transformCell(cx + baseCellPx * 0.5, cy + baseCellPx * 0.5);
        if (tf.skip) continue;

        const cWeight = Math.min(
          1,
          ((g * 0.55 + b * 0.45) / 255) * (0.35 + luma * 0.75)
        );
        const mWeight = Math.min(
          1,
          ((r * 0.6 + b * 0.4) / 255) * (0.35 + luma * 0.75)
        );
        const yWeight = Math.min(
          1,
          ((r * 0.5 + g * 0.5) / 255) * (0.35 + luma * 0.75)
        );
        const kWeight = Math.max(0, (luma - 0.32) * 1.15 + sheen * 0.4);

        if (cWeight > 0.05) {
          ctx.fillStyle = '#00E5FF';
          ctx.globalAlpha = 0.78;
          ctx.beginPath();
          ctx.arc(
            tf.x - offset,
            tf.y - offset * 0.55,
            baseCellPx * 0.36 * scaleDot * Math.sqrt(cWeight),
            0,
            Math.PI * 2
          );
          ctx.fill();
        }
        if (mWeight > 0.05) {
          ctx.fillStyle = '#FF2A85';
          ctx.globalAlpha = 0.78;
          ctx.beginPath();
          ctx.arc(
            tf.x + offset,
            tf.y - offset * 0.45,
            baseCellPx * 0.36 * scaleDot * Math.sqrt(mWeight),
            0,
            Math.PI * 2
          );
          ctx.fill();
        }
        if (yWeight > 0.05) {
          ctx.fillStyle = '#FFE600';
          ctx.globalAlpha = 0.74;
          ctx.beginPath();
          ctx.arc(
            tf.x,
            tf.y + offset * 0.85,
            baseCellPx * 0.34 * scaleDot * Math.sqrt(yWeight),
            0,
            Math.PI * 2
          );
          ctx.fill();
        }
        if (kWeight > 0.08) {
          ctx.fillStyle = sheen > 0.4 ? '#FFFFFF' : '#F4F4EC';
          ctx.globalAlpha = Math.min(0.9, kWeight * 0.75);
          ctx.beginPath();
          ctx.arc(
            tf.x,
            tf.y,
            baseCellPx * 0.24 * scaleDot * Math.sqrt(Math.min(1, kWeight)),
            0,
            Math.PI * 2
          );
          ctx.fill();
        }
      }
    }
    ctx.restore();
  } else if (style === 'led') {
    const gap = Math.max(1, baseCellPx * tileGap);
    const maxR = Math.max(1, (baseCellPx - gap) * 0.5);
    for (let cy = ry; cy < ry + rh; cy += baseCellPx) {
      for (let cx = rx; cx < rx + rw; cx += baseCellPx) {
        const tf = transformCell(cx + baseCellPx * 0.5, cy + baseCellPx * 0.5);
        if (tf.skip) continue;
        // Dark recessed socket
        ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.beginPath();
        ctx.arc(tf.x, tf.y, maxR, 0, Math.PI * 2);
        ctx.fill();

        const { r, g, b, luma, sheen } = sampleCell(
          cx + baseCellPx * 0.5,
          cy + baseCellPx * 0.5,
          stepSample,
          region.contrast,
          region.invert
        );
        if (luma <= 0.06) continue;
        ctx.fillStyle = getPrimaryColor(r, g, b, luma, sheen + tf.boost);
        ctx.globalAlpha = Math.min(1, 0.25 + luma * 0.75 + tf.boost);
        ctx.beginPath();
        ctx.arc(tf.x, tf.y, maxR * (0.45 + luma * 0.55), 0, Math.PI * 2);
        ctx.fill();

        if (luma > 0.65 || sheen > 0.4) {
          ctx.fillStyle = '#FFFFFF';
          ctx.globalAlpha = Math.min(
            1,
            Math.max((luma - 0.65) * 1.4, sheen * 0.9)
          );
          ctx.beginPath();
          ctx.arc(tf.x, tf.y, maxR * 0.32, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    }
  } else if (style === 'mosaic') {
    const gap = Math.max(1, baseCellPx * tileGap);
    const tileSize = Math.max(2, baseCellPx - gap);
    const cornerR = Math.max(0.5, tileSize * 0.5 * tileRoundness);
    for (let cy = ry; cy < ry + rh; cy += baseCellPx) {
      for (let cx = rx; cx < rx + rw; cx += baseCellPx) {
        const { r, g, b, luma, sheen } = sampleCell(
          cx + baseCellPx * 0.5,
          cy + baseCellPx * 0.5,
          stepSample,
          region.contrast,
          region.invert
        );
        if (luma <= 0.04) continue;
        const tf = transformCell(cx + gap * 0.5, cy + gap * 0.5);
        if (tf.skip) continue;

        ctx.fillStyle = getPrimaryColor(r, g, b, luma, sheen + tf.boost);
        ctx.globalAlpha = Math.min(1, 0.28 + luma * 0.72 + tf.boost);
        ctx.beginPath();
        ctx.roundRect(tf.x, tf.y, tileSize, tileSize, cornerR);
        ctx.fill();

        if (tileSize >= 5) {
          ctx.fillStyle = `rgba(255, 255, 255, ${0.18 + luma * 0.28 + sheen * 0.35})`;
          ctx.fillRect(
            tf.x + tileSize * 0.15,
            tf.y + tileSize * 0.14,
            tileSize * 0.35,
            Math.max(1, tileSize * 0.1)
          );
        }
        ctx.globalAlpha = 1;
      }
    }
  } else if (style === 'hex') {
    // Staggered Honeycomb Hexagon Grid
    const rowStep = Math.max(4, baseCellPx * 0.866);
    const colStep = baseCellPx;
    const maxHexR = baseCellPx * (1 - tileGap * 0.75) * 0.56;
    let rowIdx = 0;
    for (let cy = ry; cy < ry + rh + rowStep; cy += rowStep, rowIdx++) {
      const rowOffset = (rowIdx & 1) === 1 ? colStep * 0.5 : 0;
      for (let cx = rx - colStep * 0.5; cx < rx + rw + colStep; cx += colStep) {
        const sampleX = cx + rowOffset + colStep * 0.5;
        const sampleY = cy + rowStep * 0.5;
        const { r, g, b, luma, sheen } = sampleCell(
          sampleX,
          sampleY,
          stepSample,
          region.contrast,
          region.invert
        );
        if (luma <= 0.04) continue;
        const tf = transformCell(sampleX, sampleY);
        if (tf.skip) continue;

        const hexR = Math.max(1.5, maxHexR * (0.3 + luma * 0.7));
        ctx.fillStyle = getPrimaryColor(r, g, b, luma, sheen + tf.boost);
        ctx.globalAlpha = Math.min(1, 0.32 + luma * 0.68 + tf.boost);
        ctx.beginPath();
        for (let v = 0; v < 6; v++) {
          const ang = (Math.PI / 3) * v - Math.PI / 6;
          const vx = tf.x + Math.cos(ang) * hexR;
          const vy = tf.y + Math.sin(ang) * hexR;
          if (v === 0) ctx.moveTo(vx, vy);
          else ctx.lineTo(vx, vy);
        }
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  } else if (style === 'lego') {
    // Studded Bricks: square brick base + top-left highlight + raised circular cylindrical stud
    const gap = Math.max(1, baseCellPx * tileGap * 0.85);
    const tileSize = Math.max(3, baseCellPx - gap);
    const cornerR = Math.max(0.5, tileSize * 0.35 * tileRoundness);
    for (let cy = ry; cy < ry + rh; cy += baseCellPx) {
      for (let cx = rx; cx < rx + rw; cx += baseCellPx) {
        const { r, g, b, luma, sheen } = sampleCell(
          cx + baseCellPx * 0.5,
          cy + baseCellPx * 0.5,
          stepSample,
          region.contrast,
          region.invert
        );
        if (luma <= 0.04) continue;
        const tf = transformCell(cx + gap * 0.5, cy + gap * 0.5);
        if (tf.skip) continue;

        const primaryCol = getPrimaryColor(r, g, b, luma, sheen + tf.boost);
        ctx.fillStyle = primaryCol;
        ctx.globalAlpha = Math.min(1, 0.35 + luma * 0.65 + tf.boost);
        ctx.beginPath();
        ctx.roundRect(tf.x, tf.y, tileSize, tileSize, cornerR);
        ctx.fill();

        // Top-left brick bevel highlight
        ctx.fillStyle = `rgba(255, 255, 255, ${0.16 + luma * 0.22})`;
        ctx.fillRect(
          tf.x + 1,
          tf.y + 1,
          tileSize - 2,
          Math.max(1, tileSize * 0.12)
        );

        // Raised cylindrical center stud
        const studX = tf.x + tileSize * 0.5;
        const studY = tf.y + tileSize * 0.5;
        const studR = tileSize * 0.29;

        // Stud drop shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
        ctx.beginPath();
        ctx.arc(
          studX + scale * 0.8,
          studY + scale * 1.1,
          studR,
          0,
          Math.PI * 2
        );
        ctx.fill();

        // Stud body
        ctx.fillStyle = primaryCol;
        ctx.beginPath();
        ctx.arc(studX, studY, studR, 0, Math.PI * 2);
        ctx.fill();

        // Stud specular rim arc
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.28 + luma * 0.35 + sheen * 0.35})`;
        ctx.lineWidth = Math.max(1, scale * 0.9);
        ctx.beginPath();
        ctx.arc(studX, studY, studR * 0.85, Math.PI * 0.85, Math.PI * 1.85);
        ctx.stroke();

        ctx.globalAlpha = 1;
      }
    }
  } else if (style === 'voxel') {
    // Isometric 3D Cube with 3 shaded faces (top 1.15x, left 0.85x, right 0.55x) extruded by luma
    const rad = baseCellPx * (1 - tileGap * 0.55) * 0.52;
    const dxIso = rad * 0.866;
    const dyIso = rad * 0.5;
    for (let cy = ry; cy < ry + rh; cy += baseCellPx) {
      for (let cx = rx; cx < rx + rw; cx += baseCellPx) {
        const { r, g, b, luma, sheen } = sampleCell(
          cx + baseCellPx * 0.5,
          cy + baseCellPx * 0.5,
          stepSample,
          region.contrast,
          region.invert
        );
        if (luma <= 0.05) continue;
        const tf = transformCell(cx + baseCellPx * 0.5, cy + baseCellPx * 0.5);
        if (tf.skip) continue;

        const [pr, pg, pb] = getPrimaryRgbTuple(r, g, b, luma);
        const extrude = Math.max(2, luma * baseCellPx * 0.85);
        const topY = tf.y - extrude * 0.45;
        const botY = tf.y + extrude * 0.55;

        // Top face (1.15x)
        const tr = Math.min(255, Math.round(pr * 1.15 + sheen * 60));
        const tg = Math.min(255, Math.round(pg * 1.15 + sheen * 60));
        const tb = Math.min(255, Math.round(pb * 1.15 + sheen * 60));
        ctx.fillStyle = `rgb(${tr}, ${tg}, ${tb})`;
        ctx.beginPath();
        ctx.moveTo(tf.x, topY - dyIso);
        ctx.lineTo(tf.x + dxIso, topY);
        ctx.lineTo(tf.x, topY + dyIso);
        ctx.lineTo(tf.x - dxIso, topY);
        ctx.closePath();
        ctx.fill();

        // Left face (0.85x)
        const lr = Math.min(255, Math.round(pr * 0.85));
        const lg = Math.min(255, Math.round(pg * 0.85));
        const lb = Math.min(255, Math.round(pb * 0.85));
        ctx.fillStyle = `rgb(${lr}, ${lg}, ${lb})`;
        ctx.beginPath();
        ctx.moveTo(tf.x - dxIso, topY);
        ctx.lineTo(tf.x, topY + dyIso);
        ctx.lineTo(tf.x, botY + dyIso);
        ctx.lineTo(tf.x - dxIso, botY);
        ctx.closePath();
        ctx.fill();

        // Right face (0.55x)
        const rr = Math.min(255, Math.round(pr * 0.55));
        const rg = Math.min(255, Math.round(pg * 0.55));
        const rb = Math.min(255, Math.round(pb * 0.55));
        ctx.fillStyle = `rgb(${rr}, ${rg}, ${rb})`;
        ctx.beginPath();
        ctx.moveTo(tf.x, topY + dyIso);
        ctx.lineTo(tf.x + dxIso, topY);
        ctx.lineTo(tf.x + dxIso, botY);
        ctx.lineTo(tf.x, botY + dyIso);
        ctx.closePath();
        ctx.fill();
      }
    }
  } else if (style === 'engraving') {
    const lineStep = Math.max(4, Math.round(baseCellPx * 0.65));
    const segStep = Math.max(4, Math.round(baseCellPx * 0.5));
    const roughAmp = 0.4 + printRoughness * 1.4;
    const angleSlope = Math.sin(printAngleRad) * 0.04;
    ctx.lineCap = 'round';
    for (let cy = ry + lineStep * 0.5; cy < ry + rh; cy += lineStep) {
      for (let cx = rx; cx < rx + rw; cx += segStep) {
        const { r, g, b, luma, edgeMag, sheen } = sampleCell(
          cx + segStep * 0.5,
          cy,
          segStep,
          region.contrast,
          region.invert
        );
        if (luma <= 0.06) continue;
        const tf = transformCell(cx, cy);
        if (tf.skip) continue;
        const wave =
          Math.sin(cx * 0.06 + cy * (0.03 + angleSlope)) *
          lineStep *
          0.22 *
          roughAmp *
          (1 - luma * 0.45);
        const nextWave =
          Math.sin((cx + segStep) * 0.06 + cy * (0.03 + angleSlope)) *
          lineStep *
          0.22 *
          roughAmp *
          (1 - luma * 0.45);
        const strokeW =
          Math.max(
            0.65,
            lineStep * 0.76 * Math.pow(luma, 0.9) + edgeMag * 1.2
          ) * printWeight;

        if (
          (region.color === 'risograph' || region.color === 'custom') &&
          secondaryHex &&
          luma < 0.7
        ) {
          const regOff = printRegistration * 6 * scale;
          ctx.strokeStyle = secondaryHex;
          ctx.lineWidth = strokeW * 0.85;
          ctx.globalAlpha = 0.55;
          ctx.beginPath();
          ctx.moveTo(tf.x + regOff, tf.y + wave + regOff * 0.65);
          ctx.lineTo(
            tf.x + segStep + regOff,
            tf.y + nextWave + regOff * 0.65
          );
          ctx.stroke();
          ctx.globalAlpha = 1;
        }

        ctx.strokeStyle = getPrimaryColor(r, g, b, luma, sheen + tf.boost);
        ctx.lineWidth = strokeW;
        ctx.beginPath();
        ctx.moveTo(tf.x, tf.y + wave);
        ctx.lineTo(tf.x + segStep, tf.y + nextWave);
        ctx.stroke();
      }
    }
  } else if (style === 'crosshatch') {
    ctx.lineCap = 'square';
    const halfLen = baseCellPx * 0.42;
    const cos1 = Math.cos(printAngleRad);
    const sin1 = Math.sin(printAngleRad);
    const cos2 = Math.cos(printAngleRad + Math.PI * 0.5);
    const sin2 = Math.sin(printAngleRad + Math.PI * 0.5);
    const cos3 = Math.cos(printAngleRad + Math.PI * 0.25);
    const sin3 = Math.sin(printAngleRad + Math.PI * 0.25);

    for (let cy = ry; cy < ry + rh; cy += baseCellPx) {
      for (let cx = rx; cx < rx + rw; cx += baseCellPx) {
        const sampleX = cx + baseCellPx * 0.5;
        const sampleY = cy + baseCellPx * 0.5;
        const { r, g, b, luma, sheen } = sampleCell(
          sampleX,
          sampleY,
          stepSample,
          region.contrast,
          region.invert
        );
        if (luma <= 0.08) continue;
        const tf = transformCell(sampleX, sampleY);
        if (tf.skip) continue;

        const jitter =
          (Math.sin(cx * 12.9898 + cy * 78.233) % 1) *
          printRoughness *
          baseCellPx *
          0.18;
        ctx.strokeStyle = getPrimaryColor(r, g, b, luma, sheen + tf.boost);
        ctx.lineWidth =
          Math.max(0.8, baseCellPx * 0.11 * (0.6 + luma * 0.8)) * printWeight;

        // Pass 1
        ctx.beginPath();
        ctx.moveTo(tf.x - cos1 * halfLen + jitter, tf.y - sin1 * halfLen);
        ctx.lineTo(tf.x + cos1 * halfLen, tf.y + sin1 * halfLen + jitter);
        ctx.stroke();

        // Pass 2
        if (luma > 0.38) {
          ctx.beginPath();
          ctx.moveTo(tf.x - cos2 * halfLen, tf.y - sin2 * halfLen + jitter);
          ctx.lineTo(tf.x + cos2 * halfLen + jitter, tf.y + sin2 * halfLen);
          ctx.stroke();
        }

        // Pass 3
        if (luma > 0.68) {
          ctx.beginPath();
          ctx.moveTo(tf.x - cos3 * halfLen, tf.y - sin3 * halfLen);
          ctx.lineTo(tf.x + cos3 * halfLen, tf.y + sin3 * halfLen);
          ctx.stroke();
        }
      }
    }
  } else if (style === 'stipple') {
    const spread = 0.5 + printRoughness * 0.4;
    const regOff = printRegistration * 5 * scale;
    for (let cy = ry; cy < ry + rh; cy += baseCellPx) {
      for (let cx = rx; cx < rx + rw; cx += baseCellPx) {
        const { r, g, b, luma, sheen } = sampleCell(
          cx + baseCellPx * 0.5,
          cy + baseCellPx * 0.5,
          stepSample,
          region.contrast,
          region.invert
        );
        if (luma <= 0.05) continue;
        const tf = transformCell(cx, cy);
        if (tf.skip) continue;
        const dotCount = Math.max(1, Math.min(7, Math.ceil(luma * 7)));
        const dotR =
          Math.max(0.75, baseCellPx * 0.095 * (0.65 + luma * 0.65)) *
          printWeight;

        ctx.fillStyle = getPrimaryColor(r, g, b, luma, sheen + tf.boost);
        for (let i = 0; i < dotCount; i++) {
          const h1 =
            Math.sin(cx * 12.9898 + cy * 78.233 + i * 37.719) * 43758.5453;
          const h2 =
            Math.sin(cx * 93.989 + cy * 47.345 + i * 61.13) * 28461.317;
          const fx = h1 - Math.floor(h1);
          const fy = h2 - Math.floor(h2);
          const px = tf.x + (0.5 + (fx - 0.5) * spread) * baseCellPx;
          const py = tf.y + (0.5 + (fy - 0.5) * spread) * baseCellPx;

          if (
            (region.color === 'risograph' || region.color === 'custom') &&
            secondaryHex &&
            i % 2 === 1
          ) {
            ctx.save();
            ctx.fillStyle = secondaryHex;
            ctx.globalAlpha = 0.65;
            ctx.beginPath();
            ctx.arc(
              px + regOff,
              py + regOff * 0.7,
              dotR * 0.9,
              0,
              Math.PI * 2
            );
            ctx.fill();
            ctx.restore();
          }

          ctx.beginPath();
          ctx.arc(px, py, dotR, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  } else if (style === 'woodblock') {
    const bandStep = Math.max(5, Math.round(baseCellPx * 0.72));
    const segStep = Math.max(5, Math.round(baseCellPx * 0.65));
    const roughScale = 0.4 + printRoughness * 1.4;
    ctx.lineCap = 'butt';
    for (let cy = ry + bandStep * 0.5; cy < ry + rh; cy += bandStep) {
      for (let cx = rx; cx < rx + rw; cx += segStep) {
        const { r, g, b, luma, edgeMag, sheen } = sampleCell(
          cx + segStep * 0.5,
          cy,
          segStep,
          region.contrast,
          region.invert
        );
        if (luma <= 0.07) continue;
        const tf = transformCell(cx, cy);
        if (tf.skip) continue;
        const gouge =
          Math.cos(cx * 0.045 - cy * 0.05) *
          bandStep *
          0.26 *
          roughScale *
          (0.25 + edgeMag * 0.85);
        const nextGouge =
          Math.cos((cx + segStep) * 0.045 - cy * 0.05) *
          bandStep *
          0.26 *
          roughScale *
          (0.25 + edgeMag * 0.85);
        const relief = Math.pow(luma, 0.75) * 0.86 + edgeMag * 0.34;
        const thickness =
          Math.max(1, Math.min(bandStep * 0.95, bandStep * relief)) *
          printWeight;

        if (
          (region.color === 'risograph' || region.color === 'custom') &&
          secondaryHex &&
          luma < 0.72
        ) {
          const regOff = printRegistration * 6 * scale;
          ctx.strokeStyle = secondaryHex;
          ctx.lineWidth = thickness * 0.82;
          ctx.globalAlpha = 0.58;
          ctx.beginPath();
          ctx.moveTo(tf.x + regOff, tf.y + gouge + regOff * 0.65);
          ctx.lineTo(
            tf.x + segStep + regOff,
            tf.y + nextGouge + regOff * 0.65
          );
          ctx.stroke();
          ctx.globalAlpha = 1;
        }

        ctx.strokeStyle = getPrimaryColor(r, g, b, luma, sheen + tf.boost);
        ctx.lineWidth = thickness;
        ctx.beginPath();
        ctx.moveTo(tf.x, tf.y + gouge);
        ctx.lineTo(tf.x + segStep + 0.6, tf.y + nextGouge);
        ctx.stroke();
      }
    }
  } else if (style === 'risograph-print') {
    // 2-Drum Risograph Ink Separation with Registration Offset
    const regOffset = (0.1 + printRegistration * 0.9) * baseCellPx * 0.75;
    const cosReg = Math.cos(printAngleRad);
    const sinReg = Math.sin(printAngleRad);
    const regDx = cosReg * regOffset;
    const regDy = sinReg * regOffset;
    const drum2Color = secondaryHex || '#FF3B7F';

    for (let cy = ry; cy < ry + rh; cy += baseCellPx) {
      for (let cx = rx; cx < rx + rw; cx += baseCellPx) {
        const sampleX = cx + baseCellPx * 0.5;
        const sampleY = cy + baseCellPx * 0.5;
        const { r, g, b, luma, sheen } = sampleCell(
          sampleX,
          sampleY,
          stepSample,
          region.contrast,
          region.invert
        );
        if (luma <= 0.04) continue;
        const tf = transformCell(sampleX, sampleY);
        if (tf.skip) continue;

        const warmth = Math.max(0, Math.min(1, (r - b * 0.7) / 255 + 0.35));
        const coolWeight = Math.max(0, (1 - warmth) * 0.6 + luma * 0.6);
        const warmWeight = Math.max(0, warmth * 0.7 + (1 - luma) * 0.45);
        const h = Math.sin(cx * 12.9898 + cy * 78.233) * 43758.5453;
        const grain = 1 - (h - Math.floor(h)) * printRoughness * 0.45;

        // Drum 2 (Secondary Ink - Warmth / Midtones offset by printRegistration)
        if (warmWeight > 0.14) {
          const r2 =
            baseCellPx *
            0.42 *
            Math.sqrt(Math.min(1, warmWeight)) *
            printWeight *
            grain;
          ctx.fillStyle = drum2Color;
          ctx.globalAlpha = Math.min(0.82, 0.35 + warmWeight * 0.48);
          ctx.beginPath();
          ctx.arc(tf.x + regDx, tf.y + regDy, Math.max(0.8, r2), 0, Math.PI * 2);
          ctx.fill();
        }

        // Drum 1 (Primary Ink - Luminance / Cool screen)
        if (coolWeight > 0.1) {
          const r1 =
            baseCellPx *
            0.44 *
            Math.sqrt(Math.min(1, luma)) *
            printWeight *
            grain;
          ctx.fillStyle = getPrimaryColor(r, g, b, luma, sheen + tf.boost);
          ctx.globalAlpha = Math.min(0.9, 0.35 + luma * 0.58);
          ctx.beginPath();
          ctx.arc(tf.x, tf.y, Math.max(0.8, r1), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    }
  } else if (style === 'pointillism') {
    // 4 Oriented Elliptical Pigment Brush Strokes per Cell
    for (let cy = ry; cy < ry + rh; cy += baseCellPx) {
      for (let cx = rx; cx < rx + rw; cx += baseCellPx) {
        const sampleX = cx + baseCellPx * 0.5;
        const sampleY = cy + baseCellPx * 0.5;
        const { r, g, b, luma, gradX, gradY, sheen } = sampleCell(
          sampleX,
          sampleY,
          stepSample,
          region.contrast,
          region.invert
        );
        if (luma <= 0.05) continue;
        const tf = transformCell(cx, cy);
        if (tf.skip) continue;

        const baseAngle =
          Math.hypot(gradX, gradY) > 0.04
            ? Math.atan2(gradY, gradX) + Math.PI * 0.5
            : printAngleRad;
        const rxStroke =
          Math.max(1.5, baseCellPx * 0.36 * (0.5 + luma * 0.6)) * printWeight;
        const ryStroke = Math.max(0.9, rxStroke * 0.44);

        for (let i = 0; i < 4; i++) {
          const h1 =
            Math.sin(cx * 12.9898 + cy * 78.233 + i * 43.17) * 43758.5453;
          const h2 =
            Math.sin(cx * 93.989 + cy * 47.345 + i * 19.73) * 28461.317;
          const fx = h1 - Math.floor(h1);
          const fy = h2 - Math.floor(h2);
          const bx = tf.x + (0.2 + fx * 0.6) * baseCellPx;
          const by = tf.y + (0.2 + fy * 0.6) * baseCellPx;
          const strokeAngle =
            baseAngle + (fx - 0.5) * printRoughness * Math.PI * 0.65;

          if (
            (region.color === 'risograph' || region.color === 'custom') &&
            secondaryHex &&
            i === 3 &&
            luma < 0.72
          ) {
            ctx.fillStyle = secondaryHex;
            ctx.globalAlpha = 0.68;
          } else {
            ctx.fillStyle = getPrimaryColor(r, g, b, luma, sheen + tf.boost);
            ctx.globalAlpha = Math.min(1, 0.45 + luma * 0.55);
          }

          ctx.beginPath();
          ctx.ellipse(bx, by, rxStroke, ryStroke, strokeAngle, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    }
  } else {
    // 9 Character / Glyph Styles: density, geometric, braille, telemetry, ascii, lines, cross, diagonal, diamond
    ctx.font = `600 ${Math.round(baseCellPx * 0.96)}px "${fontFamily}", "JetBrains Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (globalGlow > 0) {
      ctx.shadowColor = palette.glowRgba;
      ctx.shadowBlur = (globalGlow / 100) * 10 * scale;
    }

    let rowIdx = 0;
    for (let cy = ry; cy < ry + rh; cy += baseCellPx, rowIdx++) {
      let colIdx = 0;
      for (let cx = rx; cx < rx + rw; cx += baseCellPx, colIdx++) {
        const sampleX = cx + baseCellPx * 0.5;
        const sampleY = cy + baseCellPx * 0.5;

        let cellPx = baseCellPx;
        if (cursorActive && cursorEffect === 'loupe' && cursor) {
          const distPx = Math.hypot(sampleX - cursorPxX, sampleY - cursorPxY);
          if (distPx < hoverRadiusPx) {
            const fall = 1 - distPx / hoverRadiusPx;
            cellPx = Math.round(
              baseCellPx * (1 + fall * 0.45 * hoverStrength01)
            );
          }
        }

        const { r, g, b, luma, edgeMag, gradX, gradY, sheen } = sampleCell(
          sampleX,
          sampleY,
          stepSample,
          region.contrast,
          region.invert
        );

        let glyph = ' ';
        if (wordmark.length > 0) {
          if (luma <= 0.08) continue;
          glyph = wordmark[(colIdx + rowIdx * 3) % wordmark.length];
        } else if (
          style === 'geometric' &&
          edgeMag > 0.18 &&
          !region.customChars
        ) {
          if (Math.abs(gradY) > Math.abs(gradX)) {
            glyph = gradY > 0 ? '▄' : '▀';
          } else {
            glyph = gradX > 0 ? '▐' : '▌';
          }
        } else if (style === 'lines' && edgeMag > 0.18 && !region.customChars) {
          if (Math.abs(gradX) > Math.abs(gradY) * 1.8) {
            glyph = '│';
          } else if (Math.abs(gradY) > Math.abs(gradX) * 1.8) {
            glyph = '─';
          } else if (gradX * gradY > 0) {
            glyph = '╱';
          } else if (gradX * gradY < 0) {
            glyph = '╲';
          } else {
            glyph = '┼';
          }
        } else {
          const charIndex = Math.min(
            chars.length - 1,
            Math.max(0, Math.floor(luma * (chars.length - 0.01)))
          );
          glyph = chars[charIndex];
        }

        if (!glyph || glyph === ' ') continue;

        const tf = transformCell(sampleX, sampleY);
        if (tf.skip) continue;

        if (
          (region.color === 'risograph' || region.color === 'custom') &&
          secondaryHex
        ) {
          const regOff = printRegistration * 6 * scale;
          ctx.fillStyle = secondaryHex;
          ctx.globalAlpha = 0.65;
          ctx.fillText(glyph, tf.x + regOff, tf.y + regOff * 0.7);
          ctx.globalAlpha = 1;
        }

        ctx.fillStyle = getPrimaryColor(r, g, b, luma, sheen + tf.boost);
        ctx.globalAlpha =
          wordmark.length > 0
            ? Math.min(1, luma)
            : Math.min(1, 0.35 + luma * 0.65 + sheen * 0.3 + tf.boost);

        if (cellPx !== baseCellPx) {
          ctx.save();
          ctx.font = `700 ${Math.round(cellPx * 1.05)}px "${fontFamily}", "JetBrains Mono", monospace`;
          ctx.fillText(glyph, tf.x, tf.y);
          ctx.restore();
        } else {
          ctx.fillText(glyph, tf.x, tf.y);
        }

        if (sheen > 0.38) {
          ctx.save();
          ctx.fillStyle = sheen > 0.72 ? '#FFFFFF' : '#63F5FF';
          ctx.globalAlpha = (sheen - 0.38) * 1.15;
          ctx.fillText(glyph, tf.x - 0.6 * scale, tf.y - 0.6 * scale);
          ctx.restore();
        }
      }
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  // Step C: Internal Region Scanline Texture
  if (globalScanlines > 0) {
    const scanStep = Math.max(2, Math.round(3 * scale));
    ctx.fillStyle = `rgba(0, 0, 0, ${(globalScanlines / 100) * 0.42})`;
    for (let sy = ry; sy < ry + rh; sy += scanStep) {
      ctx.fillRect(rx, sy, rw, Math.max(1, Math.round(1 * scale)));
    }
  }

  ctx.restore();
}

/**
 * Pixel Sorting Pass: sorts continuous luminance intervals along columns or rows.
 */
function applyPixelSortPass(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  glitch: StudioState['glitch']
): void {
  if (glitch.pixelSortStrength <= 0) return;
  const interval = normalizePixelSortRange(glitch.pixelSortMin, glitch.pixelSortMax);
  const minLuma = interval.min * 2.55;
  const maxLuma = interval.max * 2.55;
  const maxSpan = Math.max(
    6,
    Math.round(
      (glitch.pixelSortDirection === 'columns' ? height : width) *
        (glitch.pixelSortStrength / 100) *
        0.38
    )
  );

  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  if (glitch.pixelSortDirection === 'columns') {
    for (let x = 0; x < width; x += 2) {
      let y = 0;
      while (y < height) {
        const idx = (y * width + x) * 4;
        const luma =
          0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
        if (luma >= minLuma && luma <= maxLuma) {
          const startY = y;
          let endY = y + 1;
          while (endY < height && endY - startY < maxSpan) {
            const eIdx = (endY * width + x) * 4;
            const eLuma =
              0.299 * data[eIdx] +
              0.587 * data[eIdx + 1] +
              0.114 * data[eIdx + 2];
            if (eLuma < minLuma || eLuma > maxLuma) break;
            endY++;
          }
          const spanLen = endY - startY;
          if (spanLen > 4) {
            const spanPixels: { r: number; g: number; b: number; l: number }[] =
              [];
            for (let sy = startY; sy < endY; sy++) {
              const sIdx = (sy * width + x) * 4;
              const r = data[sIdx];
              const g = data[sIdx + 1];
              const b = data[sIdx + 2];
              spanPixels.push({
                r,
                g,
                b,
                l: 0.299 * r + 0.587 * g + 0.114 * b,
              });
            }
            spanPixels.sort((a, b) => b.l - a.l);
            for (let i = 0; i < spanLen; i++) {
              const p = spanPixels[i];
              for (let dx = 0; dx < 2 && x + dx < width; dx++) {
                const dIdx = ((startY + i) * width + (x + dx)) * 4;
                data[dIdx] = p.r;
                data[dIdx + 1] = p.g;
                data[dIdx + 2] = p.b;
              }
            }
          }
          y = endY;
        } else {
          y++;
        }
      }
    }
  } else {
    for (let y = 0; y < height; y += 2) {
      let x = 0;
      while (x < width) {
        const idx = (y * width + x) * 4;
        const luma =
          0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
        if (luma >= minLuma && luma <= maxLuma) {
          const startX = x;
          let endX = x + 1;
          while (endX < width && endX - startX < maxSpan) {
            const eIdx = (y * width + endX) * 4;
            const eLuma =
              0.299 * data[eIdx] +
              0.587 * data[eIdx + 1] +
              0.114 * data[eIdx + 2];
            if (eLuma < minLuma || eLuma > maxLuma) break;
            endX++;
          }
          const spanLen = endX - startX;
          if (spanLen > 4) {
            const spanPixels: { r: number; g: number; b: number; l: number }[] =
              [];
            for (let sx = startX; sx < endX; sx++) {
              const sIdx = (y * width + sx) * 4;
              const r = data[sIdx];
              const g = data[sIdx + 1];
              const b = data[sIdx + 2];
              spanPixels.push({
                r,
                g,
                b,
                l: 0.299 * r + 0.587 * g + 0.114 * b,
              });
            }
            spanPixels.sort((a, b) => b.l - a.l);
            for (let i = 0; i < spanLen; i++) {
              const p = spanPixels[i];
              for (let dy = 0; dy < 2 && y + dy < height; dy++) {
                const dIdx = ((y + dy) * width + (startX + i)) * 4;
                data[dIdx] = p.r;
                data[dIdx + 1] = p.g;
                data[dIdx + 2] = p.b;
              }
            }
          }
          x = endX;
        } else {
          x++;
        }
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
}

/**
 * VHS Analog Tape & Tracking Error Pass
 */
function applyVhsAndTrackingPass(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  tracking: StudioState['tracking'],
  time: number,
  scale: number
): void {
  const work = getWorkCanvas(width, height);
  const wctx = work.getContext('2d')!;
  wctx.clearRect(0, 0, width, height);
  wctx.drawImage(ctx.canvas, 0, 0);

  const timeStep = Math.floor(time * 24);
  const rng = createPRNG(timeStep * 131 + 73);

  if (tracking.chromaBleed > 0) {
    const bleedShift = Math.round((tracking.chromaBleed / 100) * 9 * scale);
    if (bleedShift > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = (tracking.chromaBleed / 100) * 0.34;
      ctx.drawImage(work, bleedShift, 0);
      ctx.drawImage(work, -Math.ceil(bleedShift * 0.6), 0);
      ctx.restore();
    }
  }

  if (tracking.lineJitter > 0) {
    const stripCount = Math.round(10 + (tracking.lineJitter / 100) * 28);
    const maxJitterPx = (tracking.lineJitter / 100) * 8 * scale;
    for (let i = 0; i < stripCount; i++) {
      const sy = randomInt(rng, 0, height - 4);
      const sh = randomInt(rng, 2, Math.max(3, Math.round(8 * scale)));
      const shiftX = randomRange(rng, -maxJitterPx, maxJitterPx);
      ctx.drawImage(work, 0, sy, width, sh, shiftX, sy, width, sh);
    }
  }

  if (tracking.intensity > 0) {
    const strength = tracking.intensity / 100;
    const bandH = Math.max(12, Math.round((tracking.bandHeight / 100) * height));
    const effectivePos01 = tracking.autoRoll
      ? (tracking.position / 100 + time * 0.14) % 1
      : tracking.position / 100;
    const centerY = effectivePos01 * height;
    const startY = Math.max(0, Math.round(centerY - bandH * 0.5));
    const endY = Math.min(height, Math.round(centerY + bandH * 0.5));
    const stripH = Math.max(2, Math.round(3 * scale));

    for (let y = startY; y < endY; y += stripH) {
      const normDist = Math.abs(y - centerY) / (bandH * 0.5);
      const falloff = Math.max(0, 1 - normDist * normDist);
      const wave =
        Math.sin(y * 0.08 + time * 18) * 16 * strength * falloff * scale +
        (rng() - 0.5) * 24 * strength * falloff * scale;

      ctx.drawImage(work, 0, y, width, stripH, wave, y, width, stripH);

      if (rng() < 0.65 * falloff * strength) {
        ctx.fillStyle = `rgba(255, 255, 255, ${(0.08 + rng() * 0.25) * falloff * strength})`;
        const snowX = rng() * width * 0.25;
        const snowW = width * (0.3 + rng() * 0.7);
        ctx.fillRect(snowX, y, snowW, Math.max(1, Math.round(1.5 * scale)));
      }
    }
  }

  if (tracking.dropouts > 0) {
    const dropoutCount = Math.round((tracking.dropouts / 100) * 14);
    for (let i = 0; i < dropoutCount; i++) {
      if (rng() > 0.65) continue;
      const dy = randomInt(rng, 4, height - 4);
      const dx = randomRange(rng, 0, width * 0.75);
      const dw = randomRange(rng, 18 * scale, 140 * scale);
      const dh = Math.max(1, Math.round(randomRange(rng, 1, 2.5) * scale));
      ctx.fillStyle = `rgba(255, 255, 255, ${randomRange(rng, 0.45, 0.88)})`;
      ctx.fillRect(dx, dy, dw, dh);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
      ctx.fillRect(dx + dw, dy, dw * 0.35, dh);
    }
  }
}

/**
 * Glitch & Databend Pass: Row displacement slices, RGB Split, and Databent chunks.
 */
function applyGlitchAndDatabendPass(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  glitch: StudioState['glitch'],
  time: number,
  scale: number
): void {
  const work = getWorkCanvas(width, height);
  const wctx = work.getContext('2d')!;
  wctx.clearRect(0, 0, width, height);
  wctx.drawImage(ctx.canvas, 0, 0);

  const timeQuantized = Math.floor(time * 12);
  const rng = createPRNG(glitch.seed + timeQuantized * 97);

  const sliceCount = Math.round((glitch.sliceFrequency / 100) * 18);
  const maxShift = (glitch.maxDisplacement / 100) * 64 * scale;
  const rgbShift = (glitch.rgbSplit / 100) * 14 * scale;

  for (let i = 0; i < sliceCount; i++) {
    if (rng() > 0.72) continue;
    const sliceY = randomInt(rng, 0, height - 10);
    const sliceH = randomInt(
      rng,
      Math.round(4 * scale),
      Math.max(Math.round(8 * scale), Math.round(height * 0.08))
    );
    const shiftX = randomRange(rng, -maxShift, maxShift);

    ctx.drawImage(work, 0, sliceY, width, sliceH, shiftX, sliceY, width, sliceH);

    if (rgbShift > 1) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, sliceY, width, sliceH);
      ctx.clip();
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 0.42;
      ctx.drawImage(work, shiftX + rgbShift, 0);
      ctx.drawImage(work, shiftX - rgbShift, 0);
      ctx.restore();
    }
  }

  if (glitch.databendChunks > 0) {
    const chunkCount = Math.round((glitch.databendChunks / 100) * 16);
    for (let i = 0; i < chunkCount; i++) {
      const cw = randomInt(rng, Math.round(24 * scale), Math.round(140 * scale));
      const ch = randomInt(rng, Math.round(12 * scale), Math.round(48 * scale));
      const cx = randomInt(rng, 0, Math.max(1, width - cw));
      const cy = randomInt(rng, 0, Math.max(1, height - ch));
      const dx = randomRange(rng, -45 * scale, 45 * scale);
      const dy = randomRange(rng, -12 * scale, 12 * scale);

      ctx.drawImage(work, cx, cy, cw, ch, cx + dx, cy + dy, cw, ch);
      if (rng() > 0.55) {
        ctx.fillStyle =
          rng() > 0.5 ? 'rgba(0, 255, 102, 0.18)' : 'rgba(255, 59, 127, 0.18)';
        ctx.fillRect(cx + dx, cy + dy, cw, ch);
      }
    }
  }

  if (rgbShift > 2) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighten';
    ctx.globalAlpha = Math.min(0.32, (glitch.rgbSplit / 100) * 0.3);
    ctx.drawImage(work, rgbShift * 0.4, 0);
    ctx.drawImage(work, -rgbShift * 0.4, 0);
    ctx.restore();
  }
}

/**
 * Global CRT & Darkroom Optics: Whole Bloom, Prism Aberration, Radial Blur, Hologram Ghost, Scanlines, Aperture Grille, Barrel, Vignette, Grain & Dust.
 */
function applyGlobalCrtOptics(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  crt: StudioState['crt'],
  time: number,
  scale: number
): void {
  // Whole-composition halation / bloom
  if ((crt.wholeBloom ?? 0) > 0) {
    const bloom01 = (crt.wholeBloom ?? 0) / 100;
    const work = getWorkCanvas(width, height);
    const wctx = work.getContext('2d')!;
    wctx.clearRect(0, 0, width, height);
    wctx.filter = `blur(${Math.max(4, Math.round(18 * bloom01 * scale))}px) brightness(1.25)`;
    wctx.drawImage(ctx.canvas, 0, 0);
    wctx.filter = 'none';

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = Math.min(0.65, bloom01 * 0.52);
    ctx.drawImage(work, 0, 0);
    ctx.restore();
  }

  // Edge Optical Radial Blur
  if ((crt.radialBlur ?? 0) > 0) {
    const rBlur = (crt.radialBlur ?? 0) / 100;
    const work = getWorkCanvas(width, height);
    const wctx = work.getContext('2d')!;
    wctx.clearRect(0, 0, width, height);
    wctx.drawImage(ctx.canvas, 0, 0);

    const expW = width * (1 + rBlur * 0.025);
    const expH = height * (1 + rBlur * 0.025);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = Math.min(0.42, rBlur * 0.35);
    ctx.drawImage(
      work,
      -(expW - width) * 0.5,
      -(expH - height) * 0.5,
      expW,
      expH
    );
    ctx.restore();
  }

  // Prism Chromatic Aberration
  if ((crt.prismAberration ?? 0) > 0) {
    const prism = (crt.prismAberration ?? 0) / 100;
    const work = getWorkCanvas(width, height);
    const wctx = work.getContext('2d')!;
    wctx.clearRect(0, 0, width, height);
    wctx.drawImage(ctx.canvas, 0, 0);

    const shiftPx = Math.max(1, Math.round(prism * 10 * scale));
    const expandW = width * (1 + prism * 0.014);
    const expandH = height * (1 + prism * 0.014);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = Math.min(0.45, prism * 0.36);
    ctx.drawImage(
      work,
      -(expandW - width) * 0.5 - shiftPx,
      -(expandH - height) * 0.5 - Math.round(shiftPx * 0.25),
      expandW,
      expandH
    );
    ctx.drawImage(work, shiftPx, Math.round(shiftPx * 0.25), width, height);
    ctx.restore();
  }

  // Hologram Ghost Offset
  if (crt.hologramGhost > 0) {
    const work = getWorkCanvas(width, height);
    const wctx = work.getContext('2d')!;
    wctx.clearRect(0, 0, width, height);
    wctx.drawImage(ctx.canvas, 0, 0);

    const ghostPx = Math.round((crt.hologramGhost / 100) * 14 * scale);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = (crt.hologramGhost / 100) * 0.32;
    ctx.drawImage(work, ghostPx, -Math.round(ghostPx * 0.25));
    ctx.restore();
  }

  // Global CRT Scanlines
  if (crt.scanlines > 0) {
    const step = Math.max(2, Math.round(3 * scale));
    ctx.fillStyle = `rgba(0, 0, 0, ${(crt.scanlines / 100) * 0.24})`;
    for (let y = 0; y < height; y += step) {
      ctx.fillRect(0, y, width, Math.max(1, Math.round(1 * scale)));
    }
  }

  // CRT RGB Aperture Grille Mask
  if (crt.apertureMask > 0) {
    const maskStep = Math.max(3, Math.round(4 * scale));
    const alpha = (crt.apertureMask / 100) * 0.16;
    for (let x = 0; x < width; x += maskStep) {
      ctx.fillStyle = `rgba(255, 60, 60, ${alpha})`;
      ctx.fillRect(x, 0, 1 * scale, height);
      ctx.fillStyle = `rgba(60, 255, 100, ${alpha})`;
      ctx.fillRect(x + 1 * scale, 0, 1 * scale, height);
      ctx.fillStyle = `rgba(60, 120, 255, ${alpha})`;
      ctx.fillRect(x + 2 * scale, 0, 1 * scale, height);
    }
  }

  // Vignette + CRT Barrel Tube Bezel
  if (crt.vignette > 0 || crt.barrelCurve > 0) {
    const cx = width * 0.5;
    const cy = height * 0.5;
    const maxR = Math.hypot(cx, cy);
    const vigStrength = Math.min(
      0.92,
      (crt.vignette / 100) * 0.72 + (crt.barrelCurve / 100) * 0.35
    );
    const grad = ctx.createRadialGradient(cx, cy, maxR * 0.35, cx, cy, maxR);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    grad.addColorStop(1, `rgba(2, 3, 5, ${vigStrength})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    if (crt.barrelCurve > 5) {
      const cornerRadius =
        (crt.barrelCurve / 100) * Math.min(width, height) * 0.08;
      ctx.save();
      ctx.strokeStyle = 'rgba(10, 12, 16, 0.96)';
      const borderW = (crt.barrelCurve / 100) * 22 * scale;
      ctx.lineWidth = borderW;
      ctx.beginPath();
      ctx.roundRect(
        borderW * 0.35,
        borderW * 0.35,
        width - borderW * 0.7,
        height - borderW * 0.7,
        cornerRadius
      );
      ctx.stroke();

      const glareGrad = ctx.createLinearGradient(
        0,
        0,
        width * 0.65,
        height * 0.65
      );
      glareGrad.addColorStop(
        0,
        `rgba(255, 255, 255, ${(crt.barrelCurve / 100) * 0.07})`
      );
      glareGrad.addColorStop(0.35, 'rgba(255, 255, 255, 0.015)');
      glareGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = glareGrad;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }
  }

  // Film & Signal Grain
  if (crt.filmGrain > 0) {
    const rng = createPRNG(Math.floor(time * 24) * 313 + 19);
    const grainAlpha = (crt.filmGrain / 100) * 0.14;
    const specks = Math.round(((width * height) / 900) * (crt.filmGrain / 100));
    ctx.fillStyle = `rgba(255, 255, 255, ${grainAlpha})`;
    const dotSize = Math.max(1, Math.round(1.5 * scale));
    for (let i = 0; i < specks; i++) {
      const gx = rng() * width;
      const gy = rng() * height;
      ctx.fillRect(gx, gy, dotSize, dotSize);
    }
  }

  // Optical Dust & Scratches
  if ((crt.dustSpec ?? 0) > 0) {
    const dust01 = (crt.dustSpec ?? 0) / 100;
    const rng = createPRNG(Math.floor(time * 8) * 199 + 41);
    const dustCount = Math.round(18 * dust01);
    ctx.save();
    ctx.strokeStyle = `rgba(244, 244, 236, ${0.18 + dust01 * 0.25})`;
    ctx.fillStyle = `rgba(244, 244, 236, ${0.22 + dust01 * 0.3})`;
    ctx.lineWidth = Math.max(0.8, 0.9 * scale);
    for (let i = 0; i < dustCount; i++) {
      const dx = rng() * width;
      const dy = rng() * height;
      if (rng() > 0.35) {
        ctx.fillRect(dx, dy, 1.8 * scale, 1.8 * scale);
      } else {
        const len = (10 + rng() * 28) * scale;
        const ang = rng() * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(dx, dy);
        ctx.lineTo(dx + Math.cos(ang) * len, dy + Math.sin(ang) * len);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}

/**
 * Interactive Cursor Hover Post-Effects: Reveal, Trail & Subtle Cursor Ring
 */
function applyCursorHoverEffect(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  width: number,
  height: number,
  cursor: CursorPosition,
  effect: StudioState['crt']['cursorEffect'],
  hoverRadiusPct: number,
  hoverStrengthPct: number,
  baseCanvas: BaseCanvasSettings
): void {
  if (hoverStrengthPct <= 0) return;
  const cx = cursor.x * width;
  const cy = cursor.y * height;
  const radius = Math.max(
    18,
    Math.hypot(width, height) * (hoverRadiusPct / 100)
  );
  const strength01 = hoverStrengthPct / 100;

  if (effect === 'reveal') {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();
    ctx.globalAlpha = strength01;
    drawFramedImage(ctx, img, width, height, baseCanvas);
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.45 * strength01})`;
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  } else if (effect === 'trail') {
    const work = getWorkCanvas(width, height);
    const wctx = work.getContext('2d')!;
    wctx.clearRect(0, 0, width, height);
    wctx.drawImage(ctx.canvas, 0, 0);

    const shift = Math.max(2, Math.round(12 * strength01));
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.55 * strength01;
    ctx.drawImage(work, shift, -shift * 0.5);
    ctx.drawImage(work, -shift, shift * 0.5);
    ctx.restore();
  }
}
