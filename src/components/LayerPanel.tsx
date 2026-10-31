import React from 'react';
import { Layers, Plus, Settings2 } from 'lucide-react';
import { LayerStack } from './LayerStack';
import { StudioButtonLabel } from './StudioButtonLabel';
import type { LayerStackProps } from './LayerStack';
import './layers.css';

export interface LayerPanelProps extends Pick<LayerStackProps,
  'state' | 'image' | 'selectedRegionId' | 'soloRegionId' | 'onSelectRegion' | 'onUpdateState' | 'onSoloChange' | 'onAddRegion'> {
  compositionSelected: boolean;
  onSelectComposition: () => void;
}

/** Structure stays visible independently of the appearance inspector and motion dock. */
export function LayerPanel({
  state, image, selectedRegionId, soloRegionId, onSelectRegion, onUpdateState,
  onSoloChange, onAddRegion, compositionSelected, onSelectComposition,
}: LayerPanelProps) {
  const addLayer = () => { onSoloChange(null); onAddRegion(); };
  return <aside className="studio-layer-panel" aria-label="Layers">
    <header className="studio-layer-panel-heading">
      <h2><Layers size={15} aria-hidden="true" />Layers <span>{state.regions.length}</span></h2>
      <button type="button" className="studio-layer-panel-add" onClick={addLayer}><Plus size={15} aria-hidden="true" /><span><StudioButtonLabel>Add layer</StudioButtonLabel></span></button>
    </header>
    <LayerStack
      state={state} image={image} selectedRegionId={selectedRegionId} soloRegionId={soloRegionId}
      onSelectRegion={onSelectRegion} onUpdateState={onUpdateState} onSoloChange={onSoloChange}
      onAddRegion={onAddRegion} embedded compositionSelected={compositionSelected}
    />
    <div className="studio-layer-panel-document">
      <button type="button" className="studio-composition-target" aria-pressed={compositionSelected} onClick={onSelectComposition}>
        <Settings2 size={18} aria-hidden="true" /><span><span><StudioButtonLabel>Composition</StudioButtonLabel></span><small>Global adjustments</small></span>
      </button>
    </div>

  </aside>;
}
