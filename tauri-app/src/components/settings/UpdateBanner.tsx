import {
  ToastBanner,
  ToastBannerIcon,
  ToastBannerContent,
  ToastBannerTitle,
  ToastBannerDescription,
  ToastBannerActions,
} from "@/app/components/ToastBanner";
import { Button } from "@/app/components/Button";
import { cn } from "@/lib/utils";
import { useUpdaterStore } from "@/stores/updater-store";

// Where "What's new" goes: the changelog page on the marketing site, which
// lists the GitHub releases.
//
// The www is required. The apex cleanmeter.app has no A/AAAA/CNAME record at
// all, so a bare-domain link does not resolve; only www is CNAMEd to the host.
const CHANGELOG_URL = "https://www.cleanmeter.app/changelog";

/* ------------------------------------------------------------------ */
/*  Icons, exported from Figma. Not redrawn.                           */
/* ------------------------------------------------------------------ */

// Figma 2759:11139 (cloud_download), 20x20 box, glyph 18.33x13.25.
function CloudDownloadIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M9.16659 10.1243V5.08268C8.11103 5.27713 7.29159 5.78754 6.70825 6.61393C6.12492 7.44032 5.83325 8.29102 5.83325 9.16602H5.41659C4.61103 9.16602 3.92353 9.45074 3.35409 10.0202C2.78464 10.5896 2.49992 11.2771 2.49992 12.0827C2.49992 12.8882 2.78464 13.5757 3.35409 14.1452C3.92353 14.7146 4.61103 14.9993 5.41659 14.9993H15.4166C15.9999 14.9993 16.493 14.798 16.8958 14.3952C17.2985 13.9924 17.4999 13.4993 17.4999 12.916C17.4999 12.3327 17.2985 11.8396 16.8958 11.4368C16.493 11.0341 15.9999 10.8327 15.4166 10.8327H14.1666V9.16602C14.1666 8.49935 14.0138 7.87782 13.7083 7.30143C13.4027 6.72504 12.9999 6.23546 12.4999 5.83268V3.89518C13.5277 4.38129 14.3402 5.10004 14.9374 6.05143C15.5346 7.00282 15.8333 8.04102 15.8333 9.16602C16.7916 9.27713 17.5867 9.69032 18.2187 10.4056C18.8506 11.1209 19.1666 11.9577 19.1666 12.916C19.1666 13.9577 18.802 14.8431 18.0728 15.5723C17.3437 16.3014 16.4583 16.666 15.4166 16.666H5.41659C4.1527 16.666 3.07284 16.2285 2.177 15.3535C1.28117 14.4785 0.833252 13.4091 0.833252 12.1452C0.833252 11.0618 1.15964 10.0966 1.81242 9.24935C2.4652 8.40213 3.31936 7.86046 4.37492 7.62435C4.61103 6.62435 5.20131 5.67296 6.14575 4.77018C7.0902 3.8674 8.09714 3.41602 9.16659 3.41602C9.62492 3.41602 10.0173 3.57921 10.3437 3.9056C10.6701 4.23199 10.8333 4.62435 10.8333 5.08268V10.1243L11.5833 9.39518C11.736 9.2424 11.927 9.16602 12.1562 9.16602C12.3853 9.16602 12.5833 9.24935 12.7499 9.41602C12.9027 9.56879 12.9791 9.76324 12.9791 9.99935C12.9791 10.2355 12.9027 10.4299 12.7499 10.5827L10.5833 12.7493C10.4166 12.916 10.2221 12.9993 9.99992 12.9993C9.7777 12.9993 9.58325 12.916 9.41659 12.7493L7.24992 10.5827C7.09714 10.4299 7.01728 10.2389 7.01034 10.0098C7.00339 9.7806 7.08325 9.58268 7.24992 9.41602C7.4027 9.26324 7.59367 9.18338 7.82284 9.17643C8.052 9.16949 8.24992 9.2424 8.41659 9.39518L9.16659 10.1243Z"
        fill="currentColor"
      />
    </svg>
  );
}

