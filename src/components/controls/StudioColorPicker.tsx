import { useId } from "react";
import { Popover } from "@base-ui/react/popover";
import { HexColorInput, HexColorPicker } from "react-colorful";

interface StudioColorPickerProps {
  label: string;
  value: string;
  onChange: (color: string) => void;
}

const INKS = ["#c3ff35", "#b79aff", "#f4f4ec", "#050605", "#00ff66", "#ff3b7f"];

export function StudioColorPicker({
  label,
  value,
  onChange,
}: StudioColorPickerProps) {
  const inputId = useId();
  return (
    <Popover.Root>
      <Popover.Trigger
        className="studio-color-trigger"
        aria-label={`${label}: ${value}`}
      >
        <span className="color-chip" style={{ backgroundColor: value }} />
        <span>{label}</span>
        <span className="color-hex">{value}</span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          className="studio-control-positioner"
          sideOffset={8}
          collisionPadding={12}
        >
          <Popover.Popup className="studio-color-popup">
            <div className="color-popup-header">
              <Popover.Title>{label}</Popover.Title>
              <Popover.Close aria-label={`Close ${label} picker`}>
                ×
              </Popover.Close>
            </div>
            <HexColorPicker color={value} onChange={onChange} />
            <div className="color-hex-field">
              <label htmlFor={inputId}>HEX</label>
              <HexColorInput
                id={inputId}
                prefixed
                color={value}
                onChange={onChange}
              />
            </div>
            <div className="color-swatches" aria-label="Quick ink colors">
              {INKS.map((ink) => (
                <button
                  key={ink}
                  type="button"
                  style={{ backgroundColor: ink }}
                  aria-label={`Use ${ink}`}
                  aria-pressed={value.toLowerCase() === ink}
                  onClick={() => onChange(ink)}
                />
              ))}
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
