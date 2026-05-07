import { cn } from "@/lib/utils";
import { StatsIcon, StyleIcon, SettingsIcon, HelpIcon } from "./tab-icons";

export type SettingsTab = "stats" | "style" | "settings" | "help";

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
  { value: "style", label: "Style", Icon: StyleIcon },
  { value: "settings", label: "Settings", Icon: SettingsIcon },
  { value: "help", label: "Help", Icon: HelpIcon },
];

export function TabNav({ activeTab, onTabChange }: TabNavProps) {
  return (
    <div
      role="tablist"
      className="flex h-12 w-full items-center rounded-full border border-border/50 bg-muted p-1"
    >
      {TABS.map(({ value, label, Icon }) => {
        const active = value === activeTab;
        return (
          <button
            key={value}
            role="tab"
            aria-selected={active}
            onClick={() => onTabChange(value)}
            className={cn(
              "flex h-10 flex-1 items-center justify-center gap-1 rounded-full text-base font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              active
                ? "bg-card text-foreground shadow-[0_4px_4px_0_rgba(0,0,0,0.02)]"
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
