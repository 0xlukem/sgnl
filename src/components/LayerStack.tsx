import React, { memo, useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Copy, Eye, EyeOff, Focus, Image as ImageIcon, Lock, MoreHorizontal, Pencil, Plus, Scan, Trash2, Unlock } from 'lucide-react';
import type { AsciiRegion, StudioState } from '../engine/types';
import { DEFAULT_BASE_CANVAS, GLYPH_RAMPS } from '../engine/types';
import { renderStudioFrame } from '../engine/renderer';
import { clampLayerGeometry, duplicateStudioLayer, getSoloPreviewState, nextLayerName } from '../engine/layers';
import { StudioButtonLabel } from './StudioButtonLabel';
import './layers.css';

export interface LayerStackProps {
  state: StudioState;
  image: HTMLImageElement | null;
  selectedRegionId: string | null;
  soloRegionId: string | null;
  onSelectRegion: (id: string | null, revealProperties?: boolean) => void;
  onUpdateState: (patch: Partial<StudioState>, recordHistory?: boolean) => void;
  onAddRegion: () => void;
  onSoloChange: (id: string | null) => void;
  /** The persistent panel owns its heading and keeps the stack expanded. */
  embedded?: boolean;
  compositionSelected?: boolean;
}

const thumbnailCache = new WeakMap<HTMLImageElement, Map<string, ImageData>>();

