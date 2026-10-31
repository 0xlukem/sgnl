import React from 'react';
import { ArrowUpRight, Circle, Plus, Settings2 } from 'lucide-react';
import type { AnimationSettings, SourceWarpMode, StillMotionMode, StudioState } from '../engine/types';
import { RangeControl } from './RangeControl';
import { StudioButtonLabel } from './StudioButtonLabel';
import { StudioSelect } from './controls/StudioSelect';
import { StudioSwitch } from './controls/StudioSwitch';
import './motion-dock.css';

export interface MotionDockProps {
  state: StudioState;
  panel: MotionPanel;
  onPanelChange: (panel: MotionPanel) => void;
  onUpdateState: (patch: Partial<StudioState>, recordHistory?: boolean) => void;
  onFocusAppearance: (section: string, reveal?: boolean) => void;
  children?: React.ReactNode;
}

export type MotionPanel = 'playback' | 'photo' | 'deformation' | 'tracking' | 'glitch' | 'textures';
type TemporalChannel = keyof NonNullable<AnimationSettings['channels']>;

const PANELS: { value: MotionPanel; label: string }[] = [
  { value: 'playback', label: 'Playback' },
  { value: 'photo', label: 'Image motion' },
  { value: 'deformation', label: 'Deformation' },
  { value: 'tracking', label: 'VHS motion' },
  { value: 'glitch', label: 'Glitch variation' },
  { value: 'textures', label: 'Texture variation' },
];
const MOTIONS: { value: StillMotionMode; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'relight', label: 'Relight' },
  { value: 'sheen', label: 'Sheen' },
  { value: 'glow', label: 'Glow' },
  { value: 'shimmer', label: 'Shimmer' },
  { value: 'parallax', label: 'Parallax' },
  { value: 'push', label: 'Push' },
  { value: 'focus', label: 'Edge pulse' },
  { value: 'mist', label: 'Mist' },
];
const TEMPORAL_WARPS: SourceWarpMode[] = ['ripple', 'wave', 'swirl'];

