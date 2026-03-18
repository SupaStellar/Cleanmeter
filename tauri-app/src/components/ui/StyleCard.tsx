import { Caption1, tokens } from "@fluentui/react-components";

interface StyleCardProps {
  selected: boolean;
  onClick: () => void;
  label: string;
  children?: React.ReactNode;
}

export function StyleCard({
  selected,
  onClick,
  label,
  children,
}: StyleCardProps) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 flex-1 min-w-0"
      style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
    >
      <div
        style={{
          width: "100%",
          aspectRatio: "16/9",
          borderRadius: 6,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: tokens.colorNeutralBackground3,
          border: selected
            ? `2px solid ${tokens.colorBrandStroke1}`
            : `1px solid ${tokens.colorNeutralStroke2}`,
          transition: "border-color 100ms ease",
        }}
      >
        {children}
      </div>
      <Caption1
        style={{
          color: selected
            ? tokens.colorNeutralForeground1
            : tokens.colorNeutralForeground3,
          fontWeight: selected ? 600 : 400,
        }}
      >
        {label}
      </Caption1>
    </button>
  );
}
