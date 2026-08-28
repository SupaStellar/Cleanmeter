import * as SelectPrimitive from "@radix-ui/react-select";
import type * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The "Input" field from Figma: a 40px pill holding an inline label, a value
 * that truncates rather than wraps, and a chevron.
 *
 * One field in the design, so one component here. It appears as the sensor
 * picker (Figma 2353:612) and as the GPU picker (Figma 2759:12466), and those
 * two nodes are identical apart from the label. Their triggers are not the same
 * element, though: the sensor picker is a button that opens a modal, while the
 * GPU picker is a Radix Select trigger. Hence two exports over one body.
 *
 * Values are tokens rather than literals, per the repo's design-system
 * conventions: padding 12/8 = spacing-lg/md, gap 8 = spacing-md, radius 8 =
 * radius-md, border Border/Bolder, fill Bg/Surface Raised, shadow-xs.
 *
 * The height and the chevron box are px, not Tailwind's h-10 / size-5. :root
 * sets font-size 14px, so a rem utility lands at 87.5% of its nominal value
 * (h-10 measures 35px, not 40) while the design is specified in px.
 */
const pillClass = [
  "flex h-[40px] w-full items-center gap-[var(--spacingXs)]",
  "rounded-[var(--cornerL)] border border-[var(--borderBolder)] bg-[var(--bgSurfaceRaised)]",
  "px-[var(--spacingS)] py-[var(--spacingXs)] text-left",
  "shadow-[0_1px_2px_rgba(16,24,40,0.05)]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
].join(" ");

/**
 * Exported from Figma 2759:12472: the same `keyboard_arrow_up` vector the
 * sensor field uses, rotated to point down. 9.29x5.48 inside a 20x20 box, so
 * the box is what gets sized and the path carries its own inset.
 */
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

function PillBody({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <span className="shrink-0 text-[14px] font-normal text-[var(--textParagraph1)]">
        {label}
      </span>
      <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-[var(--textHeading)]">
        {children}
      </span>
      <ChevronIcon className="size-[20px] shrink-0 text-[var(--iconBolderActive)]" />
    </>
  );
}

type SelectFieldButtonProps = React.ComponentProps<"button"> & {
  /** The label inside the field, e.g. "Sensor:". */
  label: string;
};

/** The pill as a plain button, for a picker that opens something of its own. */
export function SelectFieldButton({
  label,
  className,
  children,
  ...props
}: SelectFieldButtonProps) {
  return (
    <button type="button" className={cn(pillClass, className)} {...props}>
      <PillBody label={label}>{children}</PillBody>
    </button>
  );
}

type SelectFieldTriggerProps = React.ComponentProps<typeof SelectPrimitive.Trigger> & {
  /** The label inside the field, e.g. "Selected:". */
  label: string;
};

/**
 * The pill as a Radix Select trigger.
 *
 * Not built on the shadcn SelectTrigger: that one appends a chevron of its own
 * and cannot be told not to, which would put two in the field.
 */
export function SelectFieldTrigger({
  label,
  className,
  children,
  ...props
}: SelectFieldTriggerProps) {
  return (
    <SelectPrimitive.Trigger className={cn(pillClass, className)} {...props}>
      <PillBody label={label}>{children}</PillBody>
    </SelectPrimitive.Trigger>
  );
}
