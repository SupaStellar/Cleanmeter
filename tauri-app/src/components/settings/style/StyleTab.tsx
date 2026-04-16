import { PositionGrid } from "./PositionGrid";
import { OrientationPicker } from "./OrientationPicker";
import { FontCard } from "./FontCard";
import { OpacitySlider } from "./OpacitySlider";
import { GraphTypePicker } from "./GraphTypePicker";

export function StyleTab() {
  return (
    <div className="flex h-full w-full flex-col gap-4">
      <PositionGrid />
      <OrientationPicker />
      <FontCard />
      <OpacitySlider />
      <GraphTypePicker />
    </div>
  );
}
