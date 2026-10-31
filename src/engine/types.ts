export type GlyphFamily =
  // 8 Character / Console Styles
  | 'density'
  | 'geometric'
  | 'braille'
  | 'telemetry'
  | 'ascii'
  | 'lines'
  | 'cross'
  | 'diagonal'
  | 'diamond'
  // 8 Dither Styles
  | 'dither-bayer'
  | 'dither-bayer8'
  | 'dither-floyd'
  | 'dither-atkinson'
  | 'dither-bluenoise'
  | 'dither-noise'
  | 'dither-lines'
  | 'dither-radial'
  // 7 Geometric & Tile Styles
  | 'halftone'
  | 'dots'
  | 'cmyk'
  | 'led'
  | 'mosaic'
  | 'hex'
  | 'lego'
  | 'voxel'
  // 6 Print & Illustration Styles
  | 'engraving'
  | 'crosshatch'
  | 'stipple'
  | 'woodblock'
  | 'risograph-print'
  | 'pointillism';

export type PhosphorColor =
  | 'green'
  | 'amber'
  | 'white'
  | 'cyan'
  | 'crimson'
  | 'sampled'
  | 'grayscale'
  | 'risograph'
  | 'blueprint'
  | 'newsprint'
  | 'gameboy'
  | 'macintosh'
  | 'custom';

export type SubstrateMode =
  | 'knockout'
  | 'glass'
  | 'source'
  | 'duotone'
  | 'solid'
  | 'gradient'
  | 'transparent';

export type RegionShape = 'rect' | 'ellipse';

export type StudioWorkspace = 'image' | 'animate';

export interface AnimationSettings {
  enabled: boolean;
  /** Shared clock multiplier. Legacy motionSpeed remains a local effect speed. */
  playbackSpeed: number;
  channels?: {
    distortion?: boolean;
    tracking?: boolean;
    glitch?: boolean;
    textures?: boolean;
  };
}

export type RegionBlendMode =
  | 'source-over'
  | 'screen'
  | 'multiply'
  | 'overlay'
  | 'difference';

export type CanvasCompositionMode = 'full' | 'blocks' | 'hybrid';

export type AspectRatioPreset =
  | 'original'
  | '1:1'
  | '4:5'
  | '16:9'
  | '9:16'
  | '4:3'
  | '21:9';

export type HudOverlayMode = 'off' | 'telemetry' | 'camcorder' | 'cctv' | 'hologram';

export type CursorHoverEffect =
  | 'off'
  | 'reveal'
  | 'loupe'
  | 'trail'
  | 'repel'
  | 'dissolve'
  | 'water'
  | 'vortex'
  | 'magnetic'
  | 'scatter';

export type StillMotionMode =
  | 'off'
  | 'relight'
  | 'sheen'
  | 'glow'
  | 'shimmer'
  | 'parallax'
  | 'push'
  | 'focus'
  | 'mist';

export type SourceWarpMode =
  | 'off'
  | 'ripple'
  | 'wave'
  | 'swirl'
  | 'pinch'
  | 'sphere'
  | 'zigzag'
  | 'shear'
  | 'polar'
  | 'fragment';

export type CurvePreset =
  | 'linear'
  | 's-curve'
  | 'high-contrast'
  | 'faded-film'
  | 'crushed-blacks'
  | 'solarize'
  | 'inverse';

export type MonoFontFamily = 'JetBrains Mono' | 'Space Mono' | 'Fira Code';

