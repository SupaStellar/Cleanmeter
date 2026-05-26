import { useState } from "react";
import type { Sensor } from "@/lib/types";
import { SensorPickerModal } from "./SensorPickerModal";

interface Props {
  value: string;
  options: Sensor[];
  onChange: (v: string) => void;
  // Used in the modal title: "Select {label} sensor".
  label: string;
}

// Chevron exported from Figma 2353:616 — 20×20, currentColor fill.
function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      className={className}
      aria-hidden
    >
      <path
        d="M10.0007 11L13.2507 7.75C13.4034 7.59722 13.5979 7.52083 13.834 7.52083C14.0701 7.52083 14.2645 7.59722 14.4173 7.75C14.5701 7.90278 14.6465 8.09722 14.6465 8.33333C14.6465 8.56944 14.5701 8.76389 14.4173 8.91667L10.584 12.75C10.4173 12.9167 10.2229 13 10.0007 13C9.77843 13 9.58398 12.9167 9.41732 12.75L5.58398 8.91667C5.43121 8.76389 5.35482 8.56944 5.35482 8.33333C5.35482 8.09722 5.43121 7.90278 5.58398 7.75C5.73676 7.59722 5.93121 7.52083 6.16732 7.52083C6.40343 7.52083 6.59787 7.59722 6.75065 7.75L10.0007 11Z"
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * Sensor picker trigger pill matched 1:1 to Figma 2353:612.
 * Clicking opens SensorPickerModal — replaces the previous Radix Select dropdown.
 */
export function SensorSelect({ value, options, onChange, label }: Props) {
  const [open, setOpen] = useState(false);
  const currentName =
    options.find((o) => o.identifier === value)?.name ?? "Select";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-10 w-full items-center gap-2 rounded-[8px] border border-[var(--borderBolder)] bg-[var(--bgSurfaceRaised)] px-3 py-2 text-left shadow-[0_1px_2px_rgba(16,24,40,0.05)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
      >
        <span className="shrink-0 text-[14px] font-normal text-[var(--textParagraph1)]">
          Sensor:
        </span>
        <span className="flex-1 truncate text-[14px] font-medium text-[var(--textHeading)]">
          {currentName}
        </span>
        <ChevronIcon className="size-5 shrink-0 text-[var(--iconBolderActive)]" />
      </button>
      <SensorPickerModal
        open={open}
        onOpenChange={setOpen}
        title={`Select ${label} sensor`}
        value={value}
        options={options}
        onChange={onChange}
      />
    </>
  );
}
