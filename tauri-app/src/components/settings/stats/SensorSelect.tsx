import { useState } from "react";
import type { Sensor } from "@/lib/types";
import { SensorPickerModal } from "./SensorPickerModal";
import { SelectFieldButton } from "@/components/ui/SelectField";

interface Props {
  value: string;
  options: Sensor[];
  onChange: (v: string) => void;
  // Used in the modal title: "Select {label} sensor".
  label: string;
}

/**
 * Sensor picker trigger pill matched 1:1 to Figma 2353:612, the same field as
 * the GPU picker, so the pill itself lives in components/ui/SelectField.
 * Clicking opens SensorPickerModal, which replaced the previous Radix Select
 * dropdown.
 */
export function SensorSelect({ value, options, onChange, label }: Props) {
  const [open, setOpen] = useState(false);
  const currentName =
    options.find((o) => o.identifier === value)?.name ?? "Select";

  return (
    <>
      <SelectFieldButton label="Sensor:" onClick={() => setOpen(true)}>
        {currentName}
      </SelectFieldButton>
      <SensorPickerModal
        open={open}
        onOpenChange={setOpen}
        title={`Select ${label} sensor`}
        value={value}
        options={options}
        onChange={onChange}
      />
    </>
  );
}
