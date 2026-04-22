import { Minus, X } from "lucide-react";
import { isBrowser } from "@/lib/tauri";
import { cn } from "@/lib/utils";

const DEFAULT_HEIGHT = 900;

type Monitor = {
  size: { width: number; height: number };
  position: { x: number; y: number };
  scaleFactor: number;
} | null;

type AppWin = {
  minimize: () => unknown;
  hide: () => unknown;
  startDragging?: () => unknown;
  setSize?: (size: unknown) => Promise<void>;
  innerSize?: () => Promise<{ width: number; height: number; toLogical?: (s: number) => unknown }>;
  currentMonitor?: () => Promise<Monitor>;
};

// Eagerly cache the window + LogicalSize so dragging/resizing can be invoked
// synchronously inside DOM events. An async .then() inside mousedown fires
// after the event has ended and Tauri refuses to act on it.
let cachedWindow: AppWin | null = null;
let LogicalSizeCtor: (new (w: number, h: number) => unknown) | null = null;
if (!isBrowser) {
  import("@tauri-apps/api/window").then((m) => {
    cachedWindow = m.getCurrentWindow() as unknown as AppWin;
  });
  import("@tauri-apps/api/dpi").then((m) => {
    LogicalSizeCtor = m.LogicalSize as unknown as new (
      w: number,
      h: number,
    ) => unknown;
  });
}

const appWindowPromise: Promise<AppWin> = isBrowser
  ? Promise.resolve({ minimize: () => {}, hide: () => {} })
  : import("@tauri-apps/api/window").then(
      (m) => m.getCurrentWindow() as unknown as AppWin,
    );

/** Write to %TEMP%\cleanmeter-ui.log via a Rust command (unrestricted FS access). */
async function debugLog(msg: string) {
  if (isBrowser) return;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("ui_debug_log", { msg });
  } catch {
    // ignore
  }
}

function ChromeButton({
  onClick,
  title,
  className,
  children,
}: {
  onClick: () => void;
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors",
        "hover:bg-secondary hover:text-foreground",
        className,
      )}
    >
      {children}
    </button>
  );
}

function CleanmeterLogo() {
  return (
    <svg width="43" height="16" viewBox="0 0 603 230" fill="none" aria-hidden>
      <path
        d="M229.167 114.584C229.167 177.866 177.866 229.167 114.584 229.167C51.3008 229.167 0 177.866 0 114.584C0 51.3008 51.3008 0 114.584 0C177.866 0 229.167 51.3008 229.167 114.584ZM31.7579 114.584C31.7579 160.327 68.8402 197.409 114.584 197.409C160.327 197.409 197.409 160.327 197.409 114.584C197.409 68.8402 160.327 31.7579 114.584 31.7579C68.8402 31.7579 31.7579 68.8402 31.7579 114.584Z"
        fill="#17B26A"
      />
      <path
        d="M419.633 68.4272C434.504 46.3099 459.76 31.7579 488.416 31.7579C534.159 31.7579 571.241 68.8402 571.241 114.584C571.241 160.327 534.159 197.409 488.416 197.409C459.922 197.409 434.789 183.021 419.886 161.114C415.713 171.8 410.13 181.781 403.366 190.826C403.292 190.925 403.217 191.024 403.143 191.122C424.12 214.477 454.552 229.167 488.416 229.167C551.699 229.167 602.999 177.866 602.999 114.584C602.999 51.3008 551.699 0 488.416 0C454.328 0 423.716 14.8855 402.727 38.511C409.619 47.5683 415.318 57.5828 419.59 68.3199C419.604 68.3556 419.619 68.3914 419.633 68.4272Z"
        fill="#F04438"
      />
      <path
        d="M232.764 68.3587C247.641 46.2799 272.875 31.7579 301.501 31.7579C347.245 31.7579 384.327 68.8402 384.327 114.584C384.327 160.327 347.245 197.409 301.501 197.409C273.037 197.409 247.927 183.051 233.018 161.182C228.848 171.843 223.275 181.8 216.524 190.826C216.439 190.94 216.354 191.053 216.268 191.167C237.244 214.496 267.659 229.167 301.501 229.167C364.784 229.167 416.085 177.866 416.085 114.584C416.085 51.3008 364.784 0 301.501 0C267.434 0 236.84 14.8669 215.852 38.4666C215.868 38.4875 215.883 38.5085 215.899 38.5294C222.248 46.8757 227.584 56.0343 231.724 65.822C232.08 66.663 232.427 67.5086 232.764 68.3587Z"
        fill="#FEC84B"
      />
    </svg>
  );
}

export function TopBar() {
  // Defer startDragging() until the mouse actually moves. Calling it on
  // mousedown would make Windows swallow the mouseup event, breaking the
  // click → click → dblclick sequence the browser needs for onDoubleClick.
  // So: track mousedown, wait for movement > 4px, THEN initiate drag.
  // A pure click (no movement) releases normally and dblclick can fire.
  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button")) return;
    void debugLog(`mousedown detail=${e.detail} at (${e.clientX},${e.clientY})`);
    const startX = e.clientX;
    const startY = e.clientY;

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (dx * dx + dy * dy > 16) {
        cleanup();
        if (cachedWindow && typeof cachedWindow.startDragging === "function") {
          cachedWindow.startDragging();
        }
      }
    };
    const onUp = () => cleanup();
    const cleanup = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };
  const onDoubleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const w = cachedWindow;
    if (!w || !LogicalSizeCtor || !w.setSize) return;
    try {
      // Use browser's screen.availHeight (logical pixels, taskbar excluded).
      // Tauri's currentMonitor() returns null in admin-elevated webview here.
      const availH = Math.max(window.screen.availHeight, 400);
      const currentH = window.innerHeight; // logical pixels in webview
      const nearFull = currentH >= availH - 100;
      const targetH = nearFull ? DEFAULT_HEIGHT : availH - 40;
      void debugLog(
        `dblclick availH=${availH} curH=${currentH} targetH=${targetH}`,
      );
      await w.setSize(new LogicalSizeCtor(651, targetH));
    } catch (err) {
      void debugLog(`dblclick err: ${String(err)}`);
    }
  };
  return (
    <div
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
      className="flex h-[52px] shrink-0 cursor-grab items-center justify-between border-b border-border bg-background px-6 active:cursor-grabbing"
    >
      <div
        className="flex items-center gap-2.5"
      >
        <CleanmeterLogo />
        <span className="text-base font-medium text-foreground">Cleanmeter</span>
      </div>
      <div className="flex items-center gap-4">
        <ChromeButton
          onClick={() => appWindowPromise.then((w) => w.minimize())}
          title="Minimize"
        >
          <Minus className="size-[18px]" strokeWidth={2} />
        </ChromeButton>
        <ChromeButton
          onClick={() => appWindowPromise.then((w) => w.hide())}
          title="Close to tray"
          className="hover:bg-destructive hover:text-destructive-foreground"
        >
          <X className="size-[18px]" strokeWidth={2} />
        </ChromeButton>
      </div>
    </div>
  );
}
