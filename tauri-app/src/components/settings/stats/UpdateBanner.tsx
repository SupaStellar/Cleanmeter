import { cn } from "@/lib/utils";

export type UpdateStatus = "idle" | "downloading" | "complete";

interface Props {
  status: UpdateStatus;
  version: string;
  onLater?: () => void;
  onUpdate?: () => void;
  onCancel?: () => void;
  onInstall?: () => void;
  className?: string;
}

/**
 * Bottom-pinned floating banner shown when a new version is available.
 * Three states (idle / downloading / complete) share the outer pill shell;
 * the icon, title, and right-side actions swap per state.
 * Matches Figma frames 2338:3496 / 2338:3809 / 2338:4118.
 *
 * Uses raw color values because the DS token CSS (src/app/globals.css with its
 * --bgBrand / --cornerRound / typography classes) is not imported into the main
 * Vite entry, so DS classes silently no-op in this part of the tree.
 */
export function UpdateBanner({
  status,
  version,
  onLater,
  onUpdate,
  onCancel,
  onInstall,
  className,
}: Props) {
  return (
    <div
      role="status"
      className={cn(
        "mx-auto flex h-[68px] w-full max-w-[499px] items-center gap-3 rounded-full bg-[#0C111D] px-4 py-[14px] shadow-[0_4px_24px_rgba(0,0,0,0.24)]",
        className,
      )}
    >
      <StatusIcon status={status} />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <p className="truncate text-[14px] font-medium leading-[17px] text-white">
          {titleFor(status)}
        </p>
        <p className="truncate text-[12px] font-medium leading-[15px] text-[#94969C]">
          v{version}
        </p>
      </div>
      <div className="flex shrink-0 items-center">
        {status === "downloading" ? (
          <GhostButton onClick={onCancel} tight>
            Cancel
          </GhostButton>
        ) : (
          <>
            <GhostButton onClick={onLater}>Later</GhostButton>
            <PrimaryButton
              onClick={status === "idle" ? onUpdate : onInstall}
            >
              {status === "idle" ? "Update now" : "Install now"}
            </PrimaryButton>
          </>
        )}
      </div>
    </div>
  );
}

function titleFor(status: UpdateStatus) {
  switch (status) {
    case "idle":
      return "New update available";
    case "downloading":
      return "Downloading update...";
    case "complete":
      return "Update ready to install";
  }
}

function StatusIcon({ status }: { status: UpdateStatus }) {
  if (status === "downloading") return <ProgressSpinner />;
  return (
    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#161B26] text-white">
      {status === "idle" ? <CloudDownloadIcon /> : <DownloadDoneIcon />}
    </div>
  );
}

function GhostButton({
  children,
  onClick,
  tight,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  tight?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-10 cursor-pointer items-center justify-center whitespace-nowrap rounded-full text-[14px] font-medium text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
        tight ? "px-3" : "px-5",
      )}
    >
      {children}
    </button>
  );
}

function PrimaryButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-10 cursor-pointer items-center justify-center whitespace-nowrap rounded-full bg-white px-5 text-[14px] font-medium text-[#0C111D] transition-colors hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
    >
      {children}
    </button>
  );
}

function ProgressSpinner() {
  const radius = 17;
  const circumference = 2 * Math.PI * radius;
  const arc = circumference * 0.25;
  return (
    <div className="flex size-10 shrink-0 items-center justify-center">
      <svg
        className="size-10 animate-spin"
        viewBox="0 0 40 40"
        role="status"
        aria-label="Downloading"
      >
        <circle
          cx="20"
          cy="20"
          r={radius}
          stroke="#FFFFFF"
          strokeOpacity="0.1"
          strokeWidth="3"
          fill="none"
        />
        <circle
          cx="20"
          cy="20"
          r={radius}
          stroke="#17B26A"
          strokeWidth="3"
          fill="none"
          strokeDasharray={`${arc} ${circumference - arc}`}
          strokeLinecap="round"
          transform="rotate(-90 20 20)"
        />
      </svg>
    </div>
  );
}

function CloudDownloadIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 37 27"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M16.8176 13.5382V3.36352C14.6874 3.75593 13.0336 4.786 11.8564 6.45375C10.6792 8.12149 10.0906 9.83829 10.0906 11.6041H9.24967C7.62397 11.6041 6.23652 12.1787 5.08732 13.3279C3.93812 14.4771 3.36352 15.8646 3.36352 17.4903C3.36352 19.116 3.93812 20.5034 5.08732 21.6526C6.23652 22.8018 7.62397 23.3764 9.24967 23.3764H29.4308C30.608 23.3764 31.603 22.97 32.4159 22.1572C33.2287 21.3443 33.6352 20.3493 33.6352 19.172C33.6352 17.9948 33.2287 16.9998 32.4159 16.1869C31.603 15.3741 30.608 14.9677 29.4308 14.9677H26.9081V11.6041C26.9081 10.2587 26.5998 9.00441 25.9832 7.8412C25.3665 6.67798 24.5537 5.68995 23.5446 4.8771V0.967011C25.6188 1.94804 27.2585 3.39855 28.4638 5.31856C29.669 7.23857 30.2717 9.33376 30.2717 11.6041C32.2057 11.8284 33.8104 12.6622 35.0857 14.1057C36.361 15.5493 36.9987 17.238 36.9987 19.172C36.9987 21.2742 36.2629 23.0611 34.7914 24.5327C33.3198 26.0042 31.533 26.74 29.4308 26.74H9.24967C6.699 26.74 4.51973 25.857 2.71184 24.0912C0.903945 22.3253 0 20.1671 0 17.6164C0 15.4301 0.658689 13.4821 1.97607 11.7723C3.29344 10.0625 5.01725 8.96938 7.14747 8.49288C7.62397 6.47477 8.81522 4.55476 10.7212 2.73286C12.6272 0.910952 14.6593 0 16.8176 0C17.7426 0 18.5344 0.329344 19.1931 0.988033C19.8518 1.64672 20.1811 2.43855 20.1811 3.36352V13.5382L21.6947 12.0666C22.003 11.7583 22.3884 11.6041 22.8509 11.6041C23.3134 11.6041 23.7128 11.7723 24.0491 12.1087C24.3575 12.417 24.5116 12.8094 24.5116 13.2859C24.5116 13.7624 24.3575 14.1548 24.0491 14.4631L19.6766 18.8357C19.3402 19.172 18.9478 19.3402 18.4993 19.3402C18.0509 19.3402 17.6585 19.172 17.3221 18.8357L12.9495 14.4631C12.6412 14.1548 12.48 13.7694 12.466 13.3069C12.452 12.8444 12.6132 12.445 12.9495 12.1087C13.2579 11.8003 13.6433 11.6392 14.1057 11.6252C14.5682 11.6111 14.9677 11.7583 15.304 12.0666L16.8176 13.5382Z"
        fill="currentColor"
      />
    </svg>
  );
}

function DownloadDoneIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 26 26"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M8.77167 14.5833L22.855 0.5C23.1883 0.166667 23.5842 0 24.0425 0C24.5008 0 24.8967 0.166667 25.23 0.5C25.5633 0.833333 25.73 1.22917 25.73 1.6875C25.73 2.14583 25.5633 2.54167 25.23 2.875L9.93833 18.1667C9.605 18.5 9.21611 18.6667 8.77167 18.6667C8.32722 18.6667 7.93833 18.5 7.605 18.1667L0.48 11.0417C0.146667 10.7083 -0.0130556 10.3125 0.000833333 9.85417C0.0147222 9.39583 0.188333 9 0.521667 8.66667C0.855 8.33333 1.25083 8.16667 1.70917 8.16667C2.1675 8.16667 2.56333 8.33333 2.89667 8.66667L8.77167 14.5833ZM2.855 26C2.38278 26 1.98694 25.8403 1.6675 25.5208C1.34806 25.2014 1.18833 24.8056 1.18833 24.3333C1.18833 23.8611 1.34806 23.4653 1.6675 23.1458C1.98694 22.8264 2.38278 22.6667 2.855 22.6667H22.855C23.3272 22.6667 23.7231 22.8264 24.0425 23.1458C24.3619 23.4653 24.5217 23.8611 24.5217 24.3333C24.5217 24.8056 24.3619 25.2014 24.0425 25.5208C23.7231 25.8403 23.3272 26 22.855 26H2.855Z"
        fill="currentColor"
      />
    </svg>
  );
}