// Figma 2759:11751 (download_done), 20x20 box, glyph 12.87x13.
function DownloadDoneIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M7.95834 10.9596L15 3.91797C15.1667 3.7513 15.3646 3.66797 15.5938 3.66797C15.8229 3.66797 16.0208 3.7513 16.1875 3.91797C16.3542 4.08464 16.4375 4.28255 16.4375 4.51172C16.4375 4.74089 16.3542 4.9388 16.1875 5.10547L8.54168 12.7513C8.37501 12.918 8.18057 13.0013 7.95834 13.0013C7.73612 13.0013 7.54168 12.918 7.37501 12.7513L3.81251 9.1888C3.64584 9.02214 3.56598 8.82422 3.57293 8.59505C3.57987 8.36589 3.66668 8.16797 3.83334 8.0013C4.00001 7.83464 4.19793 7.7513 4.42709 7.7513C4.65626 7.7513 4.85418 7.83464 5.02084 8.0013L7.95834 10.9596ZM5.00001 16.668C4.7639 16.668 4.56598 16.5881 4.40626 16.4284C4.24654 16.2687 4.16668 16.0707 4.16668 15.8346C4.16668 15.5985 4.24654 15.4006 4.40626 15.2409C4.56598 15.0812 4.7639 15.0013 5.00001 15.0013H15C15.2361 15.0013 15.434 15.0812 15.5938 15.2409C15.7535 15.4006 15.8333 15.5985 15.8333 15.8346C15.8333 16.0707 15.7535 16.2687 15.5938 16.4284C15.434 16.5881 15.2361 16.668 15 16.668H5.00001Z"
        fill="currentColor"
      />
    </svg>
  );
}

// Figma 2759:12536 (close), 20x20 box, glyph 10.96x10.96.
function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M9.99992 11.1673L5.91659 15.2507C5.76381 15.4034 5.56936 15.4798 5.33325 15.4798C5.09714 15.4798 4.9027 15.4034 4.74992 15.2507C4.59714 15.0979 4.52075 14.9034 4.52075 14.6673C4.52075 14.4312 4.59714 14.2368 4.74992 14.084L8.83325 10.0007L4.74992 5.91732C4.59714 5.76454 4.52075 5.5701 4.52075 5.33398C4.52075 5.09787 4.59714 4.90343 4.74992 4.75065C4.9027 4.59787 5.09714 4.52148 5.33325 4.52148C5.56936 4.52148 5.76381 4.59787 5.91659 4.75065L9.99992 8.83398L14.0833 4.75065C14.236 4.59787 14.4305 4.52148 14.6666 4.52148C14.9027 4.52148 15.0971 4.59787 15.2499 4.75065C15.4027 4.90343 15.4791 5.09787 15.4791 5.33398C15.4791 5.5701 15.4027 5.76454 15.2499 5.91732L11.1666 10.0007L15.2499 14.084C15.4027 14.2368 15.4791 14.4312 15.4791 14.6673C15.4791 14.9034 15.4027 15.0979 15.2499 15.2507C15.0971 15.4034 14.9027 15.4798 14.6666 15.4798C14.4305 15.4798 14.236 15.4034 14.0833 15.2507L9.99992 11.1673Z"
        fill="currentColor"
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Download progress ring                                             */
/* ------------------------------------------------------------------ */

// Geometry taken from the two arcs in Figma 2759:11453: a 24 box with
// innerRadius 0.74, which is a 3.12 stroke on a 10.44 radius. The track is
// white at 10%, the arc is Bg/Success Hover, and Figma starts it at twelve
// o'clock (arcData startingAngle 4.712 rad) running clockwise.
const RING_RADIUS = 10.44;
const RING_STROKE = 3.12;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

// Figma draws the arc at a 3.414 rad sweep, which is 54.3% of the circle. That
// is the frame the indeterminate case spins, so a download with no known length
// still shows the design's arc rather than an invented one.
const RING_INDETERMINATE_SWEEP = 3.414385 / (2 * Math.PI);