export interface AsciiRegion {
  id: string;
  label: string;
  /** Normalized 0..1 coordinates relative to image dimensions */
  x: number;
  y: number;
  w: number;
  h: number;
  cellSize: number; // 4..40 px
  glyphFamily: GlyphFamily;
  color: PhosphorColor;
  customColorHex?: string;
  secondaryColorHex?: string;
  /** An explicit legacy palette override, shown as Modified until a preset is chosen. */
  paletteModified?: boolean;
  knockoutOpacity: number; // 0..1
  contrast: number; // 0.5..2.2
  substrateMode?: SubstrateMode;
  shape?: RegionShape;
  hudFrame?: boolean;
  invert?: boolean;
  /** Soft edge feathering in pixels (0..40) */
  feather?: number;
  /** Layer blend mode */
  blendMode?: RegionBlendMode;
  /** Optional custom character ramp string when using glyph styles */
  customChars?: string;
  /** Optional wordmark text repeated across cells */
  wordmarkText?: string;
  /** Font family for glyph styles */
  fontFamily?: MonoFontFamily;
  /** Tile gap (0..0.5) for mosaic/lego/hex/led */
  tileGap?: number;
  /** Tile corner roundness (0..1) */
  tileRoundness?: number;
  /** Print style line angle (-180..180 deg) */
  printAngle?: number;
  /** Print style stroke weight (0.25..2) */
  printWeight?: number;
  /** Print style organic roughness (0..1) */
  printRoughness?: number;
  /** Risograph registration offset (0..1) */
  printRegistration?: number;
  /** Layer visibility toggle */
  hidden?: boolean;
  /** Layer position/size lock toggle */
  locked?: boolean;
}

export interface BaseCanvasSettings {
  /** 'full' = entire image rendered, 'blocks' = original photo + block layers, 'hybrid' = full image rendered + block layers on top */
  mode: CanvasCompositionMode;
  /** Style settings applied to the entire image when mode is 'full' or 'hybrid' */
  cellSize: number; // 4..40 px
  glyphFamily: GlyphFamily;
  color: PhosphorColor;
  customColorHex?: string;
  secondaryColorHex?: string;
  paletteModified?: boolean;
  knockoutOpacity: number; // 0..1
  contrast: number; // 0.5..2.2
  substrateMode: SubstrateMode;
  backdropBlur?: number; // 0..32 px
  backdropColor?: string;
  backdropColor2?: string;
  invert?: boolean;
  customChars?: string;
  wordmarkText?: string;
  fontFamily?: MonoFontFamily;
  tileGap?: number;
  tileRoundness?: number;
  printAngle?: number;
  printWeight?: number;
  printRoughness?: number;
  printRegistration?: number;
  /** Framing & Crop */
  aspectRatio?: AspectRatioPreset;
  zoom?: number; // 1..3
  panX?: number; // -0.5..0.5
  panY?: number; // -0.5..0.5
  flipX?: boolean;
  flipY?: boolean;
}

export interface RadialLight2D {
  id: string;
  enabled: boolean;
  x: number; // 0..1
  y: number; // 0..1
  radius: number; // 0.1..1.2
  intensity: number; // 0..100
  color: string; // hex
}

export interface TextOverlaySettings {
  enabled: boolean;
  text: string;
  subtext?: string;
  x: number; // 0..1
  y: number; // 0..1
  size: number; // 20..160
  color: string;
  layerOrder: 'behind-glyphs' | 'front';
  fontStyle: 'editorial-mono' | 'ascii-banner' | 'minimal-sans';
}

export interface SourceGradingSettings {
  brightness?: number; // -50..50 (default 0)
  blackPoint: number; // 0..45
  whitePoint: number; // 55..100
  gamma: number; // 0.25..3.0
  contrast: number; // 50..200
  shadows?: number; // -100..100
  highlights?: number; // -100..100
  edgeBoost: number; // 0..100 (Sobel edge enhancement)
  denoise?: number; // 0..100 (3x3 edge-preserving filter)
  sharpen?: number; // 0..100
  saturation?: number; // 0..200 (default 100)
  curvePreset?: CurvePreset;
  warpMode?: SourceWarpMode;
  warpIntensity?: number; // -100..100
  warpCenterX?: number; // 0..1
  warpCenterY?: number; // 0..1
  warpRadius?: number; // 0.1..1.5
  warpAngle?: number; // -180..180
  warpFrequency?: number; // 1..20
}

export interface TrackingSettings {
  enabled: boolean;
  intensity: number; // 0..100
  bandHeight: number; // 4..35 (% of canvas height)
  position: number; // 0..100 (% of canvas Y)
  autoRoll: boolean;
  lineJitter: number; // 0..100
  chromaBleed: number; // 0..100
  dropouts: number; // 0..100
}

export interface GlitchSettings {
  enabled: boolean;
  sliceFrequency: number; // 0..100
  maxDisplacement: number; // 0..100
  rgbSplit: number; // 0..100
  databendChunks: number; // 0..100
  pixelSortEnabled: boolean;
  pixelSortMin: number; // 0..100
  pixelSortMax: number; // 0..100
  pixelSortDirection: 'columns' | 'rows';
  pixelSortStrength: number; // 0..100
  seed: number;
}

