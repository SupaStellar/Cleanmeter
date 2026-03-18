import {
  Switch as FluentSwitch,
  type SwitchOnChangeData,
} from "@fluentui/react-components";

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function Switch({ checked, onChange, disabled }: SwitchProps) {
  const handleChange = (_: unknown, data: SwitchOnChangeData) => {
    onChange(data.checked);
  };

  return (
    <FluentSwitch
      checked={checked}
      onChange={handleChange}
      disabled={disabled}
    />
  );
}
