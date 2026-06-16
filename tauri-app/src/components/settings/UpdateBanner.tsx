import {
  ToastBanner,
  ToastBannerIcon,
  ToastBannerContent,
  ToastBannerTitle,
  ToastBannerDescription,
  ToastBannerActions,
} from "@/app/components/ToastBanner";
import { Button } from "@/app/components/Button";
import { useUpdaterStore } from "@/stores/updater-store";

// Matches the CloudDownloadIcon used in the ToastBanner design (Storybook).
function CloudDownloadIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M5.833 16.667a4.02 4.02 0 0 1-2.948-1.219A4.02 4.02 0 0 1 1.667 12.5c0-1.028.347-1.93 1.041-2.708.695-.778 1.57-1.236 2.625-1.375a5.197 5.197 0 0 1 1.896-3.063A5.143 5.143 0 0 1 10.417 4.17c1.444 0 2.687.5 3.729 1.5 1.041 1 1.618 2.222 1.729 3.667a4.078 4.078 0 0 1 2.458 1.396c.667.805 1 1.725 1 2.76 0 1.138-.395 2.106-1.187 2.906-.792.791-1.76 1.19-2.896 1.198v-.063H5.833Zm4.167-3l3-3h-2.083V7.5H9.083v3.167H7l3 3Z"
        fill="currentColor"
      />
    </svg>
  );
}

// Floating update badge. Renders only while an update is available or being
// installed; otherwise nothing. Lives in the settings window (mounted in App).
export function UpdateBanner() {
  const status = useUpdaterStore((s) => s.status);
  const version = useUpdaterStore((s) => s.availableVersion);
  const progress = useUpdaterStore((s) => s.progress);
  const dismissed = useUpdaterStore((s) => s.dismissed);
  const downloadAndInstall = useUpdaterStore((s) => s.downloadAndInstall);
  const dismiss = useUpdaterStore((s) => s.dismiss);

  const visible =
    !dismissed &&
    (status === "available" ||
      status === "downloading" ||
      status === "installing");
  if (!visible) return null;

  const title =
    status === "downloading"
      ? "Downloading update…"
      : status === "installing"
        ? "Installing — the app will restart"
        : "New update available";

  const description =
    status === "downloading"
      ? progress >= 0
        ? `${progress}%`
        : "Downloading…"
      : version
        ? `v${version}`
        : undefined;

  const busy = status === "downloading" || status === "installing";

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[var(--spacingL)] z-50 flex justify-center px-[var(--spacingL)]">
      <ToastBanner className="pointer-events-auto w-full max-w-[499px]">
        <ToastBannerIcon>
          <CloudDownloadIcon />
        </ToastBannerIcon>
        <ToastBannerContent>
          <ToastBannerTitle>{title}</ToastBannerTitle>
          {description && (
            <ToastBannerDescription>{description}</ToastBannerDescription>
          )}
        </ToastBannerContent>
        {!busy && (
          <ToastBannerActions>
            <Button variant="link" onClick={dismiss}>
              Later
            </Button>
            <Button variant="filled-white" onClick={downloadAndInstall}>
              Update now
            </Button>
          </ToastBannerActions>
        )}
      </ToastBanner>
    </div>
  );
}