const LayerThumbnail = memo(function LayerThumbnail({ image, state, region, fontRevision }: { image: HTMLImageElement | null; state: StudioState; region: AsciiRegion; fontRevision: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fontReady = !region.fontFamily || document.fonts.check(`600 12px "${region.fontFamily}"`);
  const signature = JSON.stringify([region, state.baseCanvas, state.grading, state.tracking, state.glitch, state.crt, state.randomSeed, fontReady, fontRevision]);
  useEffect(() => {
    if (!image || !canvasRef.current) return;
    let cache = thumbnailCache.get(image);
    if (!cache) { cache = new Map(); thumbnailCache.set(image, cache); }
    const target = canvasRef.current;
    const ctx = target.getContext('2d');
    if (!ctx) return;
    const cached = cache.get(signature);
    if (cached) { ctx.putImageData(cached, 0, 0); return; }
    // Debounce live fader updates. Thumbnails are static, never separate animation loops.
    const timer = window.setTimeout(() => {
      const work = document.createElement('canvas');
      const scale = 320 / Math.max(image.naturalWidth, image.naturalHeight);
      work.width = Math.max(1, Math.round(image.naturalWidth * scale));
      work.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const workCtx = work.getContext('2d');
      if (!workCtx) return;
      const isolated = getSoloPreviewState({ ...state, regions: [region] }, region.id);
      renderStudioFrame(workCtx, image, isolated, { time: 0, scale: work.width / 1000, intent: 'image' });
      const sx = Math.min(work.width - 1, Math.max(0, Math.floor(region.x * work.width)));
      const sy = Math.min(work.height - 1, Math.max(0, Math.floor(region.y * work.height)));
      const sw = Math.max(1, Math.min(work.width - sx, Math.round(region.w * work.width)));
      const sh = Math.max(1, Math.min(work.height - sy, Math.round(region.h * work.height)));
      const ratio = Math.min(target.width / sw, target.height / sh);
      const width = sw * ratio, height = sh * ratio;
      ctx.clearRect(0, 0, target.width, target.height);
      ctx.drawImage(work, sx, sy, sw, sh, (target.width - width) / 2, (target.height - height) / 2, width, height);
      try {
        cache.set(signature, ctx.getImageData(0, 0, target.width, target.height));
        if (cache.size > 100) cache.delete(cache.keys().next().value!);
      } catch { /* A cross-origin source can still be previewed without caching pixels. */ }
    }, 100);
    return () => window.clearTimeout(timer);
  }, [image, signature]);
  return <canvas ref={canvasRef} width={64} height={48} className="layer-thumbnail" aria-hidden="true" />;
});

function GeometryField({ label, value, max, disabled, onCommit }: { label: string; value: number; max: number; disabled: boolean; onCommit: (value: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  const cancelled = useRef(false);
  useEffect(() => setDraft(String(value)), [value]);
  return <label className="layer-geometry-field"><span>{label} <small>px</small></span><input
    type="number" aria-label={`Layer ${label} in source pixels`} min={0} max={max} step={1} value={draft} disabled={disabled}
    onChange={(event) => setDraft(event.target.value)}
    onBlur={() => {
      if (cancelled.current) { cancelled.current = false; return; }
      const next = Number(draft);
      if (draft.trim() && Number.isFinite(next) && next !== value) onCommit(next);
      else setDraft(String(value));
    }}
    onKeyDown={(event) => {
      event.stopPropagation();
      if (event.key === 'Enter') event.currentTarget.blur();
      if (event.key === 'Escape') { cancelled.current = true; setDraft(String(value)); event.currentTarget.blur(); }
    }}
  /></label>;
}

export const LayerStack: React.FC<LayerStackProps> = ({ state, image, selectedRegionId, soloRegionId, onSelectRegion, onUpdateState, onAddRegion, onSoloChange, embedded = false, compositionSelected = false }) => {
  const stackRef = useRef<HTMLElement>(null);
  const bodyId = useId();
  const [expanded, setExpanded] = useState(true);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const cancelRename = useRef(false);
  const geometryRef = useRef<HTMLDetailsElement>(null);
  const [fontRevision, setFontRevision] = useState(0);
  useEffect(() => {
    const refresh = () => setFontRevision((revision) => revision + 1);
    document.fonts.addEventListener('loadingdone', refresh);
    return () => document.fonts.removeEventListener('loadingdone', refresh);
  }, []);
  useEffect(() => {
    const dismissMenus = (event: PointerEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent && event.key !== 'Escape') return;
      if (event instanceof PointerEvent && (event.target as HTMLElement)?.closest('.layer-stack-menu')) return;
      stackRef.current?.querySelectorAll<HTMLDetailsElement>('.layer-stack-menu[open]').forEach((menu) => {
        menu.open = false;
        if (event instanceof KeyboardEvent) menu.querySelector<HTMLElement>('summary')?.focus();
      });
    };
    document.addEventListener('pointerdown', dismissMenus);
    document.addEventListener('keydown', dismissMenus);
    return () => { document.removeEventListener('pointerdown', dismissMenus); document.removeEventListener('keydown', dismissMenus); };
  }, []);
  const selected = !compositionSelected ? state.regions.find((region) => region.id === selectedRegionId) ?? null : null;
  const base = state.baseCanvas ?? DEFAULT_BASE_CANVAS;
  const width = image?.naturalWidth ?? 1000, height = image?.naturalHeight ?? 1000;
  const selectedUnavailable = Boolean(selected?.hidden || base.mode === 'full');
  const update = (id: string, patch: Partial<AsciiRegion>) => onUpdateState({ regions: state.regions.map((region) => region.id === id ? { ...region, ...patch } : region) });
  const select = (id: string | null, revealProperties = true) => { onSelectRegion(id, revealProperties); if (soloRegionId) onSoloChange(id); };
  const rename = (region: AsciiRegion) => { setRenamingId(region.id); setNameDraft(region.label); };
  const finishRename = (region: AsciiRegion) => {
    if (cancelRename.current) { cancelRename.current = false; setRenamingId(null); return; }
    let name = nameDraft.trim().slice(0, 60);
    if (name && name !== region.label) {
      if (state.regions.some((other) => other.id !== region.id && other.label === name)) name = nextLayerName(state.regions, name);
      update(region.id, { label: name });
    }
    setRenamingId(null);
  };
  const duplicate = (region: AsciiRegion) => {
    const next = duplicateStudioLayer(region, state.regions, width, height);
    onUpdateState({ regions: [...state.regions, next] }); select(next.id, false);
  };
  const remove = (region: AsciiRegion) => {
    onUpdateState({ regions: state.regions.filter((item) => item.id !== region.id) });
    if (selectedRegionId === region.id) onSelectRegion(null, false);
    if (soloRegionId === region.id) onSoloChange(null);
  };
  const move = (region: AsciiRegion, direction: -1 | 1) => {
    const index = state.regions.findIndex((item) => item.id === region.id), target = index + direction;
    if (target < 0 || target >= state.regions.length) return;
    const next = [...state.regions]; next.splice(index, 1); next.splice(target, 0, region); onUpdateState({ regions: next });
  };
  const updateGeometry = (field: 'x' | 'y' | 'w' | 'h', value: number) => {
    if (!selected || selected.locked || selectedUnavailable) return;
    const geometry = clampLayerGeometry({ x: selected.x, y: selected.y, w: selected.w, h: selected.h, [field]: value / (field === 'x' || field === 'w' ? width : height) }, width, height);
    update(selected.id, geometry);
  };
  const closeMenu = (event: React.MouseEvent<HTMLButtonElement>) => { const details = event.currentTarget.closest('details'); if (details) details.open = false; };
  return <section ref={stackRef} className={`layer-stack${embedded ? ' layer-stack--embedded' : ''}`} aria-label="Layer stack">
    {!embedded && <div className="layer-stack-heading">
      <button type="button" className="layer-stack-disclosure" aria-expanded={expanded} aria-controls={bodyId} onClick={() => setExpanded(!expanded)}><ChevronDown size={16} className={expanded ? '' : 'collapsed'} /><span><StudioButtonLabel>Layers</StudioButtonLabel> <small>({state.regions.length})</small></span></button>
      <button type="button" className="layer-stack-add" onClick={() => { setExpanded(true); onSoloChange(null); onAddRegion(); }}><Plus size={16} /><span><StudioButtonLabel>Add layer</StudioButtonLabel></span></button>
    </div>}
    {soloRegionId && <div className="layer-solo-note" role="status"><span>Solo preview · saved visibility is unchanged</span><button type="button" onClick={() => onSoloChange(null)}><StudioButtonLabel>Exit Solo</StudioButtonLabel></button></div>}
    {(embedded || expanded) && <div id={bodyId} className="layer-stack-body">
      <div className="layer-stack-list custom-scrollbar" role="group" aria-label="Layer stack, front to back" style={{ '--layer-count': state.regions.length } as React.CSSProperties}>
        {!state.regions.length && <p className="layer-stack-empty">Add a layer to apply a style to part of your image.</p>}
        {[...state.regions].reverse().map((region) => {
          const index = state.regions.findIndex((item) => item.id === region.id), active = !compositionSelected && selectedRegionId === region.id;
          return <div key={region.id} className={`layer-stack-row ${active ? 'is-selected' : ''} ${region.hidden ? 'is-hidden' : ''}`}>
            <button type="button" className="layer-stack-preview" aria-label={`Select ${region.label}`} aria-pressed={active} onClick={() => select(region.id)}><LayerThumbnail image={image} state={state} region={region} fontRevision={fontRevision} /></button>
            <div className="layer-stack-name">
              {renamingId === region.id ? <input autoFocus aria-label={`Rename ${region.label}`} maxLength={60} value={nameDraft} onChange={(event) => setNameDraft(event.target.value)} onBlur={() => finishRename(region)} onKeyDown={(event) => { event.stopPropagation(); if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') { cancelRename.current = true; event.currentTarget.blur(); } }} /> : <button type="button" aria-pressed={active} onClick={() => select(region.id)} onDoubleClick={() => rename(region)} title={`Edit ${region.label}`}><span><StudioButtonLabel>{region.label}</StudioButtonLabel>{region.locked && <Lock size={11} aria-label="Geometry locked" />}</span><small>{GLYPH_RAMPS[region.glyphFamily]?.shortLabel ?? GLYPH_RAMPS[region.glyphFamily]?.name}</small></button>}
            </div>
            <button type="button" className="layer-stack-icon" aria-label={`${region.hidden ? 'Show' : 'Hide'} ${region.label}`} title={region.hidden ? 'Show layer' : 'Hide layer'} aria-pressed={Boolean(region.hidden)} onClick={() => { if (soloRegionId === region.id) onSoloChange(null); update(region.id, { hidden: !region.hidden }); }}>{region.hidden ? <EyeOff size={16} /> : <Eye size={16} />}</button>
            <button type="button" className="layer-stack-icon" aria-label={`Solo ${region.label}`} title="Temporarily isolate layer" aria-pressed={soloRegionId === region.id} onClick={() => { onSelectRegion(region.id, false); onSoloChange(soloRegionId === region.id ? null : region.id); }}><Focus size={16} /></button>
            <details className="layer-stack-menu" onToggle={(event) => {
              const menu = event.currentTarget;
              if (!menu.open) return;
              stackRef.current?.querySelectorAll<HTMLDetailsElement>('.layer-stack-menu[open]').forEach((other) => { if (other !== menu) other.open = false; });
              const popup = menu.querySelector<HTMLElement>('.layer-stack-menu-items');
              if (!popup) return;
              const rect = menu.getBoundingClientRect();
              popup.style.top = `${Math.max(12, Math.min(rect.bottom + 4, window.innerHeight - popup.offsetHeight - 12))}px`;
              popup.style.left = `${Math.max(12, Math.min(rect.right - 210, window.innerWidth - 222))}px`;
            }}><summary aria-label={`More actions for ${region.label}`} title="Layer actions"><MoreHorizontal size={17} /></summary><div className="layer-stack-menu-items">
              <button type="button" onClick={(event) => { closeMenu(event); rename(region); }}><Pencil size={16} /><StudioButtonLabel>Rename</StudioButtonLabel></button>
              <button type="button" onClick={(event) => { closeMenu(event); duplicate(region); }}><Copy size={16} /><StudioButtonLabel>Duplicate</StudioButtonLabel></button>
              <button type="button" onClick={(event) => { closeMenu(event); select(region.id, false); window.requestAnimationFrame(() => { if (geometryRef.current) { geometryRef.current.open = true; geometryRef.current.querySelector<HTMLInputElement>('input:not(:disabled)')?.focus(); } }); }}><Scan size={16} /><StudioButtonLabel>Position &amp; size</StudioButtonLabel></button>
              <button type="button" aria-pressed={Boolean(region.locked)} onClick={(event) => { closeMenu(event); update(region.id, { locked: !region.locked }); }}>{region.locked ? <Unlock size={16} /> : <Lock size={16} />}<StudioButtonLabel>{region.locked ? 'Unlock geometry' : 'Lock geometry'}</StudioButtonLabel></button>
              <button type="button" disabled={index === state.regions.length - 1} onClick={(event) => { closeMenu(event); move(region, 1); }}><ChevronUp size={16} /><StudioButtonLabel>Bring forward</StudioButtonLabel></button>
              <button type="button" disabled={index === 0} onClick={(event) => { closeMenu(event); move(region, -1); }}><ChevronDown size={16} /><StudioButtonLabel>Send backward</StudioButtonLabel></button>
              <button type="button" className="layer-stack-delete" onClick={(event) => { closeMenu(event); remove(region); }}><Trash2 size={16} /><StudioButtonLabel>Delete layer</StudioButtonLabel></button>
            </div></details>
          </div>;
        })}
      </div>
      <button type="button" className="layer-stack-base" aria-pressed={!compositionSelected && selectedRegionId === null} onClick={() => select(null)}><span className="layer-base-preview">{image ? <img src={image.currentSrc || image.src} alt="" /> : <ImageIcon size={18} />}</span><span className="layer-base-name"><span><StudioButtonLabel>Base</StudioButtonLabel></span><small>{base.mode === 'blocks' ? 'Hidden · Layered mode' : 'Full canvas'}</small></span></button>
      {base.mode === 'full' && state.regions.length > 0 && <p className="layer-stack-help">Layers are hidden in Full Frame. <button type="button" onClick={() => onUpdateState({ baseCanvas: { ...base, mode: 'hybrid' } })}><StudioButtonLabel>Use Hybrid</StudioButtonLabel></button> to edit them.</p>}
      {selected && <details ref={geometryRef} className="layer-geometry"><summary><StudioButtonLabel>Position &amp; size</StudioButtonLabel></summary>
        {(selected.locked || selectedUnavailable) && <p className="layer-stack-help">{selected.locked ? 'Geometry is locked. Style remains editable.' : selected.hidden ? 'This layer is hidden.' : 'Layers are hidden in Full Frame.'} {selected.hidden && <button type="button" onClick={() => update(selected.id, { hidden: false })}><StudioButtonLabel>Show &amp; edit</StudioButtonLabel></button>}</p>}
        <div className="layer-geometry-fields">
          <GeometryField label="X" value={Math.round(selected.x * width)} max={width} disabled={Boolean(selected.locked || selectedUnavailable)} onCommit={(value) => updateGeometry('x', value)} />
          <GeometryField label="Y" value={Math.round(selected.y * height)} max={height} disabled={Boolean(selected.locked || selectedUnavailable)} onCommit={(value) => updateGeometry('y', value)} />
          <GeometryField label="Width" value={Math.round(selected.w * width)} max={width} disabled={Boolean(selected.locked || selectedUnavailable)} onCommit={(value) => updateGeometry('w', value)} />
          <GeometryField label="Height" value={Math.round(selected.h * height)} max={height} disabled={Boolean(selected.locked || selectedUnavailable)} onCommit={(value) => updateGeometry('h', value)} />
        </div><p className="layer-stack-help">Focus the layer on canvas: arrow keys move 1 px; Shift + arrow moves 10 px.</p>
      </details>}
    </div>}
  </section>;
};
