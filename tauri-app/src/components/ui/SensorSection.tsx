import { Body1Strong, tokens } from "@fluentui/react-components";
import { Switch } from "./Switch";

interface SensorSectionProps {
  title: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  children: React.ReactNode;
}

export function SensorSection({
  title,
  enabled,
  onToggle,
  children,
}: SensorSectionProps) {
  return (
    <div
      style={{
        background: tokens.colorNeutralBackground1,
        borderRadius: 8,
        border: `1px solid ${tokens.colorNeutralStroke2}`,
        padding: "16px 20px",
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <Body1Strong>{title}</Body1Strong>
        <Switch checked={enabled} onChange={onToggle} />
      </div>
      {enabled && <div className="flex flex-col gap-0.5 mt-1">{children}</div>}
    </div>
  );
}