export interface CrtSettings {
  phosphorGlow: number; // 0..100 (Character Bloom)
  wholeBloom?: number; // 0..100 (Whole composition halation)
  scanlines: number; // 0..100
  apertureMask: number; // 0..100 (RGB phosphor grille)
  barrelCurve: number; // 0..100
  vignette: number; // 0..100
  filmGrain: number; // 0..100
  dustSpec?: number; // 0..100 (Optical dust & scratches)
  hologramGhost: number; // 0..100
  radialBlur?: number; // 0..100 (Edge optical blur)
  hudOverlay: HudOverlayMode;
  hudLabel: string;
  cursorEffect: CursorHoverEffect;
  hoverRadius?: number; // 5..50 (%)
  hoverStrength?: number; // 0..100 (%)
  motionMode?: StillMotionMode;
  motionSpeed?: number; // 10..300 (%)
  motionAmount?: number; // 0..100 (%)
  prismAberration?: number; // 0..100
  lights?: RadialLight2D[];
  textOverlay?: TextOverlaySettings;
}

export interface StudioState {
  schemaVersion?: 2;
  animation?: AnimationSettings;
  baseCanvas?: BaseCanvasSettings;
  regions: AsciiRegion[];
  grading: SourceGradingSettings;
  tracking: TrackingSettings;
  glitch: GlitchSettings;
  crt: CrtSettings;
  randomSeed: number;
}

export interface Recipe {
  id: string;
  name: string;
  tagline: string;
  category:
    | 'Terminal'
    | 'Full Artwork'
    | 'Print & Dither'
    | 'Signal & VHS'
    | 'Custom';
  badgeColor: string;
  state: StudioState;
  isCustom?: boolean;
}

export type StyleGroup =
  | 'Glyphs'
  | 'Dither'
  | 'Tiles & Halftone'
  | 'Print & Etch';

export const GLYPH_RAMPS: Record<
  GlyphFamily,
  {
    name: string;
    shortLabel: string;
    group: StyleGroup;
    chars: string[];
    preview: string;
    description: string;
  }