export function MotionDock({ state, panel, onPanelChange: setPanel, onUpdateState, onFocusAppearance, children }: MotionDockProps) {
  const animation: AnimationSettings = { enabled: true, playbackSpeed: 1, ...state.animation };
  const temporalWarp = TEMPORAL_WARPS.includes(state.grading.warpMode ?? 'off');
  const configured: Record<MotionPanel, boolean> = {
    playback: true,
    photo: (state.crt.motionMode ?? 'off') !== 'off',
    deformation: temporalWarp,
    tracking: state.tracking.enabled,
    glitch: state.glitch.enabled && [state.glitch.sliceFrequency, state.glitch.maxDisplacement, state.glitch.rgbSplit, state.glitch.databendChunks].some(value => value > 0),
    textures: state.crt.filmGrain > 0 || (state.crt.dustSpec ?? 0) > 0,
  };
  const channelFor = (target: MotionPanel): TemporalChannel | null => target === 'deformation' ? 'distortion' : ['tracking', 'glitch', 'textures'].includes(target) ? target as TemporalChannel : null;
  const channelEnabled = (target: MotionPanel) => {
    const channel = channelFor(target);
    return configured[target] && (!channel || animation.channels?.[channel] !== false);
  };
  const setAnimation = (patch: Partial<AnimationSettings>) => onUpdateState({ animation: { ...animation, ...patch } });
  const setChannel = (channel: TemporalChannel, enabled: boolean) => setAnimation({ channels: { ...animation.channels, [channel]: enabled } });
  const setCrt = (patch: Partial<StudioState['crt']>) => onUpdateState({ crt: { ...state.crt, ...patch } });
  const setTracking = (patch: Partial<StudioState['tracking']>) => onUpdateState({ tracking: { ...state.tracking, ...patch } });
  const range = (id: string, label: string, value: number, min: number, max: number, onChange: (value: number) => void, disabledReason?: string) => (
    <RangeControl id={id} label={label} value={value} min={min} max={max} unit="%" onChange={onChange} disabledReason={disabledReason} />
  );
  const enableChannel = (target: MotionPanel, warp?: SourceWarpMode) => {
    const channel = channelFor(target);
    const patch: Partial<StudioState> = {
      animation: { ...animation, enabled: true, channels: { ...animation.channels, ...(channel ? { [channel]: true } : {}) } },
    };
    if (target === 'photo') patch.crt = { ...state.crt, motionMode: state.crt.motionMode && state.crt.motionMode !== 'off' ? state.crt.motionMode : 'relight', motionAmount: state.crt.motionAmount || 50 };
    if (target === 'deformation') patch.grading = { ...state.grading, warpMode: warp ?? (temporalWarp ? state.grading.warpMode : 'ripple'), warpIntensity: state.grading.warpIntensity || 35 };
    if (target === 'tracking') patch.tracking = { ...state.tracking, enabled: true, autoRoll: true, intensity: state.tracking.intensity || 35 };
    if (target === 'glitch') patch.glitch = { ...state.glitch, enabled: true, sliceFrequency: state.glitch.sliceFrequency || 20, maxDisplacement: state.glitch.maxDisplacement || 20 };
    if (target === 'textures' && !configured.textures) patch.crt = { ...state.crt, filmGrain: 20 };
    // The appearance prerequisite and its temporal channel form one undo entry.
    onUpdateState(patch);
    setPanel(target);
    if (['deformation', 'tracking', 'glitch', 'textures'].includes(target)) onFocusAppearance(target, false);
  };
  const openPanel = (target: MotionPanel) => configured[target] ? setPanel(target) : enableChannel(target);
  const appearanceLink = (section: string, label: string) => <button type="button" className="motion-appearance-link" onClick={() => onFocusAppearance(section, true)}><StudioButtonLabel>{label}</StudioButtonLabel><ArrowUpRight size={14} /></button>;
  const sharedRateLink = <button type="button" className="motion-appearance-link" onClick={() => setPanel('playback')}><StudioButtonLabel>Shared motion & deformation rate</StudioButtonLabel><ArrowUpRight size={14} /></button>;

  return <section id="studio-motion-dock" className="motion-dock" aria-label="Composition motion">
    <header className="motion-dock-heading">
      <h2>Composition <span>Global</span></h2>
      <div className="motion-dock-actions"><span>Enable motion</span><StudioSwitch label="Enable animation" checked={animation.enabled} onCheckedChange={enabled => setAnimation({ enabled })} /></div>
    </header>
    {children && <div className="motion-dock-transport">{children}</div>}
    <div className="motion-dock-body">
      <nav className="motion-channel-list custom-scrollbar" aria-label="Motion channels">
        {PANELS.map(({ value, label }) => <button type="button" key={value} className="motion-channel" aria-pressed={panel === value} aria-label={!configured[value] ? `Add ${label}` : `${label} settings`} onClick={() => openPanel(value)}>
          {value === 'playback' ? <Settings2 size={13} /> : !configured[value] ? <Plus size={13} /> : <Circle size={8} className={animation.enabled && channelEnabled(value) ? 'motion-channel-on' : 'motion-channel-off'} />}
          <span><StudioButtonLabel>{label}</StudioButtonLabel></span>
        </button>)}
      </nav>
      <div key={panel} className="motion-channel-properties custom-scrollbar" aria-label={`${PANELS.find(item => item.value === panel)?.label} controls`}>
        {panel === 'playback' ? <>
          <div className="motion-parameter-grid">
            {range('playback-speed', 'Overall playback speed', Math.round(animation.playbackSpeed * 100), 10, 300, value => setAnimation({ playbackSpeed: value / 100 }))}
            {range('motion-speed', 'Motion & deformation rate', state.crt.motionSpeed ?? 100, 10, 300, value => setCrt({ motionSpeed: value }))}
          </div>
          <p className="motion-control-note">Motion & deformation share one rate. Other channels follow overall playback speed.</p>
        </> : panel === 'photo' ? <>
          <div className="motion-channel-heading"><h3>Image motion</h3>{sharedRateLink}</div>
          <div className="motion-parameter-grid">
            <div className="motion-select-field"><span>Movement</span><StudioSelect label="Photo motion mode" value={state.crt.motionMode ?? 'off'} options={MOTIONS} onValueChange={value => setCrt({ motionMode: value as StillMotionMode })} /></div>
            {range('motion-amount', 'Motion intensity', state.crt.motionAmount ?? 50, 0, 100, value => setCrt({ motionAmount: value }), !configured.photo ? 'Choose a movement to adjust its intensity.' : undefined)}
          </div>
        </> : panel === 'deformation' ? <>
          <div className="motion-channel-heading"><h3>Deformation</h3><StudioSwitch label="Animate deformation" checked={temporalWarp && animation.channels?.distortion !== false} onCheckedChange={enabled => enabled && !temporalWarp ? enableChannel('deformation') : setChannel('distortion', enabled)} /></div>
          <div className="motion-parameter-grid">
            <div className="motion-select-field"><span>Animated shape</span><StudioSelect label="Animated deformation" value={temporalWarp ? state.grading.warpMode! : 'off'} options={[...(!temporalWarp ? [{ value: 'off', label: 'Choose a shape' }] : []), ...TEMPORAL_WARPS.map(value => ({ value, label: value[0].toUpperCase() + value.slice(1) }))]} onValueChange={value => value === 'off' ? setChannel('distortion', false) : enableChannel('deformation', value as SourceWarpMode)} /></div>
            <div className="motion-link-bank">{sharedRateLink}{appearanceLink('deformation', 'Shape appearance')}</div>
          </div>
        </> : panel === 'tracking' ? <>
          <div className="motion-channel-heading"><h3>VHS motion</h3><div className="motion-switch-field"><span>Animate VHS</span><StudioSwitch label="Animate VHS" checked={state.tracking.enabled && animation.channels?.tracking !== false} onCheckedChange={enabled => enabled && !state.tracking.enabled ? enableChannel('tracking') : setChannel('tracking', enabled)} /></div></div>
          {configured.tracking ? <>
            <div className="motion-parameter-grid">
              {range('trk-jitter', 'Horizontal jitter', state.tracking.lineJitter, 0, 100, value => setTracking({ lineJitter: value }))}
              {range('trk-dropouts', 'Magnetic dropouts', state.tracking.dropouts, 0, 100, value => setTracking({ dropouts: value }))}
            </div>
            <div className="motion-channel-footer"><div className="motion-switch-field"><span>Continuous band sweep</span><StudioSwitch label="Continuous band sweep" checked={state.tracking.autoRoll} onCheckedChange={autoRoll => setTracking({ autoRoll })} /></div>{appearanceLink('tracking', 'VHS appearance')}</div>
          </> : <button type="button" className="motion-add-effect" onClick={() => enableChannel('tracking')}><Plus size={14} /><StudioButtonLabel>Add VHS motion</StudioButtonLabel></button>}
        </> : panel === 'glitch' ? <>
          <div className="motion-channel-heading"><h3>Glitch variation</h3><StudioSwitch label="Animate glitch" checked={configured.glitch && animation.channels?.glitch !== false} onCheckedChange={enabled => enabled && !configured.glitch ? enableChannel('glitch') : setChannel('glitch', enabled)} /></div>
          {configured.glitch ? <><p className="motion-control-note">Varies the existing glitch pattern over time.</p>{appearanceLink('glitch', 'Glitch appearance')}</> : <button type="button" className="motion-add-effect" onClick={() => enableChannel('glitch')}><Plus size={14} /><StudioButtonLabel>Add glitch variation</StudioButtonLabel></button>}
        </> : <>
          <div className="motion-channel-heading"><h3>Texture variation</h3><StudioSwitch label="Animate textures" checked={configured.textures && animation.channels?.textures !== false} onCheckedChange={enabled => enabled && !configured.textures ? enableChannel('textures') : setChannel('textures', enabled)} /></div>
          {configured.textures ? <><p className="motion-control-note">Varies grain and dust over time. Turn off to keep them fixed.</p>{appearanceLink('textures', 'Texture appearance')}</> : <button type="button" className="motion-add-effect" onClick={() => enableChannel('textures')}><Plus size={14} /><StudioButtonLabel>Add grain variation</StudioButtonLabel></button>}
        </>}
      </div>
    </div>
  </section>;
}
