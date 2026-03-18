import { Caption1, tokens } from "@fluentui/react-components";
import type { Boundaries } from "@/lib/types";

interface BoundaryInputProps {
  boundaries: Boundaries;
  onChange: (boundaries: Boundaries) => void;
  unit: string;
}

export function BoundaryInput({
  boundaries,
  onChange,
  unit,
}: BoundaryInputProps) {
  return (
    <div style={{ marginTop: 8, marginLeft: 32, overflow: "hidden" }}>
      <div className="flex items-center" style={{ gap: 10, paddingTop: 4, paddingBottom: 4 }}>
        <BoundaryField
          color={tokens.colorPaletteGreenForeground1}
          label="Low"
          value={boundaries.low}
          onChange={(v) => onChange({ ...boundaries, low: v })}
        />
        <BoundaryField
          color={tokens.colorPaletteYellowForeground1}
          label="Med"
          value={boundaries.medium}
          onChange={(v) => onChange({ ...boundaries, medium: v })}
        />
        <BoundaryField
          color={tokens.colorPaletteRedForeground1}
          label="High"
          value={boundaries.high}
          onChange={(v) => onChange({ ...boundaries, high: v })}
        />
        <Caption1 style={{ flexShrink: 0, color: tokens.colorNeutralForeground4 }}>
          {unit}
        </Caption1>
      </div>
      <Caption1
        style={{
          display: "block",
          marginTop: 4,
          color: tokens.colorNeutralForeground4,
        }}
      >
        Colors apply when graph is enabled in Style
      </Caption1>
    </div>
  );
}

function BoundaryField({
  color,
  label,
  value,
  onChange,
}: {
  color: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div
      className="flex items-center flex-1 min-w-0"
      style={{ gap: 6 }}
    >
      <Caption1 style={{ fontWeight: 600, flexShrink: 0, color }}>{label}</Caption1>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value) || 0)}
        style={{
          flex: 1,
          minWidth: 0,
          height: 26,
          padding: "0 6px",
          borderRadius: 4,
          border: `1px solid ${tokens.colorNeutralStroke1}`,
          background: tokens.colorNeutralBackground1,
          color: tokens.colorNeutralForeground1,
          fontSize: 13,
          fontFamily: "inherit",
          outline: "none",
          MozAppearance: "textfield",
          appearance: "textfield",
        } as React.CSSProperties}
      />
    </div>
  );
}
