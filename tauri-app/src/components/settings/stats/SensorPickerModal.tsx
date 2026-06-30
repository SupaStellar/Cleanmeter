import { useEffect, useMemo, useRef, useState } from "react";
import type { Sensor } from "@/lib/types";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "@/components/shadcn/dialog";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  value: string;
  options: Sensor[];
  onChange: (v: string) => void;
}

// Icons exported from Figma 2353:2207 (close), 2353:2211 (search),
// 2353:2224 (check). All 20×20 with currentColor fill.

function CloseIcon({ className }: { className?: string }) {
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
        d="M10.0007 11.1673L5.91732 15.2507C5.76454 15.4034 5.5701 15.4798 5.33398 15.4798C5.09787 15.4798 4.90343 15.4034 4.75065 15.2507C4.59787 15.0979 4.52148 14.9034 4.52148 14.6673C4.52148 14.4312 4.59787 14.2368 4.75065 14.084L8.83398 10.0007L4.75065 5.91732C4.59787 5.76454 4.52148 5.5701 4.52148 5.33398C4.52148 5.09787 4.59787 4.90343 4.75065 4.75065C4.90343 4.59787 5.09787 4.52148 5.33398 4.52148C5.5701 4.52148 5.76454 4.59787 5.91732 4.75065L10.0007 8.83398L14.084 4.75065C14.2368 4.59787 14.4312 4.52148 14.6673 4.52148C14.9034 4.52148 15.0979 4.59787 15.2507 4.75065C15.4034 4.90343 15.4798 5.09787 15.4798 5.33398C15.4798 5.5701 15.4034 5.76454 15.2507 5.91732L11.1673 10.0007L15.2507 14.084C15.4034 14.2368 15.4798 14.4312 15.4798 14.6673C15.4798 14.9034 15.4034 15.0979 15.2507 15.2507C15.0979 15.4034 14.9034 15.4798 14.6673 15.4798C14.4312 15.4798 14.2368 15.4034 14.084 15.2507L10.0007 11.1673Z"
        fill="currentColor"
      />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
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
        d="M7.91667 13.3333C6.40278 13.3333 5.12153 12.809 4.07292 11.7604C3.02431 10.7118 2.5 9.43056 2.5 7.91667C2.5 6.40278 3.02431 5.12153 4.07292 4.07292C5.12153 3.02431 6.40278 2.5 7.91667 2.5C9.43056 2.5 10.7118 3.02431 11.7604 4.07292C12.809 5.12153 13.3333 6.40278 13.3333 7.91667C13.3333 8.52778 13.2361 9.10417 13.0417 9.64583C12.8472 10.1875 12.5833 10.6667 12.25 11.0833L16.9167 15.75C17.0694 15.9028 17.1458 16.0972 17.1458 16.3333C17.1458 16.5694 17.0694 16.7639 16.9167 16.9167C16.7639 17.0694 16.5694 17.1458 16.3333 17.1458C16.0972 17.1458 15.9028 17.0694 15.75 16.9167L11.0833 12.25C10.6667 12.5833 10.1875 12.8472 9.64583 13.0417C9.10417 13.2361 8.52778 13.3333 7.91667 13.3333ZM7.91667 11.6667C8.95833 11.6667 9.84375 11.3021 10.5729 10.5729C11.3021 9.84375 11.6667 8.95833 11.6667 7.91667C11.6667 6.875 11.3021 5.98958 10.5729 5.26042C9.84375 4.53125 8.95833 4.16667 7.91667 4.16667C6.875 4.16667 5.98958 4.53125 5.26042 5.26042C4.53125 5.98958 4.16667 6.875 4.16667 7.91667C4.16667 8.95833 4.53125 9.84375 5.26042 10.5729C5.98958 11.3021 6.875 11.6667 7.91667 11.6667Z"
        fill="currentColor"
      />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
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
        d="M7.95745 12.625L15.0199 5.5625C15.1866 5.39583 15.3811 5.3125 15.6033 5.3125C15.8255 5.3125 16.0199 5.39583 16.1866 5.5625C16.3533 5.72917 16.4366 5.92708 16.4366 6.15625C16.4366 6.38542 16.3533 6.58333 16.1866 6.75L8.54078 14.4167C8.37411 14.5833 8.17967 14.6667 7.95745 14.6667C7.73523 14.6667 7.54078 14.5833 7.37411 14.4167L3.79078 10.8333C3.62411 10.6667 3.54425 10.4688 3.5512 10.2396C3.55814 10.0104 3.64495 9.8125 3.81161 9.64583C3.97828 9.47917 4.1762 9.39583 4.40536 9.39583C4.63453 9.39583 4.83245 9.47917 4.99911 9.64583L7.95745 12.625Z"
        fill="currentColor"
      />
    </svg>
  );
}

const isTouchDevice =
  typeof window !== "undefined" && "ontouchstart" in window;

