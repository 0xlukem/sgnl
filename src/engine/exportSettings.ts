export type VideoQuality = 'compact' | 'balanced' | 'high';
export type VideoSize = 720 | 1080 | 1440;

export const VIDEO_QUALITIES: { id: VideoQuality; label: string; bitsPerSecond: number }[] = [
  { id: 'compact', label: 'Compact · 4 Mbps', bitsPerSecond: 4_000_000 },
  { id: 'balanced', label: 'Balanced · 8 Mbps', bitsPerSecond: 8_000_000 },
  { id: 'high', label: 'High · 16 Mbps', bitsPerSecond: 16_000_000 },
];

export const WEBP_QUALITIES = [
  { value: 0.75, label: 'Compact · 75%' },
  { value: 0.9, label: 'Balanced · 90%' },
  { value: 0.98, label: 'High · 98%' },
] as const;

export interface VideoFormat {
  mimeType: string;
  extension: 'webm' | 'mp4';
  label: string;
}

/** Prefer the existing WebM path; offer MP4 when this browser can encode it. */
export function getSupportedVideoFormats(isSupported: (mime: string) => boolean): VideoFormat[] {
  const formats: VideoFormat[] = [];
  if (isSupported('video/webm;codecs=vp9')) {
    formats.push({ mimeType: 'video/webm;codecs=vp9', extension: 'webm', label: 'WebM · VP9' });
  } else if (isSupported('video/webm')) {
    formats.push({ mimeType: 'video/webm', extension: 'webm', label: 'WebM' });
  }
  if (isSupported('video/mp4')) {
    formats.push({ mimeType: 'video/mp4', extension: 'mp4', label: 'MP4' });
  }
  return formats;
}

/** Retain the photo's orientation and fit inside a maximum long edge; don't upscale. */
export function getVideoDimensions(width: number, height: number, longEdge: VideoSize) {
  const ratio = Math.min(1, longEdge / Math.max(width, height));
  // Even sizes work with common MP4 encoders; the minimum valid dimension is 2px.
  const even = (side: number) => Math.max(2, Math.floor(side * ratio / 2) * 2);
  return { width: even(width), height: even(height) };
}
