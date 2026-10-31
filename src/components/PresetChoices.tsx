import { useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { StudioButtonLabel } from './StudioButtonLabel';
import './preset-choices.css';

export interface PresetChoice<Value extends string> {
  value: Value;
  label: string;
  preview: ReactNode;
  group?: string;
  description?: string;
}

interface PresetChoicesProps<Value extends string> {
  title: string;
  value: Value;
  options: PresetChoice<Value>[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (value: Value) => void;
  selectedPreview?: ReactNode;
  modified?: boolean;
  groupLabels?: Record<string, string>;
  className?: string;
}

/** Inline preset buttons keep the chosen preview visible when the gallery closes. */
export function PresetChoices<Value extends string>({
  title, value, options, open, onOpenChange, onChange, selectedPreview,
  modified = false, groupLabels = {}, className = '',
}: PresetChoicesProps<Value>) {
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selected = options.find(option => option.value === value) ?? options[0];
  const groups = [...new Set(options.flatMap(option => option.group ? [option.group] : []))];
  const [group, setGroup] = useState(selected?.group ?? groups[0] ?? '');
  const currentGroup = groups.includes(group) ? group : groups[0];
  const visible = groups.length ? options.filter(option => option.group === currentGroup) : options;
  const close = () => {
    onOpenChange(false);
    triggerRef.current?.focus({ preventScroll: true });
  };

  return <section
    className={`studio-preset-choices ${className}`}
    onKeyDown={event => {
      if (open && event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        close();
      }
    }}
  >
    <button
      ref={triggerRef}
      type="button"
      className="studio-preset-trigger"
      aria-expanded={open}
      aria-controls={`${id}-choices`}
      aria-label={`${title}: ${selected?.label ?? value}${modified ? ', modified' : ''}`}
      onClick={() => {
        if (!open) setGroup(selected?.group ?? groups[0] ?? '');
        onOpenChange(!open);
      }}
    >
      <span className="studio-preset-heading"><StudioButtonLabel>{title}</StudioButtonLabel>{modified && <small>Modified</small>}</span>
      <span className="studio-preset-current">
        <span className="studio-preset-preview" aria-hidden="true">{selectedPreview ?? selected?.preview}</span>
        <span className="studio-preset-name"><StudioButtonLabel>{selected?.label ?? value}</StudioButtonLabel></span>
      </span>
      <ChevronDown className="studio-preset-chevron" size={18} aria-hidden="true" />
    </button>
    {open && <div id={`${id}-choices`} className="studio-preset-gallery">
      {groups.length > 0 && <div className="studio-preset-tabs" role="tablist" aria-label={`${title} families`}>
        {groups.map((item, index) => <button
          type="button"
          role="tab"
          id={`${id}-tab-${index}`}
          aria-selected={currentGroup === item}
          aria-controls={`${id}-panel`}
          tabIndex={currentGroup === item ? 0 : -1}
          key={item}
          onClick={() => setGroup(item)}
          onKeyDown={event => {
            let next = index;
            if (event.key === 'ArrowRight') next = (index + 1) % groups.length;
            else if (event.key === 'ArrowLeft') next = (index + groups.length - 1) % groups.length;
            else if (event.key === 'Home') next = 0;
            else if (event.key === 'End') next = groups.length - 1;
            else return;
            event.preventDefault();
            setGroup(groups[next]);
            const tabs = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
            tabs?.[next]?.focus();
          }}
        ><StudioButtonLabel>{groupLabels[item] ?? item}</StudioButtonLabel></button>)}
      </div>}
      <div
        className="studio-preset-grid custom-scrollbar"
        id={groups.length ? `${id}-panel` : undefined}
        role={groups.length ? 'tabpanel' : 'group'}
        aria-labelledby={groups.length ? `${id}-tab-${groups.indexOf(currentGroup)}` : undefined}
        aria-label={groups.length ? undefined : `${title} presets`}
        tabIndex={groups.length ? 0 : undefined}
      >
        {visible.map(option => <button
          type="button"
          className="studio-preset-card"
          key={option.value}
          aria-pressed={value === option.value}
          title={option.description}
          onClick={() => { onChange(option.value); close(); }}
        >
          <span className="studio-preset-preview" aria-hidden="true">{option.preview}</span>
          <span className="studio-preset-name"><StudioButtonLabel>{option.label}</StudioButtonLabel></span>
          {value === option.value && <Check size={14} className="studio-preset-check" aria-hidden="true" />}
        </button>)}
      </div>
    </div>}
  </section>;
}

export function PaletteSwatches({ colors }: { colors: string[] }) {
  return <span className="studio-palette-swatches" aria-hidden="true">
    {colors.map((color, index) => <span key={`${color}-${index}`} style={{ backgroundColor: color }} />)}
  </span>;
}
