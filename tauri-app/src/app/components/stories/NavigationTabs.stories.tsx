import { useId, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { NavigationTabs, NavigationTabPanels, type SettingsTab } from "../NavigationTabs";

const meta: Meta<typeof NavigationTabs> = {
  title: "Components/NavigationTabs",
  component: NavigationTabs,
  parameters: {
    layout: "centered",
    docs: { description: { component: "Uses the live app's TabNav and TabPanels: sliding indicator and Page side-by-side content. State and scrolling survive navigation; reduced motion switches instantly." } },
  },
  tags: ["autodocs"],
};
export default meta;
type Story = StoryObj<typeof NavigationTabs>;

function InteractiveTabs({ defaultTab = "stats" }: { defaultTab?: SettingsTab }) {
  const idPrefix = useId();
  const [activeTab, setActiveTab] = useState<SettingsTab>(defaultTab);
  return (
    <div className="flex h-[400px] w-[603px] max-w-full flex-col gap-5">
      <NavigationTabs idPrefix={idPrefix} activeTab={activeTab} onTabChange={setActiveTab} />
      <NavigationTabPanels idPrefix={idPrefix} activeTab={activeTab} panels={{
        stats: <div className="h-[600px] rounded-lg bg-card p-4"><h2>Stats</h2><label>Preserved input <input aria-label="Preserved input" className="border p-2" placeholder="Type, switch tabs, return" /></label><p>Scroll this panel and return to verify its position.</p></div>,
        style: <div className="rounded-lg bg-card p-4">Style controls</div>,
        settings: <div className="rounded-lg bg-card p-4">Settings controls</div>,
        help: <div className="rounded-lg bg-card p-4">Help content</div>,
      }} />
    </div>
  );
}
export const Default: Story = { render: () => <InteractiveTabs /> };
export const StyleActive: Story = { render: () => <InteractiveTabs defaultTab="style" /> };
