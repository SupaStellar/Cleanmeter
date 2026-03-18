import {
  Slider as FluentSlider,
  type SliderOnChangeData,
} from "@fluentui/react-components";

interface SliderProps {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}

export function Slider({ value, min, max, step, onChange }: SliderProps) {
  const handleChange = (_: unknown, data: SliderOnChangeData) => {
    onChange(data.value);
  };

  return (
    <FluentSlider
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={handleChange}
      style={{ width: "100%" }}
    />
  );
}
