import { useEffect, useState } from "react";
import "./splash-screen.css";

// Startup splash: the animated CleanMeter logo (authored as a standalone
// CSS-only HTML snippet, ported verbatim — see splash-screen.css) shown once
// per launch over the settings window. Timeline: entrance + ring sweep
// complete at ~1.93s into the 3480ms cycle; hold to 2.4s; fade the shell
// 280ms; then onDone unmounts it before the authored loop seam (3.32s) can
// show. Reduced motion renders the finished logo statically for the same
// beat (the CSS handles it), so nobody gets a flashing startup.
const HOLD_MS = 2400;
const FADE_MS = 280;

interface SplashScreenProps {
  onDone: () => void;
}

export function SplashScreen({ onDone }: SplashScreenProps) {
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFading(true), HOLD_MS);
    const doneTimer = setTimeout(onDone, HOLD_MS + FADE_MS);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, [onDone]);

  return (
    <div className={fading ? "cm-splash cm-splash--fading" : "cm-splash"}>
      <div className="cm-logo" role="img" aria-label="CleanMeter">
        <div className="cm-logo__slide">
          <svg viewBox="0 0 172 66" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              {/* each mask stroke traces a ring centerline; rotate(-90) starts
                  the sweep at 12 o'clock, dashoffset 100→0 fills clockwise */}
              <mask id="cm-reveal-green" maskUnits="userSpaceOnUse" x="0" y="0" width="172" height="66">
                <circle className="cm-trim" cx="32.6267" cy="32.6267" r="28.1" pathLength="100" transform="rotate(-90 32.6267 32.6267)" />
              </mask>
              <mask id="cm-reveal-yellow" maskUnits="userSpaceOnUse" x="0" y="0" width="172" height="66">
                <circle className="cm-trim" cx="85.8568" cy="32.6267" r="28.1" pathLength="100" transform="rotate(-90 85.8568 32.6267)" />
              </mask>
              <mask id="cm-reveal-red" maskUnits="userSpaceOnUse" x="0" y="0" width="172" height="66">
                <circle className="cm-trim" cx="139.075" cy="32.6267" r="28.1" pathLength="100" transform="rotate(-90 139.075 32.6267)" />
              </mask>
            </defs>

            {/* gray "track" layer (same path data, recolored) */}
            <g>
              <path className="cm-track cm-track--g" d="M65.2534 32.6267C65.2534 50.6459 50.6459 65.2534 32.6267 65.2534C14.6075 65.2534 0 50.6459 0 32.6267C0 14.6075 14.6075 0 32.6267 0C50.6459 0 65.2534 14.6075 65.2534 32.6267ZM9.04279 32.6267C9.04279 45.6517 19.6017 56.2106 32.6267 56.2106C45.6517 56.2106 56.2106 45.6517 56.2106 32.6267C56.2106 19.6017 45.6517 9.04279 32.6267 9.04279C19.6017 9.04279 9.04279 19.6017 9.04279 32.6267Z" />
              <path className="cm-track cm-track--y" d="M66.2845 19.4646C70.5207 13.1778 77.7058 9.04279 85.8568 9.04279C98.8818 9.04279 109.441 19.6017 109.441 32.6267C109.441 45.6517 98.8818 56.2106 85.8568 56.2106C77.7519 56.2106 70.602 52.1222 66.3567 45.8953C65.1694 48.9308 63.5824 51.7659 61.6604 54.336C61.6361 54.3684 61.6118 54.4008 61.5875 54.4331C67.56 61.0759 76.2205 65.2534 85.8568 65.2534C103.876 65.2534 118.483 50.6459 118.483 32.6267C118.483 14.6075 103.876 0 85.8568 0C76.1565 0 67.445 4.23321 61.4688 10.953C61.4733 10.959 61.4778 10.965 61.4824 10.9709C63.2901 13.3475 64.8095 15.9553 65.9883 18.7422C66.0896 18.9817 66.1883 19.2225 66.2845 19.4646Z" />
              <path className="cm-track cm-track--r" d="M119.49 19.484C123.724 13.1863 130.916 9.04279 139.075 9.04279C152.1 9.04279 162.659 19.6017 162.659 32.6267C162.659 45.6517 152.1 56.2106 139.075 56.2106C130.962 56.2106 123.805 52.1137 119.562 45.8758C118.374 48.9186 116.784 51.7604 114.858 54.336C114.837 54.3642 114.816 54.3923 114.794 54.4205C120.767 61.0706 129.433 65.2534 139.075 65.2534C157.094 65.2534 171.702 50.6459 171.702 32.6267C171.702 14.6075 157.094 0 139.075 0C129.369 0 120.652 4.23852 114.676 10.9657C116.638 13.5447 118.261 16.3962 119.478 19.4535C119.482 19.4637 119.486 19.4739 119.49 19.484Z" />
            </g>

            {/* colored logo (exact Figma paths + fills), revealed by the masks */}
            <g>
              <path className="cm-fill" mask="url(#cm-reveal-green)" d="M65.2534 32.6267C65.2534 50.6459 50.6459 65.2534 32.6267 65.2534C14.6075 65.2534 0 50.6459 0 32.6267C0 14.6075 14.6075 0 32.6267 0C50.6459 0 65.2534 14.6075 65.2534 32.6267ZM9.04279 32.6267C9.04279 45.6517 19.6017 56.2106 32.6267 56.2106C45.6517 56.2106 56.2106 45.6517 56.2106 32.6267C56.2106 19.6017 45.6517 9.04279 32.6267 9.04279C19.6017 9.04279 9.04279 19.6017 9.04279 32.6267Z" fill="#17B26A" />
              <path className="cm-fill" mask="url(#cm-reveal-red)" d="M119.49 19.484C123.724 13.1863 130.916 9.04279 139.075 9.04279C152.1 9.04279 162.659 19.6017 162.659 32.6267C162.659 45.6517 152.1 56.2106 139.075 56.2106C130.962 56.2106 123.805 52.1137 119.562 45.8758C118.374 48.9186 116.784 51.7604 114.858 54.336C114.837 54.3642 114.816 54.3923 114.794 54.4205C120.767 61.0706 129.433 65.2534 139.075 65.2534C157.094 65.2534 171.702 50.6459 171.702 32.6267C171.702 14.6075 157.094 0 139.075 0C129.369 0 120.652 4.23852 114.676 10.9657C116.638 13.5447 118.261 16.3962 119.478 19.4535C119.482 19.4637 119.486 19.4739 119.49 19.484Z" fill="#F04438" />
              <path className="cm-fill" mask="url(#cm-reveal-yellow)" d="M66.2845 19.4646C70.5207 13.1778 77.7058 9.04279 85.8568 9.04279C98.8818 9.04279 109.441 19.6017 109.441 32.6267C109.441 45.6517 98.8818 56.2106 85.8568 56.2106C77.7519 56.2106 70.602 52.1222 66.3567 45.8953C65.1694 48.9308 63.5824 51.7659 61.6604 54.336C61.6361 54.3684 61.6118 54.4008 61.5875 54.4331C67.56 61.0759 76.2205 65.2534 85.8568 65.2534C103.876 65.2534 118.483 50.6459 118.483 32.6267C118.483 14.6075 103.876 0 85.8568 0C76.1565 0 67.445 4.23321 61.4688 10.953C61.4733 10.959 61.4778 10.965 61.4824 10.9709C63.2901 13.3475 64.8095 15.9553 65.9883 18.7422C66.0896 18.9817 66.1883 19.2225 66.2845 19.4646Z" fill="#FEC84B" />
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
}
