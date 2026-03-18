import {
  TabList,
  Tab,
  tokens,
} from "@fluentui/react-components";
import {
  DataBarVertical20Regular,
  PaintBrush20Regular,
  Settings20Regular,
  QuestionCircle20Regular,
} from "@fluentui/react-icons";

export type SettingsTab = "stats" | "style" | "settings" | "help";

interface TabNavProps {
  activeTab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
}

export function TabNav({ activeTab, onTabChange }: TabNavProps) {
  return (
    <div
      style={{
        padding: "8px 16px 0",
        background: tokens.colorNeutralBackground1,
        borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
      }}
    >
      <TabList
        selectedValue={activeTab}
        onTabSelect={(_, data) => onTabChange(data.value as SettingsTab)}
        size="medium"
        appearance="subtle"
      >
        <Tab value="stats" icon={<DataBarVertical20Regular />}>
          Stats
        </Tab>
        <Tab value="style" icon={<PaintBrush20Regular />}>
          Style
        </Tab>
        <Tab value="settings" icon={<Settings20Regular />}>
          Settings
        </Tab>
        <Tab value="help" icon={<QuestionCircle20Regular />}>
          Help
        </Tab>
      </TabList>
    </div>
  );
}
