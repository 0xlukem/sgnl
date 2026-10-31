import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import type { AsciiRegion, StudioState } from '../engine/types';
import {
  DEFAULT_BASE_CANVAS,
  GLYPH_RAMPS,
} from '../engine/types';
import { clampLayerGeometry, createStudioLayer, duplicateStudioLayer, getSoloPreviewState, nudgeStudioLayer } from '../engine/layers';
import './layers.css';
import type { CursorPosition } from '../engine/renderer';
import { renderStudioFrame } from '../engine/renderer';
import { RegionFloatingHud } from './RegionFloatingHud';
import { Lock, Plus, Minus, Maximize2 } from 'lucide-react';

interface CanvasStageProps {
  image: HTMLImageElement | null;
  state: StudioState;
  selectedRegionId: string | null;
  onSelectRegion: (id: string | null) => void;
  onUpdateRegions: (regions: AsciiRegion[], recordHistory?: boolean) => void;
  time: number;
  showOriginalOnly: boolean;
  splitCompareActive: boolean;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  onImageDrop: (file: File) => void;
  renderIntent?: 'image' | 'animate';
  animationEnabled?: boolean;
  playbackSpeed?: number;
  soloRegionId?: string | null;
  onEditLayer?: () => void;
}

type DragMode =
  | {
      type: 'move';
      id: string;
      startX: number;
      startY: number;
      origX: number;
      origY: number;
      duplicated?: boolean;
    }
  | {
      type: 'resize';
      id: string;
      handle: 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
      startX: number;
      startY: number;
      orig: { x: number; y: number; w: number; h: number };
    }
  | {
      type: 'create';
      id: string;
      startX: number;
      startY: number;
      startClientX: number;
      startClientY: number;
      initialized: boolean;
    };

const SNAP_POINTS = [0, 0.3333, 0.5, 0.6667, 1];
const SNAP_THRESHOLD = 0.012;

