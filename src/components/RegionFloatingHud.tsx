import React from 'react';
import { StudioButtonLabel } from './StudioButtonLabel';
import type { AsciiRegion } from '../engine/types';
import { Copy, Trash2, Lock, Unlock, SlidersHorizontal } from 'lucide-react';

interface RegionFloatingHudProps {
  region: AsciiRegion;
  onUpdate: (patch: Partial<AsciiRegion>) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onEdit?: () => void;
}

/** Fast layer actions only. All appearance controls live in the same complete inspector. */
export const RegionFloatingHud: React.FC<RegionFloatingHudProps> = ({ region, onUpdate, onDuplicate, onDelete, onEdit }) => {
  const bottom = region.y + region.h;
  const top = region.y >= 0.14 ? `calc(${region.y * 100}% - 54px)` : bottom <= 0.82 ? `calc(${bottom * 100}% + 10px)` : '12px';
  return <div className="floating-hud-enter layer-quick-actions pointer-events-auto absolute z-30" style={{ left: '50%', top, transform: 'translateX(-50%)' }} onPointerDown={(event) => event.stopPropagation()} role="toolbar" aria-label={`Quick actions for ${region.label}`}>
    {onEdit && <button type="button" onClick={onEdit} className="layer-quick-edit"><SlidersHorizontal size={16} /><span><StudioButtonLabel>Edit layer</StudioButtonLabel></span></button>}
    <button type="button" aria-pressed={Boolean(region.locked)} title={region.locked ? 'Unlock geometry' : 'Lock geometry'} aria-label={`${region.locked ? 'Unlock' : 'Lock'} ${region.label} geometry`} onClick={() => onUpdate({ locked: !region.locked })}>{region.locked ? <Lock size={16} /> : <Unlock size={16} />}</button>
    <button type="button" onClick={onDuplicate} title="Duplicate layer" aria-label={`Duplicate ${region.label}`}><Copy size={16} /></button>
    <button type="button" onClick={onDelete} title="Delete layer" aria-label={`Delete ${region.label}`}><Trash2 size={16} /></button>
  </div>;
};
