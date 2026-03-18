import {
  Checkbox as FluentCheckbox,
  type CheckboxOnChangeData,
} from "@fluentui/react-components";

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  trailing?: React.ReactNode;
}

export function Checkbox({
  checked,
  onChange,
  label,
  disabled,
  trailing,
}: CheckboxProps) {
  const handleChange = (_: unknown, data: CheckboxOnChangeData) => {
    onChange(data.checked === true);
  };

  return (
    <div className="flex items-center gap-1 py-0.5">
      <FluentCheckbox
        checked={checked}
        onChange={handleChange}
        label={label}
        disabled={disabled}
      />
      {trailing && <div className="ml-auto">{trailing}</div>}
    </div>
  );
}
