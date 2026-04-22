import { cn } from "@/lib/utils";
import { StatsIcon, StyleIcon, SettingsIcon, AboutIcon } from "./tab-icons";

export type SettingsTab = "stats" | "style" | "settings" | "about";

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
  { value: "about", label: "About", Icon: AboutIcon },
];

export function TabNav({ activeTab, onTabChange }: TabNavProps) {
  return (
    <div
      role="tablist"
      className="flex h-12 w-full items-center rounded-full border border-border bg-muted p-1"
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
                ? "bg-card text-foreground"
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
