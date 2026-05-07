import { PositionGrid } from "./PositionGrid";

// Other style sections (orientation, font, opacity, graph type) are kept
// in the repo but disabled for the early-build UI per Figma 2235:321.
// Restore by re-rendering them below PositionGrid when ready.
// import { OrientationPicker } from "./OrientationPicker";
// import { FontCard } from "./FontCard";
// import { OpacitySlider } from "./OpacitySlider";
// import { GraphTypePicker } from "./GraphTypePicker";

export function StyleTab() {
  return (
    <div className="flex h-full w-full flex-col gap-4">
      <PositionGrid />
    </div>
  );
}
