import { CollapsibleCard } from "./CollapsibleCard";
import { Switch } from "@/components/shadcn/switch";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/stores/settings-store";
import type { GraphType, ProgressType } from "@/lib/types";

// SHOW GRAPH card — Figma 2075:7833. Section title + switch + chevron in
// header. Body has two large option tiles (Ring / Bar) with a 64×64 muted
// icon square on the left.

function RingPreview() {
  return (
    <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden>
      <circle cx="15" cy="15" r="12" fill="none" stroke="currentColor" strokeWidth="6" className="text-foreground/10" />
      <circle
        cx="15"
        cy="15"
        r="12"
        fill="none"
        stroke="var(--color-success)"
        strokeWidth="6"
        strokeDasharray="55 75"
        strokeLinecap="round"
        transform="rotate(-90 15 15)"
      />
    </svg>
  );
}

function BarPreview() {
  return (
    <div className="flex flex-col gap-[2px]">
      {Array.from({ length: 9 }, (_, i) => {
        const filled = i >= 4;
        return (
          <div
            key={i}
            className={cn(
              "h-[2px] w-[26px] rounded-full",
              filled ? "bg-success" : "bg-foreground/10",
            )}
          />
        );
      })}
    </div>
  );
}

function GraphTile({
  selected,
  onClick,
  icon,
  label,
}: {
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center gap-3 rounded-[8px] bg-card p-1 text-left",
        "transition-shadow duration-150 motion-reduce:transition-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
      )}
      style={{
        boxShadow: selected
          ? "inset 0 0 0 2px #0C111D, 0 4px 8px 0 rgba(0,0,0,0.02)"
          : "inset 0 0 0 1px rgba(206,207,210,0.5), 0 4px 8px 0 rgba(0,0,0,0.02)",
      }}
    >
      <span className="flex size-16 shrink-0 items-center justify-center rounded-[4px] bg-muted">
        {icon}
      </span>
      <span className="text-[14px] font-medium text-foreground">{label}</span>
    </button>
  );
}

export function GraphTypePicker() {
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.updateSettings);

  const isEnabled = settings.progressType !== "none";

  const handleToggle = (enabled: boolean) => {
    if (enabled) {
      const type: ProgressType = settings.graphType === "bar" ? "bar" : "circular";
      updateSettings({ progressType: type });
    } else {
      updateSettings({ progressType: "none" });
    }
  };

  const setType = (type: GraphType) => {
    updateSettings({
      graphType: type,
      progressType: type === "ring" ? "circular" : "bar",
    });
  };

  const currentType: GraphType =
    settings.progressType === "bar" ? "bar" : "ring";

  return (
    <CollapsibleCard
      title="Show graph"
      rightControl={
        <Switch checked={isEnabled} onCheckedChange={handleToggle} />
      }
    >
      {isEnabled && (
        <div className="flex gap-3">
          <GraphTile
            selected={currentType === "ring"}
            onClick={() => setType("ring")}
            icon={<RingPreview />}
            label="Ring graph"
          />
          <GraphTile
            selected={currentType === "bar"}
            onClick={() => setType("bar")}
            icon={<BarPreview />}
            label="Bar graph"
          />
        </div>
      )}
    </CollapsibleCard>
  );
}
