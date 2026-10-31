import { Switch } from "@animate-ui/react/primitives/base-ui/switch";

interface StudioSwitchProps {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export function StudioSwitch({
  label,
  checked,
  onCheckedChange,
}: StudioSwitchProps) {
  return (
    <Switch.Root
      className="studio-switch"
      aria-label={label}
      checked={checked}
      onCheckedChange={onCheckedChange}
    >
      <span className="switch-state" aria-hidden="true">
        {checked ? "ON" : "OFF"}
      </span>
      <Switch.Thumb className="switch-thumb" />
    </Switch.Root>
  );
}
