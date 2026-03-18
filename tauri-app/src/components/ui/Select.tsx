import {
  Dropdown,
  Option,
  Label,
  Caption1,
  type OptionOnSelectData,
} from "@fluentui/react-components";

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  disclaimer?: string;
}

export function Select({
  value,
  options,
  onChange,
  placeholder = "Select...",
  label,
  disclaimer,
}: SelectProps) {
  const selected = options.find((o) => o.value === value);

  const handleSelect = (_: unknown, data: OptionOnSelectData) => {
    if (data.optionValue) {
      onChange(data.optionValue);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      {label && <Label size="small">{label}</Label>}
      <Dropdown
        value={selected?.label ?? ""}
        selectedOptions={value ? [value] : []}
        onOptionSelect={handleSelect}
        placeholder={placeholder}
        appearance="filled-lighter"
        style={{ minWidth: 0, border: `1px solid var(--colorNeutralStroke1)`, borderRadius: 4 }}
      >
        {options.map((option) => (
          <Option key={option.value} value={option.value}>
            {option.label}
          </Option>
        ))}
      </Dropdown>
      {disclaimer && (
        <Caption1 style={{ opacity: 0.7 }}>{disclaimer}</Caption1>
      )}
    </div>
  );
}
