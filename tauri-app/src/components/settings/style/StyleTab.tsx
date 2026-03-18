import { PositionGrid } from "./PositionGrid";
import { OrientationPicker } from "./OrientationPicker";
import { OpacitySlider } from "./OpacitySlider";
import { GraphTypePicker } from "./GraphTypePicker";
import { MonitorSelect } from "./MonitorSelect";

export function StyleTab() {
  return (
    <div className="flex flex-col overflow-y-auto h-full" style={{ padding: 16, gap: 16 }}>
      <PositionGrid />
      <OrientationPicker />
      <OpacitySlider />
      <GraphTypePicker />
      <MonitorSelect />
    </div>
  );
}
