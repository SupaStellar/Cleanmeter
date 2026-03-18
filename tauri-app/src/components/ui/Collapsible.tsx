import { useState } from "react";
import { Body1Strong, tokens } from "@fluentui/react-components";
import { ChevronDown20Regular } from "@fluentui/react-icons";

interface CollapsibleProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export function Collapsible({
  title,
  defaultOpen = true,
  children,
}: CollapsibleProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full"
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "4px 0",
          color: tokens.colorNeutralForeground1,
        }}
      >
        <Body1Strong>{title}</Body1Strong>
        <ChevronDown20Regular
          style={{
            color: tokens.colorNeutralForeground3,
            transition: "transform 150ms ease",
            transform: open ? "rotate(0deg)" : "rotate(-90deg)",
          }}
        />
      </button>
      {open && <div style={{ paddingTop: 8, paddingBottom: 4 }}>{children}</div>}
    </div>
  );
}
