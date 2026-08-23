interface MetricValueProps {
  value: string;
  unit: string;
  valueFontSize: number;
  labelFontSize: number;
  valueFontWeight: number;
  labelFontWeight: number;
  label?: string;
  title?: string;
}

/** Compact overlay value with an optional label for supplemental readings. */
export function MetricValue({
  value,
  unit,
  valueFontSize,
  labelFontSize,
  valueFontWeight,
  labelFontWeight,
  label,
  title,
}: MetricValueProps) {
  return (
    <div className="flex items-center gap-1" title={title}>
      {label && (
        <span
          style={{
            fontSize: labelFontSize,
            fontWeight: labelFontWeight,
            color: "var(--overlay-text-muted)",
            fontFamily: "Inter",
            letterSpacing: "0.04em",
          }}
        >
          {label}
        </span>
      )}
      <span
        className="tabular-nums"
        style={{
          fontSize: valueFontSize,
          fontWeight: valueFontWeight,
          color: "var(--overlay-text)",
          fontFamily: "Inter",
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </span>
      <span
        style={{
          fontSize: labelFontSize,
          fontWeight: labelFontWeight,
          color: "var(--overlay-text)",
          fontFamily: "Inter",
          letterSpacing: "0.04em",
        }}
      >
        {unit}
      </span>
    </div>
  );
}
