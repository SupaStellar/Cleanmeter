import { CollapsibleCard } from "./CollapsibleCard";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/stores/settings-store";

// ORIENTATION card — Figma 2310:2740. Two tiles (Horizontal/Vertical) each
// showing a miniature glass overlay preview centered in a sunken-grey area;
// selected tile gets a 2px brand inset ring. Tile row height is exactly
// 187px per Figma.

function MetricLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "text-[10px] font-medium uppercase leading-none tracking-[1px] text-white/70",
        className,
      )}
    >
      {children}
    </span>
  );
}

function FpsValue() {
  return (
    <span className="text-[16px] font-normal leading-none tracking-[-0.32px] text-white">
      120
    </span>
  );
}

function TempValue() {
  return (
    <span className="leading-none text-white">
      <span className="text-[16px] font-normal tracking-[-0.32px]">46</span>
      <span className="text-[12px] font-medium tracking-[-0.24px]">°C</span>
    </span>
  );
}

function PercentValue() {
  return (
    <span className="leading-none text-white">
      <span className="text-[16px] font-normal tracking-[-0.32px]">12</span>
      <span className="text-[12px] font-semibold tracking-[-0.24px]">%</span>
    </span>
  );
}

function HorizontalPreview() {
  return (
    <div
      className="flex items-center gap-1 rounded-full border border-white/[0.05] p-[3px] backdrop-blur-[12px]"
      style={{
        backgroundColor: "rgba(0,0,0,0.64)",
        boxShadow: "0px 4px 24px 0px rgba(0,0,0,0.25)",
      }}
    >
      <span
        className="flex items-center gap-3 rounded-full px-3 py-1"
        style={{ backgroundColor: "rgba(0,0,0,0.24)" }}
      >
        <MetricLabel>FPS</MetricLabel>
        <FpsValue />
      </span>
      <span
        className="flex items-center gap-3 rounded-full px-3 py-1"
        style={{ backgroundColor: "rgba(0,0,0,0.24)" }}
      >
        <MetricLabel>CPU</MetricLabel>
        <TempValue />
        <PercentValue />
      </span>
    </div>
  );
}

function VerticalPreview() {
  return (
    <div
      className="flex flex-col gap-1 rounded-[12px] border border-white/[0.05] p-1 backdrop-blur-[12px]"
      style={{
        backgroundColor: "rgba(0,0,0,0.64)",
        boxShadow: "0px 4px 24px 0px rgba(0,0,0,0.25)",
      }}
    >
      <span
        className="flex w-full items-center gap-3 rounded-[8px] px-3 py-2"
        style={{ backgroundColor: "rgba(0,0,0,0.24)" }}
      >
        <MetricLabel className="w-7">FPS</MetricLabel>
        <FpsValue />
      </span>
      <span
        className="flex w-full items-center gap-3 rounded-[8px] px-3 py-2"
        style={{ backgroundColor: "rgba(0,0,0,0.24)" }}
      >
        <MetricLabel className="w-7">CPU</MetricLabel>
        <TempValue />
        <PercentValue />
      </span>
    </div>
  );
}

function OrientationTile({
  selected,
  onClick,
  label,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-full flex-1 flex-col overflow-hidden rounded-[8px] bg-[var(--bgSurfaceRaised)] text-left",
        "transition-shadow duration-150 motion-reduce:transition-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
      )}
      style={{
        boxShadow: selected
          ? "inset 0 0 0 2px #0C111D, 0 4px 8px 0 rgba(0,0,0,0.02)"
          : "inset 0 0 0 1px rgba(206,207,210,0.5), 0 4px 8px 0 rgba(0,0,0,0.02)",
      }}
    >
      <div className="flex flex-1 px-1 pt-1">
        <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-[4px] bg-[#F5F5F6]">
          {children}
        </div>
      </div>
      <div className="flex w-full items-center p-4">
        <span className="text-[14px] font-medium leading-none text-[#0C111D]">
          {label}
        </span>
      </div>
    </button>
  );
}

export function OrientationPicker() {
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.updateSettings);

  return (
    <CollapsibleCard title="Orientation">
      <div className="flex h-[187px] gap-3">
        <OrientationTile
          selected={settings.isHorizontal}
          onClick={() => updateSettings({ isHorizontal: true })}
          label="Horizontal"
        >
          <HorizontalPreview />
        </OrientationTile>
        <OrientationTile
          selected={!settings.isHorizontal}
          onClick={() => updateSettings({ isHorizontal: false })}
          label="Vertical"
        >
          <VerticalPreview />
        </OrientationTile>
      </div>
    </CollapsibleCard>
  );
}
