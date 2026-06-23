import { cn } from "@/lib/utils";
import { StatsIcon, StyleIcon, SettingsIcon, HelpIcon, ProcessesIcon } from "./tab-icons";

export type SettingsTab = "stats" | "processes" | "style" | "settings" | "help";

interface TabNavProps {
  activeTab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
}

const TABS: {
  value: SettingsTab;
  label: string;
  Icon: (p: { className?: string }) => React.JSX.Element;
}[] = [
  { value: "stats", label: "Stats", Icon: StatsIcon },
  { value: "processes", label: "Processes", Icon: ProcessesIcon },
  { value: "style", label: "Style", Icon: StyleIcon },
  { value: "settings", label: "Settings", Icon: SettingsIcon },
  { value: "help", label: "Help", Icon: HelpIcon },
];

export function TabNav({ activeTab, onTabChange }: TabNavProps) {
  const activeIndex = TABS.findIndex((t) => t.value === activeTab);

  return (
    <div
      role="tablist"
      className="relative flex h-12 w-full items-center rounded-full border border-border/50 bg-muted p-1"
    >
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute left-1 top-1 bottom-1 rounded-full bg-card",
          "shadow-[0_4px_4px_0_rgba(0,0,0,0.02)]",
          "transition-transform duration-300 ease-out motion-reduce:transition-none",
        )}
        style={{
          width: `calc((100% - 0.5rem) / ${TABS.length})`,
          transform: `translateX(${activeIndex * 100}%)`,
        }}
      />
      {TABS.map(({ value, label, Icon }) => {
        const active = value === activeTab;
        return (
          <button
            key={value}
            role="tab"
            aria-selected={active}
            onClick={() => onTabChange(value)}
            className={cn(
              "relative z-10 flex h-10 flex-1 items-center justify-center gap-1 rounded-full text-base font-medium",
              "transition-colors duration-200 motion-reduce:transition-none",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              active
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-5" />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
