import { Caption1, tokens } from "@fluentui/react-components";
import { Collapsible } from "@/components/ui/Collapsible";
import { StyleCard } from "@/components/ui/StyleCard";
import { Checkbox } from "@/components/ui/Checkbox";
import { useSettingsStore } from "@/stores/settings-store";

const positions = [
  { index: 0, label: "Top Left", align: "items-start justify-start" },
  { index: 1, label: "Top Center", align: "items-start justify-center" },
  { index: 2, label: "Top Right", align: "items-start justify-end" },
  { index: 3, label: "Bottom Left", align: "items-end justify-start" },
  { index: 4, label: "Bottom Center", align: "items-end justify-center" },
  { index: 5, label: "Bottom Right", align: "items-end justify-end" },
];

export function PositionGrid() {
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.updateSettings);

  return (
    <div
      style={{
        background: tokens.colorNeutralBackground1,
        borderRadius: 8,
        border: `1px solid ${tokens.colorNeutralStroke2}`,
        padding: "12px 20px",
      }}
    >
      <Collapsible title="Position">
        <div className="grid grid-cols-3 gap-3 mb-3">
          {positions.map((pos) => (
            <StyleCard
              key={pos.index}
              selected={settings.positionIndex === pos.index}
              onClick={() => updateSettings({ positionIndex: pos.index })}
              label={pos.label}
            >
              <div className={`w-full h-full flex p-2 ${pos.align}`}>
                <div
                  style={{
                    width: 24,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: tokens.colorBrandBackground,
                    opacity: 0.6,
                  }}
                />
              </div>
            </StyleCard>
          ))}
        </div>

        <div className="flex flex-col gap-3" style={{ marginTop: 8 }}>
          <div className="flex items-center gap-3">
            <OffsetInput
              label="X"
              value={settings.positionX}
              onChange={(v) => updateSettings({ positionX: v })}
            />
            <OffsetInput
              label="Y"
              value={settings.positionY}
              onChange={(v) => updateSettings({ positionY: v })}
            />
          </div>
          <Checkbox
            label="Lock position"
            checked={settings.isPositionLocked}
            onChange={(v) => updateSettings({ isPositionLocked: v })}
          />
        </div>
      </Collapsible>
    </div>
  );
}

function OffsetInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const step = 10;
  return (
    <div className="flex items-center gap-2" style={{ flex: 1, minWidth: 0 }}>
      <Caption1 style={{ fontWeight: 600, flexShrink: 0 }}>{label}</Caption1>
      <div
        className="flex items-center"
        style={{
          flex: 1,
          minWidth: 0,
          height: 28,
          borderRadius: 4,
          border: `1px solid ${tokens.colorNeutralStroke1}`,
          background: tokens.colorNeutralBackground1,
          overflow: "hidden",
        }}
      >
        <button
          onClick={() => onChange(value - step)}
          style={{
            width: 28,
            height: "100%",
            border: "none",
            background: "transparent",
            color: tokens.colorNeutralForeground2,
            cursor: "pointer",
            fontSize: 14,
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          −
        </button>
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value) || 0)}
          style={{
            flex: 1,
            minWidth: 0,
            height: "100%",
            border: "none",
            background: "transparent",
            color: tokens.colorNeutralForeground1,
            fontSize: 12,
            fontFamily: "inherit",
            textAlign: "center",
            outline: "none",
            MozAppearance: "textfield",
            appearance: "textfield",
          } as React.CSSProperties}
        />
        <button
          onClick={() => onChange(value + step)}
          style={{
            width: 28,
            height: "100%",
            border: "none",
            background: "transparent",
            color: tokens.colorNeutralForeground2,
            cursor: "pointer",
            fontSize: 14,
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          +
        </button>
      </div>
    </div>
  );
}
