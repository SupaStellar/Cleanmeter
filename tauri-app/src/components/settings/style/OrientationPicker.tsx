import { SectionCard } from "@/components/settings/stats/SectionCard";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/stores/settings-store";

/**
 * ORIENTATION card. Two large option tiles (Horizontal / Vertical) with a
 * miniature overlay preview inside each. Matches Figma frame 2075:7739.
 */

function HorizontalPreview() {
  return (
    <div className="flex h-full w-full items-center justify-center rounded-[4px] bg-muted">
      <div className="flex h-[33px] items-center gap-1 rounded-full bg-foreground/95 px-1 text-[9px] font-medium text-background shadow-sm ring-1 ring-white/5">
        <span className="flex h-[25px] items-center rounded-full bg-background/10 px-2">
          <span className="text-subtle-foreground">FPS</span>
          <span className="ml-1 text-background">120</span>
        </span>
        <span className="flex h-[25px] items-center rounded-full bg-background/10 px-2">
          <span className="text-subtle-foreground">CPU</span>
          <span className="ml-1 text-background">46&deg;c</span>
          <span className="ml-1 text-background">12%</span>
        </span>
      </div>
    </div>
  );
}

function VerticalPreview() {
  return (
    <div className="flex h-full w-full items-center justify-center rounded-[4px] bg-muted">
      <div className="flex w-[145px] flex-col gap-1 rounded-[12px] bg-foreground/95 p-1 text-[9px] font-medium text-background shadow-sm ring-1 ring-white/5">
        <span className="flex h-[25px] items-center rounded-[8px] bg-background/10 px-2">
          <span className="text-subtle-foreground">FPS</span>
          <span className="ml-auto text-background">120</span>
        </span>
        <span className="flex h-[25px] items-center rounded-[8px] bg-background/10 px-2">
          <span className="text-subtle-foreground">CPU</span>
          <span className="ml-auto text-background">46&deg;c 12%</span>
        </span>
      </div>
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
        "flex flex-1 flex-col overflow-hidden rounded-[8px] bg-card text-left transition-colors",
        "border border-border hover:border-foreground/40",
        selected && "border-2 border-foreground",
      )}
    >
      <div className="h-[138px] w-full p-1">{children}</div>
      <div className="flex items-center px-4 py-4">
        <span className="text-[14px] font-medium text-foreground">{label}</span>
      </div>
    </button>
  );
}

export function OrientationPicker() {
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.updateSettings);

  return (
    <SectionCard title="Orientation">
      <div className="flex gap-3">
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
    </SectionCard>
  );
}