> = {
  // 1. GLYPHS (9)
  density: {
    name: 'Console Blocks',
    shortLabel: '░▒▓█',
    group: 'Glyphs',
    chars: [' ', '·', '░', '▒', '▓', '█'],
    preview: '░▒▓█',
    description: 'Phosphor CRT density block console glyphs',
  },
  geometric: {
    name: 'Sub-Blocks',
    shortLabel: '▀▄▌▐',
    group: 'Glyphs',
    chars: [' ', '▪', '▄', '▀', '▌', '▐', '■', '█'],
    preview: '▀▄▌▐',
    description: 'Half-block sub-pixel geometry for sharp silhouettes',
  },
  braille: {
    name: 'Braille 8-Dot',
    shortLabel: '⠁⠃⠇⣿',
    group: 'Glyphs',
    chars: [' ', '⠁', '⠃', '⠇', '⠏', '⠟', '⠿', '⡿', '⣿'],
    preview: '⠁⠃⠇⣿',
    description: 'High-resolution 8-dot tactile braille matrix',
  },
  telemetry: {
    name: 'Box Drawing',
    shortLabel: '─│┼┌',
    group: 'Glyphs',
    chars: [' ', '·', ':', '─', '│', '┌', '┐', '┼', '╬', '█'],
    preview: '─│┼┌',
    description: 'Structural box-drawing and schematic telemetry glyphs',
  },
  ascii: {
    name: 'Classic ASCII',
    shortLabel: '.:*#',
    group: 'Glyphs',
    chars: [' ', '.', ':', '-', '=', '+', '*', '#', '%', '@'],
    preview: '.:*#@',
    description: 'Traditional fixed-width typographic luminance ramp',
  },
  lines: {
    name: 'Directional Lines',
    shortLabel: '─│╱╲',
    group: 'Glyphs',
    chars: [' ', '·', '─', '│', '╱', '╲', '┼', '╳', '╬'],
    preview: '─│╱╲',
    description: 'Directional stroke segments aligned to subject contours',
  },
  cross: {
    name: 'Cross Matrix',
    shortLabel: '·+xX',
    group: 'Glyphs',
    chars: [' ', '·', '+', 'x', 'X', '┼', '╳', '#', '█'],
    preview: '·+xX#',
    description: 'Precision crosshair glyphs weighted by luminance',
  },
  diagonal: {
    name: 'Slash & Hatch',
    shortLabel: '/╱╳#',
    group: 'Glyphs',
    chars: [' ', '·', '/', '╱', '╲', '╳', '※', '#'],
    preview: '/╱╳※',
    description: 'Technical diagonal hatch and drafting characters',
  },
  diamond: {
    name: 'Diamonds',
    shortLabel: '·◇◈◆',
    group: 'Glyphs',
    chars: [' ', '·', '∙', '◇', '◈', '◆', '❖', '█'],
    preview: '·◇◈◆',
    description: 'Progressive geometric diamond lattice grid',
  },

  // 2. DITHER (8)
  'dither-bayer': {
    name: 'Bayer 4×4',
    shortLabel: 'BAY4',
    group: 'Dither',
    chars: [' ', '░', '▒', '▓', '█'],
    preview: '▚▞▚',
    description: 'Classic 4×4 cross-threshold ordered dither matrix',
  },
  'dither-bayer8': {
    name: 'Bayer 8×8 Fine',
    shortLabel: 'BAY8',
    group: 'Dither',
    chars: [' ', '░', '▒', '▓', '█'],
    preview: '∷[::]',
    description: 'Fine 8×8 ordered dither matrix with 64 tonal levels',
  },
  'dither-floyd': {
    name: 'Floyd-Steinberg',
    shortLabel: 'FLYD',
    group: 'Dither',
    chars: [' ', '█'],
    preview: '∴∵∴',
    description: 'Organic 4-neighbor error diffusion halftone',
  },
  'dither-atkinson': {
    name: 'Atkinson 1-Bit',
    shortLabel: 'ATKN',
    group: 'Dither',
    chars: [' ', '█'],
    preview: '[::]',
    description: 'Bill Atkinson 1-bit high-contrast error diffusion',
  },
  'dither-bluenoise': {
    name: 'Blue Noise 64',
    shortLabel: 'BLUE',
    group: 'Dither',
    chars: [' ', '█'],
    preview: '⋯⋮⋯',
    description: 'Stochastic blue noise without low-frequency banding',
  },
  'dither-noise': {
    name: 'Film Stipple Noise',
    shortLabel: 'NOIS',
    group: 'Dither',
    chars: [' ', '█'],
    preview: '⋅∶⋅',
    description: 'Deterministic cell-quantized film grain stipple',
  },
  'dither-lines': {
    name: 'Linear Scan Dither',
    shortLabel: 'LINE',
    group: 'Dither',
    chars: [' ', '█'],
    preview: '≡═≡',
    description: 'Parallel linear scanline pulse-width modulation',
  },
  'dither-radial': {
    name: 'Radial Concentric',
    shortLabel: 'RADL',
    group: 'Dither',
    chars: [' ', '█'],
    preview: '◎◉◎',
    description: 'Luminance-modulated concentric orbital rings',
  },

  // 3. TILES & HALFTONE (7)
  halftone: {
    name: 'Halftone Press',
    shortLabel: 'HALFT',
    group: 'Tiles & Halftone',
    chars: [' ', '·', '•', '●'],
    preview: '·•●•',
    description: 'Rotated press halftone dot screen pattern',
  },
  dots: {
    name: 'Precision Dots',
    shortLabel: 'DOTS',
    group: 'Tiles & Halftone',
    chars: [' ', '•', '●'],
    preview: '••●',
    description: 'Orthogonal clean dot matrix grid',
  },
  cmyk: {
    name: 'CMYK Rosette',
    shortLabel: 'CMYK',
    group: 'Tiles & Halftone',
    chars: [' ', '•', '●'],
    preview: '◎●◎',
    description: '4-pass Cyan, Magenta, Yellow and Black rosette print separation',
  },
  led: {
    name: 'LED Emitter Grid',
    shortLabel: 'LED',
    group: 'Tiles & Halftone',
    chars: [' ', '◉'],
    preview: '◉◉◉',
    description: 'Incandescent LED emitter grid with dark cavity masks',
  },
  mosaic: {
    name: 'Mosaic Tiles',
    shortLabel: 'TILE',
    group: 'Tiles & Halftone',
    chars: [' ', '■'],
    preview: '▪■▪',
    description: 'Rounded tesserae tiles with adjustable edge specular bevel',
  },
  hex: {
    name: 'Hexagon Honeycomb',
    shortLabel: 'HEX',
    group: 'Tiles & Halftone',
    chars: [' ', '⬢'],
    preview: '⬡⬢⬡',
    description: 'Seamless interlocking hexagonal honeycomb matrix',
  },
  lego: {
    name: 'Studded Bricks',
    shortLabel: 'BRICK',
    group: 'Tiles & Halftone',
    chars: [' ', '▣'],
    preview: '▣▣▣',
    description: 'Plastic studded brick tessellation with directional drop shadow',
  },
  voxel: {
    name: 'Isometric Voxel 3D',
    shortLabel: 'VOXL',
    group: 'Tiles & Halftone',
    chars: [' ', '立方'],
    preview: '⬡⬢⬣',
    description: 'Isometric 3D voxels modulated in real time by luminance height',
  },

  // 4. PRINT & ETCH (6)
  engraving: {
    name: 'Linear Engraving',
    shortLabel: 'ETCH',
    group: 'Print & Etch',
    chars: [' ', '─', '═', '▬'],
    preview: '≈═≈',
    description: 'Continuous-line intaglio engraving with variable stroke weight',
  },
  crosshatch: {
    name: 'Crosshatch Ink',
    shortLabel: 'HATCH',
    group: 'Print & Etch',
    chars: [' ', '╱', '╳', '╬'],
    preview: '╱╳╬',
    description: '3-pass crossed drafting pen ink shading by shadow threshold',
  },
  stipple: {
    name: 'Ink Stipple',
    shortLabel: 'STPL',
    group: 'Print & Etch',
    chars: [' ', '·', '•'],
    preview: '∵∴∷',
    description: 'Organic Indian ink stippling with tonal density distribution',
  },
  woodblock: {
    name: 'Woodblock Cut',
    shortLabel: 'WOOD',
    group: 'Print & Etch',
    chars: [' ', '▬', '█'],
    preview: '≡▬≡',
    description: 'Chiseled woodblock relief with high-contrast organic grain',
  },
  'risograph-print': {
    name: 'Risograph 2-Drum',
    shortLabel: 'RISO',
    group: 'Print & Etch',
    chars: [' ', '•', '●'],
    preview: '◐◑◐',
    description: 'Dual-drum Japanese soy ink print with tactile registration misalignment',
  },
  pointillism: {
    name: 'Pointillism Brush',
    shortLabel: 'PNTL',
    group: 'Print & Etch',
    chars: [' ', '•'],
    preview: '∘∙•',
    description: 'Gradient-aligned elliptical pigment dab pointillism',
  },
};

