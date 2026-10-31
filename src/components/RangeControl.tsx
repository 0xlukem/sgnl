import React, { useEffect, useId, useRef, useState } from 'react';
import { Fader } from '@audio-ui/react/fader';
import { Knob } from '@audio-ui/react/knob';
import { RotateCcw } from 'lucide-react';
import { getControlResetValue } from '../engine/controlDefaults';
import { useParameterHistory } from './ParameterHistoryContext';

interface RangeControlProps {
  id?: string; label: string; value: number; min: number; max: number;
  step?: number; unit?: string; displayValue?: string; accentColor?: string;
  variant?: 'fader' | 'dial'; disabledReason?: string; resetValue?: number;
  onChange: (value: number) => void;
}
export const RangeControl: React.FC<RangeControlProps> = ({id: propId, label, value, min, max, step = 1, unit = '', displayValue, accentColor = 'var(--signal-acid)', variant = 'fader', disabledReason, resetValue, onChange}) => {
  const autoId = useId(), id = `${propId ?? 'parameter'}-${autoId}`;
  const history = useParameterHistory();
  const [editing, setEditing] = useState(false), [draft, setDraft] = useState('');
  const active = useRef(false), keyboard = useRef(false), timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelled = useRef(false);
  const cancelledGesture = useRef(false);
  const disabled = Boolean(disabledReason), formatted = displayValue ?? `${value}${unit}`;
  const neutral = getControlResetValue(propId, min, max, resetValue);
  const reasonId = `${id}-reason`, helpId = `${id}-help`;
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); if (active.current) { active.current = false; history.commit(); } }, [history]);
  const begin = () => { if (!active.current) { active.current = true; history.begin(); } };
  const commit = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; if (active.current) { active.current = false; history.commit(); } };
  const handleChange = (next: number, details: {cancel: () => void}) => { if(cancelledGesture.current) {details.cancel();return;} if (!disabled) { begin(); onChange(next); } };
  const handleCommitted = (_next: number, details: {reason: string}) => {
    if(cancelledGesture.current) {cancelledGesture.current=false;return;}
    if (keyboard.current) return;
    if (details.reason === 'wheel') { if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(commit, 250); }
    else queueMicrotask(commit);
  };
  const reset = () => { if (disabled) return; begin(); onChange(neutral); queueMicrotask(commit); };
  const openEditor = () => { setDraft(String(value)); cancelled.current = false; setEditing(true); };
  const confirm = () => {
    if (cancelled.current) return;
    const parsed = Number(draft);
    if (draft.trim() && Number.isFinite(parsed)) { begin(); onChange(Math.max(min, Math.min(max, Math.round(parsed / Math.min(step, 1)) * Math.min(step, 1)))); queueMicrotask(commit); }
    setEditing(false);
  };
  const keyCapture = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).hasAttribute('data-parameter-editor')) return;
    if (['Delete', 'Backspace'].includes(event.key)) { event.preventDefault(); event.stopPropagation(); reset(); }
    else if (event.key === 'Escape' && active.current) { event.preventDefault(); event.stopPropagation(); if (timer.current) clearTimeout(timer.current); active.current = false; cancelledGesture.current=!keyboard.current; keyboard.current = false; history.cancel(); }
    else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) { cancelledGesture.current=false; keyboard.current = true; begin(); }
  };
  const marks = Array.from({length: 9}, (_, i) => min + (max - min) * i / 8);
  const numeric = <div className="parameter-number-actions">
    {editing ? <input autoFocus data-parameter-editor type="number" aria-label={`${label}${unit ? ` (${unit})` : ''}`} aria-describedby={helpId} className="parameter-number-input" value={draft} min={min} max={max} step={Math.min(step, 1)} onChange={e => setDraft(e.target.value)} onBlur={confirm} onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); confirm(); } if (e.key === 'Escape') { e.preventDefault(); cancelled.current = true; setEditing(false); } }} /> : <button type="button" className="parameter-value" disabled={disabled} aria-label={`Edit ${label}: ${formatted}`} aria-describedby={disabled ? reasonId : helpId} title="Enter an exact value" onClick={openEditor}>{formatted}</button>}
    <button type="button" className="parameter-reset" aria-label={`Reset ${label} to ${neutral}${unit}`} title={`Reset to ${neutral}${unit}`} disabled={disabled || value === neutral} onClick={reset}><RotateCcw size={12} /></button>
  </div>;
  const common = {value, defaultValue: neutral, min, max, step: Math.min(step, 1), largeStep: Math.max(step, 10), disabled, onValueChange: handleChange, onValueCommitted: handleCommitted, style: {'--parameter-accent': accentColor} as React.CSSProperties};
  return <div className="parameter-interaction" data-parameter-interaction data-parameter-control data-control-id={propId} onPointerDownCapture={() => {cancelledGesture.current=false;}} onKeyDownCapture={keyCapture} onKeyUpCapture={() => { if (keyboard.current) { keyboard.current = false; queueMicrotask(commit); } }} onBlurCapture={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) { keyboard.current = false; commit(); } }} onWheelCapture={e => { if (!e.currentTarget.contains(document.activeElement)) e.stopPropagation(); }}>
    <span id={helpId} className="sr-only">Range {min} to {max}{unit}. Enter a value or adjust the slider. Reset returns to {neutral}{unit}.</span>
    {variant === 'dial' ? <Knob.Root {...common} className="studio-dial" dragMode="vertical">
      <Knob.Label id={id} className="parameter-label">{label}</Knob.Label>
      <Knob.Control className="dial-control" title={disabledReason ?? 'Drag vertically · Shift for fine adjustment'}>{marks.map(mark => <Knob.Mark key={mark} value={mark} className="dial-mark"><span /></Knob.Mark>)}<Knob.Track className="dial-track" strokeWidth={1.5} /><Knob.Indicator className="dial-indicator" strokeWidth={1.5} /><Knob.Thumb className="dial-thumb" aria-labelledby={id} getAriaValueText={() => formatted} aria-describedby={disabled ? reasonId : helpId}><span className="dial-needle" /></Knob.Thumb></Knob.Control>
      {numeric}
    </Knob.Root> : <Fader.Root {...common} className="studio-fader" orientation="horizontal">
      <div className="parameter-caption"><Fader.Label id={id} className="parameter-label">{label}</Fader.Label>{numeric}</div>
      <Fader.Control className="fader-control"><Fader.Track className="fader-track"><Fader.Indicator className="fader-indicator" />{marks.map(mark => <Fader.Mark key={mark} value={mark} className="fader-mark" />)}<Fader.Thumb className="fader-thumb" aria-labelledby={id} getAriaValueText={() => formatted} aria-describedby={disabled ? reasonId : helpId}><span /></Fader.Thumb></Fader.Track></Fader.Control>
      <div className="fader-endpoints" aria-hidden="true"><span>{min}{unit}</span><span>{max}{unit}</span></div>
    </Fader.Root>}
    {disabled && <p id={reasonId} className="parameter-disabled-reason">{disabledReason}</p>}
  </div>;
};
