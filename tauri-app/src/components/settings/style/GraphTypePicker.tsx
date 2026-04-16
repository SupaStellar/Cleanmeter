import { SectionCard } from "@/components/settings/stats/SectionCard";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/stores/settings-store";
import type { GraphType, ProgressType } from "@/lib/types";

/**
 * SHOW GRAPH card. Matches Figma 2075:7833 — section switch + two option
 * tiles (Ring / Bar). Icon on the left inside a 64×64 muted square, label
 * on the right.
 */

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
  // 9 bars, top 4 muted, bottom 5 green. Matches Figma 2091:2570.
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
        "flex flex-1 items-center gap-3 rounded-[8px] bg-card p-1 text-left transition-colors",
        "border border-border hover:border-foreground/40",
        selected && "border-2 border-foreground p-[3px]",
      )}
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
      // Re-enable with the user's previously chosen graph type (default ring).
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
    <SectionCard title="Show graph" enabled={isEnabled} onToggle={handleToggle}>
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
    </SectionCard>
  );
}