function ProgressRing({ progress }: { progress: number }) {
  const indeterminate = progress < 0;
  const fraction = indeterminate
    ? RING_INDETERMINATE_SWEEP
    : Math.min(1, Math.max(0, progress / 100));

  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      className={cn(indeterminate && "animate-spin motion-reduce:animate-none")}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={indeterminate ? undefined : progress}
    >
      <circle
        cx="12"
        cy="12"
        r={RING_RADIUS}
        stroke="var(--textInverse)"
        strokeOpacity={0.1}
        strokeWidth={RING_STROKE}
      />
      <circle
        cx="12"
        cy="12"
        r={RING_RADIUS}
        stroke="var(--bgSuccessHover)"
        strokeWidth={RING_STROKE}
        strokeDasharray={RING_LENGTH}
        strokeDashoffset={RING_LENGTH * (1 - fraction)}
        transform="rotate(-90 12 12)"
        // Linear, and shorter than the gap between two progress events, so the
        // arc keeps moving between updates without ever lagging behind them.
        className="transition-[stroke-dashoffset] duration-200 ease-linear motion-reduce:transition-none"
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  The pill                                                           */
/* ------------------------------------------------------------------ */

// Widths are Figma's: 603 for the offer and the ready states, 394 while
// downloading. 603 is also the settings window's content column, so the pill
// lines up with the cards above it, and the 394 one centres.
//
// The pill's own right padding is 16. Figma's ready state says 20 while the
// other two say 16, and a padding that changed with the state would jump the
// close button mid-transition.
const PILL_WIDTH = "max-w-[603px]";
const PILL_WIDTH_DOWNLOADING = "max-w-[394px]";

/**
 * Floating update pill. Renders while an update is available, downloading or
 * waiting to install; otherwise nothing. Lives in the settings window (mounted
 * in App).
 *
 * Matched to Figma 2759:11138 (available), 2759:11446 (downloading) and
 * 2759:11750 (ready to install).
 */
export function UpdateBanner() {
  const status = useUpdaterStore((s) => s.status);
  const version = useUpdaterStore((s) => s.availableVersion);
  const progress = useUpdaterStore((s) => s.progress);
  const dismissed = useUpdaterStore((s) => s.dismissed);
  const download = useUpdaterStore((s) => s.download);
  const install = useUpdaterStore((s) => s.install);
  const cancel = useUpdaterStore((s) => s.cancel);
  const dismiss = useUpdaterStore((s) => s.dismiss);

  const visible =
    !dismissed &&
    (status === "available" ||
      status === "downloading" ||
      status === "ready" ||
      status === "installing");
  if (!visible) return null;

  const downloading = status === "downloading";
  const installing = status === "installing";
  // Installing shows the ready layout with its buttons disabled, so the two
  // share one branch.
  const downloaded = status === "ready" || installing;

  // Figma has no installing state, so it reuses the ready one and drops the
  // buttons. It is on screen for the moment between the installer starting and
  // the app relaunching.
  const title = downloading
    ? "Downloading update..."
    : installing
      ? "Installing update..."
      : status === "ready"
        ? "Update ready to install"
        : "New update is available";

  // Inset 24 on all three sides, matching the window's own padding, so the
  // pill lines up with the cards above it at every width and not only where it
  // happens to hit its 603 cap.
  //
  // Figma has three instances of this pill in one frame: 24 from the bottom on
  // two of them and 23 on the third, and 24 from each side on all of them. The
  // 23 is a nudge, so 24 is the number.
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[var(--spacingXl)] z-50 flex justify-center px-[var(--spacingXl)]">
      <ToastBanner
        className={cn(
          "pointer-events-auto w-full",
          // The pill's own travel between 603 and 394. max-width rather than
          // width so both ends resolve to px and interpolate; the easing is the
          // one the collapsibles use, over a little longer because this moves
          // roughly 200px rather than rotating an icon.
          "transition-[max-width] duration-300 ease-[cubic-bezier(0.165,0.84,0.44,1)] motion-reduce:transition-none",
          downloading ? PILL_WIDTH_DOWNLOADING : PILL_WIDTH,
        )}
      >
        <ToastBannerIcon>
          {downloading ? (
            <ProgressRing progress={progress} />
          ) : downloaded ? (
            <DownloadDoneIcon />
          ) : (
            <CloudDownloadIcon />
          )}
        </ToastBannerIcon>

        <ToastBannerContent>
          <ToastBannerTitle>{title}</ToastBannerTitle>
          {version && <ToastBannerDescription>v{version}</ToastBannerDescription>}
        </ToastBannerContent>

        {downloading ? (
          <Button
            variant="link"
            size="sm"
            onClick={cancel}
            // Figma pads Cancel 12 all round, where the other buttons get 20
            // on the sides.
            className="shrink-0 px-[var(--spacingS)] animate-in fade-in-0 duration-200 motion-reduce:animate-none"
          >
            Cancel
          </Button>
        ) : (
          <ToastBannerActions className="animate-in fade-in-0 duration-200 motion-reduce:animate-none">
            {/* The two buttons touch: Figma puts them in a frame with gap 0. */}
            <div className="flex items-center">
              {downloaded ? (
                <Button variant="link" size="sm" onClick={dismiss} disabled={installing}>
                  Later
                </Button>
              ) : (
                <Button variant="link" size="sm" asChild>
                  <a href={CHANGELOG_URL} target="_blank" rel="noreferrer">
                    What&rsquo;s new
                  </a>
                </Button>
              )}
              {downloaded ? (
                <Button
                  variant="filled-white"
                  size="sm"
                  onClick={install}
                  disabled={installing}
                >
                  Install now
                </Button>
              ) : (
                <Button variant="filled-white" size="sm" onClick={download}>
                  Update now
                </Button>
              )}
            </div>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Dismiss"
              className="flex size-[20px] shrink-0 cursor-pointer items-center justify-center text-[var(--iconSubtle)] transition-colors duration-150 hover:text-[var(--iconSubtleHover)]"
            >
              <CloseIcon />
            </button>
          </ToastBannerActions>
        )}
      </ToastBanner>
    </div>
  );
}