export const CHARACTER_PRESETS: {
  id: string;
  label: string;
  chars: string;
}[] = [
  { id: 'blocks', label: 'Console Blocks', chars: ' ·░▒▓█' },
  { id: 'subblocks', label: 'Sub-Blocks', chars: ' ▪▄▀▌▐■█' },
  { id: 'braille', label: 'Braille 8-Dot', chars: ' ⠁⠃⠇⠏⠟⠿⡿⣿' },
  { id: 'telemetry', label: 'Box & Grid', chars: ' ·:─│┌┐┼╬█' },
  { id: 'standard', label: 'Classic 10', chars: ' .:-=+*#%@' },
  {
    id: 'detailed',
    label: 'Detailed 32',
    chars: ' .\'`^",:;Il!i><~+_-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$',
  },
  { id: 'binary', label: 'Binary 01', chars: ' 01' },
  { id: 'minimal', label: 'Minimal Dot/Bar', chars: ' ·•▬█' },
];

export const PHOSPHOR_PALETTES: Record<
  PhosphorColor,
  {
    name: string;
    shortName: string;
    hex: string;
    secondaryHex?: string;
    glowRgba: string;
    substrateHex: string;
  }
> = {
  green: {
    name: 'Phosphor P31',
    shortName: 'P31 Green',
    hex: '#39FF14',
    glowRgba: 'rgba(57, 255, 20, 0.6)',
    substrateHex: '#050806',
  },
  amber: {
    name: 'Amber P3',
    shortName: 'P3 Amber',
    hex: '#FFB000',
    glowRgba: 'rgba(255, 176, 0, 0.6)',
    substrateHex: '#090603',
  },
  white: {
    name: 'Warm CRT P4',
    shortName: 'Warm CRT',
    hex: '#F4F4EC',
    glowRgba: 'rgba(244, 244, 236, 0.5)',
    substrateHex: '#070709',
  },
  sampled: {
    name: 'Full Photo RGB',
    shortName: 'Photo RGB',
    hex: '#38BDF8',
    glowRgba: 'rgba(56, 189, 248, 0.4)',
    substrateHex: '#060709',
  },
  grayscale: {
    name: 'Silver Halide B&W',
    shortName: 'Grayscale',
    hex: '#E4E4E7',
    glowRgba: 'rgba(228, 228, 231, 0.4)',
    substrateHex: '#08080A',
  },
  cyan: {
    name: 'Terminal Cyan',
    shortName: 'Cyan',
    hex: '#63F5FF',
    glowRgba: 'rgba(99, 245, 255, 0.6)',
    substrateHex: '#03080b',
  },
  crimson: {
    name: 'Darkroom Red',
    shortName: 'Crimson',
    hex: '#FF3355',
    glowRgba: 'rgba(255, 51, 85, 0.6)',
    substrateHex: '#0a0305',
  },
  risograph: {
    name: 'Risograph Dual',
    shortName: 'Riso Dual',
    hex: '#00E5A3',
    secondaryHex: '#FF3B7F',
    glowRgba: 'rgba(255, 59, 127, 0.5)',
    substrateHex: '#0A080C',
  },
  blueprint: {
    name: 'Cyanotype Blueprint',
    shortName: 'Blueprint',
    hex: '#E2F1FF',
    secondaryHex: '#38BDF8',
    glowRgba: 'rgba(56, 189, 248, 0.45)',
    substrateHex: '#07192E',
  },
  newsprint: {
    name: 'Archival Newsprint',
    shortName: 'Newsprint',
    hex: '#EAE4D7',
    secondaryHex: '#A69F91',
    glowRgba: 'rgba(234, 228, 215, 0.3)',
    substrateHex: '#12110E',
  },
  gameboy: {
    name: 'DMG-01 Olive',
    shortName: 'DMG Olive',
    hex: '#9BBC0F',
    secondaryHex: '#306230',
    glowRgba: 'rgba(155, 188, 15, 0.45)',
    substrateHex: '#0F380F',
  },
  macintosh: {
    name: '1-Bit Paper & Ink',
    shortName: '1-Bit Paper',
    hex: '#141413',
    secondaryHex: '#575653',
    glowRgba: 'rgba(20, 20, 19, 0.2)',
    substrateHex: '#F2EFE9',
  },
  custom: {
    name: 'Custom Ink',
    shortName: 'Custom',
    hex: '#00FF66',
    secondaryHex: '#FF3B7F',
    glowRgba: 'rgba(0, 255, 102, 0.5)',
    substrateHex: '#060709',
  },
};

export const DEFAULT_BASE_CANVAS: BaseCanvasSettings = {
  mode: 'blocks',
  cellSize: 10,
  glyphFamily: 'density',
  color: 'green',
  customColorHex: '#39FF14',
  secondaryColorHex: '#FF3B7F',
  knockoutOpacity: 0.92,
  contrast: 1.25,
  substrateMode: 'knockout',
  backdropBlur: 12,
  backdropColor: '#050708',
  backdropColor2: '#131824',
  invert: false,
  fontFamily: 'JetBrains Mono',
  tileGap: 0.15,
  tileRoundness: 0.25,
  printAngle: -35,
  printWeight: 1.0,
  printRoughness: 0.3,
  printRegistration: 0.25,
  aspectRatio: 'original',
  zoom: 1,
  panX: 0,
  panY: 0,
  flipX: false,
  flipY: false,
};