export function SensorPickerModal({
  open,
  onOpenChange,
  title,
  value,
  options,
  onChange,
}: Props) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Reset the search field whenever the modal closes. Prop-sync effect, not a
  // render cascade — the setState only fires on the open→closed transition.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!open) setQuery("");
  }, [open]);

  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () => (q ? options.filter((o) => o.name.toLowerCase().includes(q)) : options),
    [options, q],
  );

  // Seed the highlight at the currently-selected row on open.
  useEffect(() => {
    if (!open) return;
    const idx = options.findIndex((s) => s.identifier === value);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveIndex(idx >= 0 ? idx : 0);
  }, [open, value, options]);

  // Every keystroke re-narrows the list. Snap to the top match so Enter
  // selects what the user is reading at the top.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveIndex(0);
  }, [query]);

  const handleSelect = (id: string) => {
    onChange(id);
    onOpenChange(false);
  };

  const onListKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = Math.min(filtered.length - 1, activeIndex + 1);
      setActiveIndex(next);
      (listRef.current?.children[next] as HTMLElement | undefined)?.scrollIntoView({
        block: "nearest",
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const next = Math.max(0, activeIndex - 1);
      setActiveIndex(next);
      (listRef.current?.children[next] as HTMLElement | undefined)?.scrollIntoView({
        block: "nearest",
      });
    } else if (e.key === "Enter" && filtered[activeIndex]) {
      e.preventDefault();
      handleSelect(filtered[activeIndex].identifier);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        {/* Overlay sits below the 52px title bar so the bar stays interactive */}
        <DialogOverlay className="top-[52px]" />
        <DialogContent
          aria-describedby={undefined}
          // Top-anchored layout matches the existing Figma frame (52px title
          // bar + 25px gap). max-w-[603px] caps width; mx-6 reproduces the
          // 24px gutters by sizing to viewport minus 48px.
          className={cn(
            "left-1/2 top-[77px] -translate-x-1/2 translate-y-0",
            "grid w-[calc(100%-48px)] max-w-[603px] grid-rows-[auto_1fr] gap-0 overflow-hidden",
            "rounded-[12px] bg-[var(--bgSurfaceRaised)] shadow-lg",
            "data-[state=open]:slide-in-from-top-2 data-[state=closed]:slide-out-to-top-2",
          )}
          onOpenAutoFocus={(e) => {
            // Default focus would land on the close button. Aim at the search
            // input instead — except on touch where that pops the soft keyboard.
            if (isTouchDevice) {
              e.preventDefault();
              return;
            }
            e.preventDefault();
            inputRef.current?.focus();
          }}
        >
          <div className="flex flex-col gap-4 border-b border-[var(--borderSubtle)] bg-[var(--bgSurfaceRaised)] p-5">
            <div className="flex items-center justify-between">
              <DialogTitle>{title}</DialogTitle>
              <DialogClose
                aria-label="Close"
                className={cn(
                  "relative flex size-5 items-center justify-center text-[var(--iconBolderActive)]",
                  "transition-transform duration-100 active:scale-[0.92] motion-reduce:transition-none",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-[4px]",
                  // 44×44 invisible hit area (Emil): pseudo-element extends touch target.
                  "before:absolute before:inset-[-12px] before:content-['']",
                  "[touch-action:manipulation]",
                )}
              >
                <CloseIcon className="size-5" />
              </DialogClose>
            </div>
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-[var(--iconBolderActive)]" />
              <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onListKeyDown}
                placeholder="Search sensor"
                spellCheck={false}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                data-1p-ignore
                data-lpignore="true"
                aria-label="Search sensor"
                className={cn(
                  "h-10 w-full rounded-[8px] border border-[var(--borderBolder)] bg-[var(--bgSurfaceRaised)] pl-10 pr-3 py-2",
                  "text-[14px] font-medium text-[var(--textHeading)] outline-none",
                  "placeholder:text-[var(--textDisabled)]",
                  "shadow-[0_1px_2px_rgba(16,24,40,0.05)]",
                  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                  // Hide the browser's native clear button on type=search
                  "[&::-webkit-search-cancel-button]:hidden",
                )}
              />
            </div>
          </div>
          <div
            ref={listRef}
            className="flex max-h-[308px] flex-col gap-[2px] overflow-y-auto bg-[var(--bgSurfaceRaised)] p-2"
          >
            {filtered.length === 0 ? (
              <div className="flex h-20 items-center justify-center text-[14px] font-medium text-[var(--textDisabled)]">
                No sensors match.
              </div>
            ) : (
              filtered.map((s, i) => {
                const selected = s.identifier === value;
                const highlighted = selected || i === activeIndex;
                return (
                  <button
                    key={s.identifier}
                    type="button"
                    onClick={() => handleSelect(s.identifier)}
                    onMouseEnter={() => setActiveIndex(i)}
                    className={cn(
                      "flex h-10 items-center justify-between gap-2 rounded-[8px] px-3 py-2 text-left",
                      "transition-[background-color,transform] duration-100 ease-out motion-reduce:transition-none",
                      "active:scale-[0.98]",
                      "[touch-action:manipulation]",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                      highlighted && "bg-[var(--bgSurfaceSunkenSubtle)]",
                    )}
                  >
                    <span className="truncate text-[14px] font-medium text-[var(--textHeading)]">
                      {s.name}
                    </span>
                    {selected && (
                      <CheckIcon className="size-5 shrink-0 text-[var(--iconBolderActive)]" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
