import type { ReactNode } from "react";
import type { SettingsTab } from "./TabNav";

const ORDER: SettingsTab[] = ["stats", "style", "settings", "help"];

export function TabPanels({ activeTab, panels }: {
  activeTab: SettingsTab;
  panels: Record<SettingsTab, ReactNode>;
}) {
  const activeIndex = ORDER.indexOf(activeTab);
  return (
    <div className="relative min-h-0 flex-1 overflow-hidden">
      {ORDER.map((tab, index) => (
        <div
          key={tab}
          id={`panel-${tab}`}
          role="tabpanel"
          aria-labelledby={`tab-${tab}`}
          aria-hidden={tab !== activeTab}
          inert={tab !== activeTab}
          data-active={tab === activeTab}
          className="app-tab-panel absolute inset-0 overflow-y-auto"
          style={{ transform: `translateX(${Math.sign(index - activeIndex) * 8}px)` }}
        >
          {panels[tab]}
        </div>
      ))}
    </div>
  );
}
