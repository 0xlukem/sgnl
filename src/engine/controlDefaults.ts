/** Display-unit defaults used by both explicit Reset and library gestures. */
export const CONTROL_DEFAULTS: Readonly<Record<string, number>> = {
  'style-cell-size': 11, 'style-local-contrast': 100,
  'print-angle': -35, 'print-weight': 100, 'print-roughness': 30, 'print-registration': 25,
  'tile-gap': 15, 'tile-roundness': 25, 'canvas-knockout-opacity': 92, 'canvas-': 12,
  'frame-zoom': 100, 'frame-pan-x': 0, 'frame-pan-y': 0,
  'txt-size': 54, 'txt-x': 50, 'txt-y': 86,
  'grade-brightness': 0, 'grade-contrast': 100, 'grade-saturation': 100,
  'grade-black': 0, 'grade-white': 100, 'grade-gamma': 100,
  'grade-shadows': 0, 'grade-highlights': 0, 'grade-edge': 0, 'grade-sharpen': 0, 'grade-denoise': 0,
  'warp-intensity': 0, 'warp-radius': 75, 'warp-frequency': 6, 'warp-angle': 0,
  'trk-intensity': 0, 'trk-band-height': 10, 'trk-pos': 50, 'trk-bleed': 0, 'trk-jitter': 0, 'trk-dropouts': 0,
  'gl-freq': 0, 'gl-disp': 0, 'gl-rgb': 0, 'gl-databend': 0,
  'ps-strength': 40, 'ps-min': 0, 'ps-max': 100,
  'motion-speed': 100, 'motion-amount': 50, 'playback-speed': 100,
  'crt-glow': 0, 'crt-whole-bloom': 0, 'crt-prism': 0, 'crt-scan': 0, 'crt-mask': 0,
  'crt-curve': 0, 'crt-vig': 0, 'crt-grain': 0, 'crt-dust': 0,
  'hover-radius': 18, 'hover-strength': 65,
  'light-0-intensity': 65, 'light-0-radius': 55, 'light-0-x': 25, 'light-0-y': 28,
  'light-1-intensity': 60, 'light-1-radius': 50, 'light-1-x': 75, 'light-1-y': 68,
  'light-2-intensity': 50, 'light-2-radius': 45, 'light-2-x': 50, 'light-2-y': 20,
};
export function getControlResetValue(id: string | undefined, min: number, max: number, explicit?: number) {
  return Math.max(min, Math.min(max, explicit ?? (id ? CONTROL_DEFAULTS[id] : undefined) ?? (min <= 0 && max >= 0 ? 0 : min)));
}