export const CanvasStage: React.FC<CanvasStageProps> = ({
  image,
  state,
  selectedRegionId,
  onSelectRegion,
  onUpdateRegions,
  time,
  showOriginalOnly,
  splitCompareActive,
  canvasRef,
  onImageDrop,
  renderIntent = 'image',
  animationEnabled,
  playbackSpeed,
  soloRegionId = null,
  onEditLayer,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [stageSize, setStageSize] = useState({ width: 800, height: 700 });
  const [fontRevision, setFontRevision] = useState(0);

  useEffect(() => {
    const refresh = () => setFontRevision((revision) => revision + 1);
    document.fonts.addEventListener('loadingdone', refresh);
    return () => document.fonts.removeEventListener('loadingdone', refresh);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(([entry]) => {
      setStageSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Infinite Canvas: Pan & Zoom
  const [customZoom, setCustomZoom] = useState(1);
  const [viewMode, setViewMode] = useState<'fit' | 'actual' | 'custom'>('fit');
  const fitWidth = image ? Math.max(1, Math.min(
    image.naturalWidth,
    stageSize.width - (stageSize.width < 600 ? 32 : 96),
    Math.max(1, stageSize.height - (stageSize.height < 360 ? 72 : 132)) * image.naturalWidth / image.naturalHeight,
  )) : 1;
  const zoom = viewMode === 'fit' ? 1 : viewMode === 'actual' && image ? image.naturalWidth / fitWidth : customZoom;
  const maxZoom = image ? Math.max(5, image.naturalWidth / fitWidth * 4) : 5;
  const setZoom = (next: number | ((current: number) => number)) => {
    setCustomZoom(typeof next === 'function' ? next(zoom) : next);
    setViewMode('custom');
  };
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const [isSpacePressed, setIsSpacePressed] = useState<boolean>(false);

  const [dragMode, setDragMode] = useState<DragMode | null>(null);
  const [snapGuides, setSnapGuides] = useState<{ x: number[]; y: number[] }>({
    x: [],
    y: [],
  });
  const [isDragOverFile, setIsDragOverFile] = useState(false);
  const [splitWipeX, setSplitWipeX] = useState<number>(0.5);
  const [cursorPos, setCursorPos] = useState<CursorPosition>({
    x: 0.5,
    y: 0.5,
    active: false,
  });

  const baseCanvas = state.baseCanvas ?? DEFAULT_BASE_CANVAS;
  const previewState = useMemo(() => getSoloPreviewState(state, soloRegionId), [state, soloRegionId]);
  const pendingKeyboardRegions = useRef<AsciiRegion[] | null>(null);
  const pendingDragRegions = useRef<AsciiRegion[] | null>(null);
  const isFullImageOnly = baseCanvas.mode === 'full';

  // Render canvas frame whenever image, state, time, cursor, or splitWipe changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;

    const maxPreviewSide = 1280;
    const ratio = image.naturalWidth / image.naturalHeight;
    let targetW = image.naturalWidth;
    let targetH = image.naturalHeight;

    if (targetW > maxPreviewSide || targetH > maxPreviewSide) {
      if (ratio >= 1) {
        targetW = maxPreviewSide;
        targetH = Math.round(maxPreviewSide / ratio);
      } else {
        targetH = maxPreviewSide;
        targetW = Math.round(maxPreviewSide * ratio);
      }
    }

    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const scale = targetW / 1000;
    renderStudioFrame(ctx, image, previewState, {
      time,
      intent: renderIntent,
      animationEnabled,
      playbackSpeed,
      scale,
      showOriginalOnly,
      splitWipeX: splitCompareActive ? splitWipeX : null,
      cursor: cursorPos,
    });
  }, [
    image,
    previewState,
    renderIntent,
    animationEnabled,
    playbackSpeed,
    time,
    showOriginalOnly,
    splitCompareActive,
    splitWipeX,
    cursorPos,
    canvasRef,
    fontRevision,
  ]);

  // Hand tool is independent of playback (K). Never consume Space in a form or button.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || event.repeat || event.defaultPrevented) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input,textarea,select,button,a,[contenteditable="true"],[role="slider"],[role="dialog"]')) return;
      event.preventDefault();
      setIsSpacePressed(true);
    };
    const release = () => { setIsSpacePressed(false); setIsPanning(false); };
    const handleKeyUp = (event: KeyboardEvent) => { if (event.code === 'Space') release(); };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', release);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', release);
    };
  }, []);

  useEffect(() => { setViewMode('fit'); setPan({ x: 0, y: 0 }); }, [image]);

  const handleFitToScreen = useCallback(() => {
    setViewMode('fit');
    setPan({ x: 0, y: 0 });
  }, []);

  // Calculate normalized coordinates on photo accounting for zoom and pan via getBoundingClientRect
  const getNormalizedCoords = (clientX: number, clientY: number) => {
    const el = wrapperRef.current;
    if (!el) return { nx: 0, ny: 0 };
    const rect = el.getBoundingClientRect();
    const nx = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const ny = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    return { nx, ny };
  };

  const applySnapping = (
    x: number,
    y: number,
    w: number,
    h: number
  ): { x: number; y: number; guidesX: number[]; guidesY: number[] } => {
    let nextX = x;
    let nextY = y;
    const guidesX: number[] = [];
    const guidesY: number[] = [];

    const centerX = x + w * 0.5;
    const rightX = x + w;
    for (const sp of SNAP_POINTS) {
      if (Math.abs(x - sp) < SNAP_THRESHOLD) {
        nextX = sp;
        guidesX.push(sp);
      } else if (Math.abs(centerX - sp) < SNAP_THRESHOLD) {
        nextX = sp - w * 0.5;
        guidesX.push(sp);
      } else if (Math.abs(rightX - sp) < SNAP_THRESHOLD) {
        nextX = sp - w;
        guidesX.push(sp);
      }
    }

    const centerY = y + h * 0.5;
    const bottomY = y + h;
    for (const sp of SNAP_POINTS) {
      if (Math.abs(y - sp) < SNAP_THRESHOLD) {
        nextY = sp;
        guidesY.push(sp);
      } else if (Math.abs(centerY - sp) < SNAP_THRESHOLD) {
        nextY = sp - h * 0.5;
        guidesY.push(sp);
      } else if (Math.abs(bottomY - sp) < SNAP_THRESHOLD) {
        nextY = sp - h;
        guidesY.push(sp);
      }
    }

    return {
      x: Math.max(0, Math.min(1 - w, nextX)),
      y: Math.max(0, Math.min(1 - h, nextY)),
      guidesX,
      guidesY,
    };
  };

  // Scroll in / Scroll out wheel listener
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - (rect.left + rect.width / 2);
    const mouseY = e.clientY - (rect.top + rect.height / 2);

    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.88;
    const nextZoom = Math.max(
      0.15,
      Math.min(maxZoom, Number((zoom * zoomFactor).toFixed(3)))
    );

    const scaleDiff = nextZoom / zoom;
    setPan((prev) => ({
      x: mouseX - (mouseX - prev.x) * scaleDiff,
      y: mouseY - (mouseY - prev.y) * scaleDiff,
    }));
    setZoom(nextZoom);
  }, [zoom, maxZoom]);

  useEffect(() => {
    const stage = containerRef.current;
    stage?.addEventListener('wheel', handleWheel, { passive: false });
    return () => stage?.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // Stage container pointer down for background drag / panning
  const handleContainerPointerDown = (
    e: React.PointerEvent<HTMLElement>
  ) => {
    if (!(e.target as HTMLElement)?.closest('button,input,select,textarea,summary')) containerRef.current?.focus({ preventScroll: true });
    // Middle click and Space pan preserve the selected editing target.
    if (
      e.button === 1 ||
      isSpacePressed ||
      e.target === containerRef.current ||
      (e.target as HTMLElement)?.classList.contains('stage-viewport-grid')
    ) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      if (!isSpacePressed && e.button !== 1) onSelectRegion(null);
    }
  };

  // Global pointer move / up listeners during active drag or pan
  useEffect(() => {
    if (!dragMode && !isPanning) return;

    const handlePointerMove = (e: PointerEvent) => {
      if (isPanning) {
        setPan({
          x: e.clientX - panStart.x,
          y: e.clientY - panStart.y,
        });
        return;
      }

      if (!dragMode) return;
      const regions = pendingDragRegions.current ?? state.regions;
      const publish = (next: AsciiRegion[]) => { pendingDragRegions.current = next; onUpdateRegions(next, false); };
      const { nx, ny } = getNormalizedCoords(e.clientX, e.clientY);

      if (dragMode.type === 'move') {
        const dx = nx - dragMode.startX;
        const dy = ny - dragMode.startY;
        const target = regions.find((r) => r.id === dragMode.id);
        if (!target) return;

        const snapped = applySnapping(
          dragMode.origX + dx,
          dragMode.origY + dy,
          target.w,
          target.h
        );
        setSnapGuides({ x: snapped.guidesX, y: snapped.guidesY });

        const updated = regions.map((r) =>
          r.id === dragMode.id ? { ...r, x: snapped.x, y: snapped.y } : r
        );
        publish(updated);
      } else if (dragMode.type === 'resize') {
        const dx = nx - dragMode.startX;
        const dy = ny - dragMode.startY;
        let { x, y, w, h } = dragMode.orig;
        const minWidth = Math.min(1, 8 / (image?.naturalWidth ?? 1000));
        const minHeight = Math.min(1, 8 / (image?.naturalHeight ?? 1000));

        if (dragMode.handle.includes('e')) {
          w = Math.max(minWidth, Math.min(1 - x, w + dx));
        }
        if (dragMode.handle.includes('s')) {
          h = Math.max(minHeight, Math.min(1 - y, h + dy));
        }
        if (dragMode.handle.includes('w')) {
          const maxDelta = w - minWidth;
          const clampedDx = Math.max(-x, Math.min(maxDelta, dx));
          x += clampedDx;
          w -= clampedDx;
        }
        if (dragMode.handle.includes('n')) {
          const maxDelta = h - minHeight;
          const clampedDy = Math.max(-y, Math.min(maxDelta, dy));
          y += clampedDy;
          h -= clampedDy;
        }

        const updated = regions.map((r) =>
          r.id === dragMode.id ? { ...r, ...clampLayerGeometry({ x, y, w, h }, image?.naturalWidth, image?.naturalHeight) } : r
        );
        publish(updated);
      } else if (dragMode.type === 'create') {
        const clientDist = Math.hypot(
          e.clientX - dragMode.startClientX,
          e.clientY - dragMode.startClientY
        );

        // Require minimum dragging threshold (8px) before initializing new layer
        if (!dragMode.initialized && clientDist >= 8) {
          dragMode.initialized = true;
          const newRegion = {
            ...createStudioLayer(state, selectedRegionId, { x: dragMode.startX, y: dragMode.startY, w: 0.04, h: 0.04 }),
            id: dragMode.id,
          };
          publish([...regions, newRegion]);
          onSelectRegion(dragMode.id);
        }

        if (dragMode.initialized) {
          const x = Math.min(dragMode.startX, nx);
          const y = Math.min(dragMode.startY, ny);
          const w = Math.max(8 / (image?.naturalWidth ?? 1000), Math.abs(nx - dragMode.startX));
          const h = Math.max(8 / (image?.naturalHeight ?? 1000), Math.abs(ny - dragMode.startY));

          const updated = (pendingDragRegions.current ?? regions).map((r) =>
            r.id === dragMode.id ? { ...r, ...clampLayerGeometry({ x, y, w, h }, image?.naturalWidth, image?.naturalHeight) } : r
          );
          publish(updated);
        }
      }
    };

    const handlePointerUp = () => {
      if (isPanning) {
        setIsPanning(false);
        return;
      }
      const finalRegions = pendingDragRegions.current ?? state.regions;
      if (dragMode?.type === 'create') {
        if (!dragMode.initialized) {
          // Simple click on empty background deselects active layer (UX-06)
          onSelectRegion(null);
        } else {
          // Filter out accidental micro-layers
          const target = finalRegions.find((r) => r.id === dragMode.id);
          if (target && target.w < 0.03 && target.h < 0.03) {
            onUpdateRegions(
              finalRegions.filter((r) => r.id !== dragMode.id),
              true
            );
            onSelectRegion(null);
          } else {
            onUpdateRegions(finalRegions, true);
          }
        }
      } else {
        onUpdateRegions(finalRegions, true);
      }
      pendingDragRegions.current = null;
      setDragMode(null);
      setSnapGuides({ x: [], y: [] });
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [dragMode, isPanning, panStart, state, selectedRegionId, onUpdateRegions, image]);

  const handleStagePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    containerRef.current?.focus({ preventScroll: true });
    if (isSpacePressed || e.button === 1) {
      // Defer to pan
      handleContainerPointerDown(e);
      return;
    }
    if (e.button !== 0 || splitCompareActive || isFullImageOnly) return;
    const { nx, ny } = getNormalizedCoords(e.clientX, e.clientY);

    const newId = createStudioLayer(state, selectedRegionId).id;
    pendingDragRegions.current = null;
    setDragMode({
      type: 'create',
      id: newId,
      startX: nx,
      startY: ny,
      startClientX: e.clientX,
      startClientY: e.clientY,
      initialized: false,
    });
  };

  const handleRegionPointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    region: AsciiRegion
  ) => {
    if (isSpacePressed || e.button === 1) {
      handleContainerPointerDown(e);
      return;
    }
    e.stopPropagation();
    containerRef.current?.focus({ preventScroll: true });
    if (e.button !== 0 || splitCompareActive || isFullImageOnly) return;

    if (region.locked) {
      onSelectRegion(region.id);
      return;
    }

    const { nx, ny } = getNormalizedCoords(e.clientX, e.clientY);

    if (e.altKey) {
      const dupRegion = duplicateStudioLayer(region, state.regions, image?.naturalWidth, image?.naturalHeight);
      const dupId = dupRegion.id;
      pendingDragRegions.current = [...state.regions, dupRegion];
      onUpdateRegions(pendingDragRegions.current, false);
      onSelectRegion(dupId);
      setDragMode({
        type: 'move',
        id: dupId,
        startX: nx,
        startY: ny,
        origX: dupRegion.x,
        origY: dupRegion.y,
        duplicated: true,
      });
      return;
    }

    onSelectRegion(region.id);
    pendingDragRegions.current = null;
    setDragMode({
      type: 'move',
      id: region.id,
      startX: nx,
      startY: ny,
      origX: region.x,
      origY: region.y,
    });
  };

  const handleResizePointerDown = (
    e: React.PointerEvent<HTMLElement>,
    region: AsciiRegion,
    handle: 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'
  ) => {
    if (isSpacePressed || e.button === 1) {
      handleContainerPointerDown(e);
      return;
    }
    e.stopPropagation();
    if (e.button !== 0 || region.locked || isFullImageOnly) return;
    const { nx, ny } = getNormalizedCoords(e.clientX, e.clientY);
    onSelectRegion(region.id);
    pendingDragRegions.current = null;
    setDragMode({
      type: 'resize',
      id: region.id,
      handle,
      startX: nx,
      startY: ny,
      orig: { x: region.x, y: region.y, w: region.w, h: region.h },
    });
  };

  const selectedRegion =
    state.regions.find((r) => r.id === selectedRegionId) ?? null;

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      aria-label="Image canvas. Select a layer and use arrow keys to move it; Shift moves ten pixels. Hold Space to pan."
      data-studio-stage="true"
      onKeyDown={(event) => {
        if ((event.target as HTMLElement).closest('button,input,textarea,select,[role="slider"]')) return;
        if (!image || isFullImageOnly || !selectedRegion || selectedRegion.hidden || selectedRegion.locked) return;
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
        event.preventDefault(); event.stopPropagation();
        const regions = pendingKeyboardRegions.current ?? state.regions;
        const next = regions.map((region) => region.id === selectedRegion.id ? nudgeStudioLayer(region, event.key, image.naturalWidth, image.naturalHeight, event.shiftKey) : region);
        pendingKeyboardRegions.current = next;
        onUpdateRegions(next, false);
      }}
      onKeyUp={(event) => {
        if (event.key.startsWith('Arrow') && pendingKeyboardRegions.current) {
          onUpdateRegions(pendingKeyboardRegions.current, true);
          pendingKeyboardRegions.current = null;
        }
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null) && pendingKeyboardRegions.current) {
          onUpdateRegions(pendingKeyboardRegions.current, true);
          pendingKeyboardRegions.current = null;
        }
      }}
      onPointerDown={handleContainerPointerDown}
      className={`studio-stage relative flex flex-1 items-center justify-center overflow-hidden select-none ${
        isPanning
          ? 'cursor-grabbing'
          : isSpacePressed
          ? 'cursor-grab'
          : 'cursor-default'
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOverFile(true);
      }}
      onDragLeave={() => setIsDragOverFile(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOverFile(false);
        const file = e.dataTransfer.files?.[0];
        if (file && file.type.startsWith('image/')) {
          onImageDrop(file);
        }
      }}
    >
      {/* File Dropzone Overlay */}
      {isDragOverFile && (
        <div className="pointer-events-none absolute inset-4 z-50 flex flex-col items-center justify-center rounded-none border-2 border-dashed border-studio-highlight bg-studio-ink">
          <p className="font-mono text-sm font-semibold tracking-wider text-studio-highlight uppercase">
            Drop your photo to load into the studio
          </p>
          <p className="mt-1 text-sm text-studio-muted">
            JPG · PNG · WebP · 100% local client-side processing
          </p>
        </div>
      )}

      {/* Infinite Canvas Transform Layer */}
      <div
        className="relative flex items-center justify-center transition-transform duration-75 ease-out select-none"
        style={{
          transform: `translate3d(${pan.x}px, ${pan.y}px, 0px) scale(${zoom})`,
          transformOrigin: 'center center',
        }}
      >
        {/* Stage Container Matched to Image Aspect Ratio */}
        {image && (
          <div
            ref={wrapperRef}
            onPointerDown={(e) => {
              if (isSpacePressed || e.button === 1) return;
              e.stopPropagation();
              handleStagePointerDown(e);
            }}
            onPointerMove={(e) => {
              if (state.crt.cursorEffect !== 'off') {
                const { nx, ny } = getNormalizedCoords(e.clientX, e.clientY);
                setCursorPos({ x: nx, y: ny, active: true });
              }
            }}
            onPointerLeave={() => {
              if (cursorPos.active) {
                setCursorPos((prev) => ({ ...prev, active: false }));
              }
            }}
            className={`relative shrink-0 ring-1 ring-white/15 ${
              isSpacePressed || isPanning
                ? 'cursor-grab'
                : isFullImageOnly
                ? 'cursor-default'
                : 'cursor-crosshair'
            }`}
            style={{
              aspectRatio: `${image.naturalWidth} / ${image.naturalHeight}`,
              width: fitWidth,
            }}
          >
            {/* Main Rendered Canvas */}
            <canvas
              ref={canvasRef}
              role="img"
              aria-label="Your image with the current studio effects applied"
              className="block h-full w-full object-contain pointer-events-none"
            />

            {/* Interactive Before / After Split Wipe Slider */}
            {splitCompareActive && (
              <div
                className="absolute inset-0 z-40"
                onPointerDown={(e) => e.stopPropagation()}
              >
                <div className="pointer-events-none absolute left-3 top-3 rounded-none border border-studio-line bg-studio-ink px-2.5 py-0.5 font-mono text-sm font-medium text-studio-paper">
                  BEFORE (ORIGINAL)
                </div>
                <div className="pointer-events-none absolute right-3 top-3 rounded-none border border-studio-highlight/35 bg-studio-ink px-2.5 py-0.5 font-mono text-sm font-medium text-studio-highlight">
                  AFTER (SGNL STUDIO)
                </div>
                <div
                  className="pointer-events-none absolute top-1/2 z-10 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-none border border-white/70 bg-studio-ink font-mono text-sm text-studio-paper shadow-lg"
                  style={{ left: `${splitWipeX * 100}%` }}
                >
                  ⇔
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.005}
                  value={splitWipeX}
                  onChange={(e) => setSplitWipeX(parseFloat(e.target.value))}
                  aria-label="Before and after comparison"
                  className="absolute inset-x-0 bottom-3 mx-auto h-2 w-3/4 cursor-ew-resize opacity-80"
                />
              </div>
            )}

            {/* Smart Snap Alignment Guides */}
            {snapGuides.x.map((sx) => (
              <div
                key={`gx-${sx}`}
                className="pointer-events-none absolute inset-y-0 w-px bg-studio-highlight z-30"
                style={{ left: `${sx * 100}%` }}
              />
            ))}
            {snapGuides.y.map((sy) => (
              <div
                key={`gy-${sy}`}
                className="pointer-events-none absolute inset-x-0 h-px bg-studio-highlight z-30"
                style={{ top: `${sy * 100}%` }}
              />
            ))}

            {/* Layer Region Overlays (Interactive blocks in Layered / Hybrid modes) */}
            {!showOriginalOnly &&
              !splitCompareActive &&
              !isFullImageOnly &&
              state.regions.map((rgn) => {
                const isSelected = rgn.id === selectedRegionId;
                if (soloRegionId ? rgn.id !== soloRegionId : rgn.hidden) return null;

                const borderColor = isSelected
                  ? 'border-studio-highlight'
                  : 'border-studio-line hover:border-studio-line0';

                return (
                  <div
                    key={rgn.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`Select ${rgn.label}; arrow keys move the layer`}
                    aria-pressed={isSelected}
                    onFocus={() => onSelectRegion(rgn.id)}
                    onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); onSelectRegion(rgn.id); } }}
                    onPointerDown={(e) => handleRegionPointerDown(e, rgn)}
                    className={`absolute z-20 border select-none transition-shadow ${
                      rgn.shape === 'ellipse' ? 'rounded-full' : 'rounded-none'
                    } ${borderColor} ${
                      rgn.locked ? 'cursor-default' : 'cursor-move'
                    }`}
                    style={{
                      left: `${rgn.x * 100}%`,
                      top: `${rgn.y * 100}%`,
                      width: `${rgn.w * 100}%`,
                      height: `${rgn.h * 100}%`,
                    }}
                  >
                    {/* Region Metadata Badge */}
                    <div
                      className={`studio-region-label pointer-events-none absolute left-1 top-1 flex items-center gap-1 rounded-none bg-studio-ink px-1.5 py-0.5 font-mono text-sm tracking-wider uppercase ${
                        isSelected
                          ? 'border border-studio-highlight/50 text-studio-highlight'
                          : 'border border-studio-line text-studio-muted'
                      }`}
                    >
                      {rgn.locked && <Lock className="h-2.5 w-2.5" />}
                      <span>{rgn.label}</span>
                      <span className="text-studio-muted">·</span>
                      <span>{GLYPH_RAMPS[rgn.glyphFamily]?.shortLabel}</span>
                    </div>

                    {/* Resize Handles (8 Points) with Enhanced Ergonomic Hit-Area (UX-01) */}
                    {isSelected &&
                      !rgn.locked &&
                      (
                        ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const
                      ).map((handle) => {
                        const hitPosStyles: Record<string, string> = {
                          nw: 'top-0 left-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize',
                          n: 'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize',
                          ne: 'top-0 right-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize',
                          e: 'top-1/2 right-0 translate-x-1/2 -translate-y-1/2 cursor-ew-resize',
                          se: 'bottom-0 right-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize',
                          s: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 cursor-ns-resize',
                          sw: 'bottom-0 left-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize',
                          w: 'top-1/2 left-0 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize',
                        };
                        return (
                          <button
                            type="button"
                            tabIndex={-1}
                            aria-label={`Resize ${rgn.label} ${handle.toUpperCase()}. Position and size fields are available in Layers.`}
                            key={handle}
                            onPointerDown={(e) =>
                              handleResizePointerDown(e, rgn, handle)
                            }
                            className={`layer-resize-handle group absolute border-0 bg-transparent p-0 flex h-7 w-7 items-center justify-center select-none touch-none z-30 ${hitPosStyles[handle]}`}
                            title={`Resize ${handle.toUpperCase()}`}
                          >
                            <div className="h-3 w-3 rounded-none border border-studio-ink bg-studio-highlight shadow-sm transition-transform duration-150 group-hover:scale-125 group-active:scale-90 pointer-events-none" />
                          </button>
                        );
                      })}
                  </div>
                );
              })}

            {/* Contextual Floating HUD Above/Below Selected Region */}
            {!showOriginalOnly &&
              !splitCompareActive &&
              !isFullImageOnly &&
              selectedRegion &&
              (!selectedRegion.hidden || soloRegionId === selectedRegion.id) &&
              !dragMode && (
                <RegionFloatingHud
                  region={selectedRegion}
                  onEdit={onEditLayer}
                  onUpdate={(patch) => {
                    const updated = state.regions.map((r) =>
                      r.id === selectedRegion.id ? { ...r, ...patch } : r
                    );
                    onUpdateRegions(updated, true);
                  }}
                  onDuplicate={() => {
                    const dup = duplicateStudioLayer(selectedRegion, state.regions, image?.naturalWidth, image?.naturalHeight);
                    const dupId = dup.id;
                    onUpdateRegions([...state.regions, dup], true);
                    onSelectRegion(dupId);
                  }}
                  onDelete={() => {
                    const updated = state.regions.filter(
                      (r) => r.id !== selectedRegion.id
                    );
                    onUpdateRegions(updated, true);
                    onSelectRegion(null);
                  }}
                />
              )}
          </div>
        )}
      </div>

      {/* ==================== FLOATING INFINITE CANVAS CONTROLS ==================== */}
      <div className="studio-zoom pointer-events-auto absolute bottom-4 left-4 z-40 flex items-center gap-1.5 rounded-none border border-studio-line bg-studio-ink/90 p-1.5 font-mono text-sm text-studio-paper">
        <button
          type="button"
          onClick={() => {
            setZoom((z) => Math.max(0.15, Number((z / 1.2).toFixed(2))));
          }}
          className="flex h-7 w-7 items-center justify-center rounded-none border border-studio-line bg-studio-raised text-studio-paper hover:bg-studio-raised hover:text-studio-paper transition"
          title="Zoom Out (Scroll Down)"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={() => {
            setViewMode('actual');
            setPan({ x: 0, y: 0 });
          }}
          className="flex h-7 px-2.5 items-center justify-center rounded-none border border-studio-line bg-studio-raised font-semibold text-studio-highlight hover:bg-studio-raised transition"
          aria-label="View at 100% (actual source pixels)"
          title="100% · one source pixel per CSS pixel"
        >
          {Math.round((image ? fitWidth / image.naturalWidth : 1) * zoom * 100)}%
        </button>

        <button
          type="button"
          onClick={() => {
            setZoom((z) => Math.min(maxZoom, Number((z * 1.2).toFixed(2))));
          }}
          className="flex h-7 w-7 items-center justify-center rounded-none border border-studio-line bg-studio-raised text-studio-paper hover:bg-studio-raised hover:text-studio-paper transition"
          title="Zoom In (Scroll Up)"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>

        <div className="h-4 w-px bg-studio-raised mx-0.5" />

        <button
          type="button"
          onClick={handleFitToScreen}
          className="flex h-7 items-center gap-1.5 rounded-none border border-studio-line bg-studio-raised px-2.5 text-studio-paper hover:bg-studio-raised hover:text-studio-paper transition"
          aria-pressed={viewMode === 'fit'}
          title="Fit image to available stage"
        >
          <Maximize2 className="h-3.5 w-3.5" />
          <span>Fit</span>
        </button>

        <div className="hidden md:flex items-center pl-1 text-sm text-studio-muted">
          Scroll to zoom · Space + drag to pan
        </div>
      </div>
    </div>
  );
};

export default CanvasStage;
