import { useState } from "react";
import type { Sensor } from "@/lib/types";
import { SensorPickerModal } from "./SensorPickerModal";
import { SelectFieldButton } from "@/components/ui/SelectField";

interface SingleSelectProps {
  multiple?: false;
  value: string;
  options: Sensor[];
  onChange: (v: string) => void;
  // Used in the modal title: "Select {label} sensor".
  label: string;
}

interface MultiSelectProps {
  multiple: true;
  values: string[];
  options: Sensor[];
  onChange: (values: string[]) => void;
  label: string;
}

type Props = SingleSelectProps | MultiSelectProps;

/**
 * Sensor picker trigger pill matched 1:1 to Figma 2353:612, the same field as
 * the GPU picker, so the pill itself lives in components/ui/SelectField.
 * Clicking opens SensorPickerModal, which replaced the previous Radix Select
 * dropdown.
 */
export function SensorSelect(props: Props) {
  const [open, setOpen] = useState(false);
  const selectedIds = props.multiple ? props.values : [props.value];
  const primaryName = props.options.find(
    (option) => option.identifier === selectedIds[0],
  )?.name;
  const currentName = primaryName
    ? `${primaryName}${selectedIds.length > 1 ? ` +${selectedIds.length - 1}` : ""}`
    : selectedIds.length > 1
      ? `${selectedIds.length} selected`
      : "Select";

  return (
    <>
      <SelectFieldButton
        label={props.multiple ? "Sensors:" : "Sensor:"}
        onClick={() => setOpen(true)}
      >
        {currentName}
      </SelectFieldButton>
      <SensorPickerModal
        open={open}
        onOpenChange={setOpen}
        title={`Select ${props.label} ${props.multiple ? "sensors" : "sensor"}`}
        value={selectedIds[0] ?? ""}
        values={selectedIds}
        multiple={props.multiple}
        options={props.options}
        onChange={(value) => {
          if (!props.multiple) props.onChange(value);
        }}
        onValuesChange={(values) => {
          if (props.multiple) props.onChange(values);
        }}
      />
    </>
  );
}
