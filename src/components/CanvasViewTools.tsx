import { Popover } from '@base-ui/react/popover';
import { Eye, X } from 'lucide-react';
import type { CursorHoverEffect, StudioState } from '../engine/types';
import { DEFAULT_BASE_CANVAS, GLYPH_RAMPS } from '../engine/types';
import { RangeControl } from './RangeControl';
import { StudioButtonLabel } from './StudioButtonLabel';
import { StudioSelect } from './controls/StudioSelect';
import { StudioSwitch } from './controls/StudioSwitch';

interface CanvasViewToolsProps {
  state: StudioState;
  showOriginal: boolean;
  splitCompare: boolean;
  onOriginalChange: (show: boolean) => void;
  onSplitChange: (show: boolean) => void;
  onUpdateState: (patch: Partial<StudioState>) => void;
}

const CURSORS: CursorHoverEffect[] = ['off', 'reveal', 'loupe', 'trail', 'repel', 'dissolve', 'water', 'vortex', 'magnetic', 'scatter'];

export function CanvasViewTools({ state, showOriginal, splitCompare, onOriginalChange, onSplitChange, onUpdateState }: CanvasViewToolsProps) {
  const base = {...DEFAULT_BASE_CANVAS, ...state.baseCanvas};
  const hasGlyphs = (base.mode !== 'blocks' && GLYPH_RAMPS[base.glyphFamily].group === 'Glyphs') ||
    (base.mode !== 'full' && state.regions.some(region => !region.hidden && GLYPH_RAMPS[region.glyphFamily].group === 'Glyphs'));
  const setCrt = (patch: Partial<StudioState['crt']>) => onUpdateState({ crt: { ...state.crt, ...patch } });

  return <Popover.Root>
    <Popover.Trigger className="studio-view-trigger"><Eye size={16} /><StudioButtonLabel>View</StudioButtonLabel></Popover.Trigger>
    <Popover.Portal>
      <Popover.Positioner className="studio-ui studio-control-positioner" align="end" sideOffset={8} collisionPadding={12}>
        <Popover.Popup className="studio-view-popup">
          <div className="studio-popup-heading"><Popover.Title>View tools</Popover.Title><Popover.Close aria-label="Close view tools"><X size={16} /></Popover.Close></div>
          <div className="studio-view-toggle"><span>Original photo</span><StudioSwitch label="Show original photo" checked={showOriginal} onCheckedChange={onOriginalChange} /></div>
          <div className="studio-view-toggle"><span>Split comparison</span><StudioSwitch label="Split comparison" checked={splitCompare} onCheckedChange={onSplitChange} /></div>
          <label className="inspector-field-label">Preview cursor</label>
          <StudioSelect label="Preview cursor" value={state.crt.cursorEffect} options={CURSORS.filter(cursor => cursor !== 'loupe' || hasGlyphs).map(value => ({ value, label: value === 'trail' ? 'Offset echo' : value[0].toUpperCase() + value.slice(1) }))} onValueChange={value => setCrt({ cursorEffect: value as CursorHoverEffect })} />
          {state.crt.cursorEffect !== 'off' && <div className="studio-view-parameters">
            <RangeControl id="hover-radius" label="Cursor radius" value={state.crt.hoverRadius ?? 18} min={5} max={50} unit="%" onChange={hoverRadius => setCrt({ hoverRadius })} />
            <RangeControl id="hover-strength" label="Cursor strength" value={state.crt.hoverStrength ?? 65} min={0} max={100} unit="%" onChange={hoverStrength => setCrt({ hoverStrength })} />
          </div>}
          <p>View helpers and cursor effects are preview only.</p>
        </Popover.Popup>
      </Popover.Positioner>
    </Popover.Portal>
  </Popover.Root>;
}
