import { Select } from "@base-ui/react/select";
import { Check, ChevronDown } from "lucide-react";

interface StudioSelectProps {
  label: string;
  value: string;
  options: { value: string; label: string; group?: string }[];
  onValueChange: (value: string) => void;
  className?: string;
}

export function StudioSelect({
  label,
  value,
  options,
  onValueChange,
  className = "",
}: StudioSelectProps) {
  const groups = [...new Set(options.map((option) => option.group ?? ""))];
  return (
    <Select.Root
      value={value}
      items={options}
      onValueChange={(next) => {
        if (next !== null) onValueChange(next);
      }}
    >
      <Select.Trigger
        className={`studio-select ${className}`}
        aria-label={label}
      >
        <Select.Value />
        <Select.Icon>
          <ChevronDown size={14} />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner
          className="studio-control-positioner"
          sideOffset={6}
          alignItemWithTrigger={false}
        >
          <Select.Popup className="studio-select-popup">
            <div className="control-popup-label">{label}</div>
            <Select.List className="studio-select-list">
              {groups.map((group) => (
                <Select.Group key={group}>
                  {group && (
                    <Select.GroupLabel className="control-popup-label">
                      {group}
                    </Select.GroupLabel>
                  )}
                  {options
                    .filter((option) => (option.group ?? "") === group)
                    .map((option) => (
                      <Select.Item
                        className="studio-select-option"
                        key={option.value}
                        value={option.value}
                      >
                        <Select.ItemText>{option.label}</Select.ItemText>
                        <Select.ItemIndicator>
                          <Check size={14} />
                        </Select.ItemIndicator>
                      </Select.Item>
                    ))}
                </Select.Group>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}
